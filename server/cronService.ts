import { Cron } from "croner";
import fs from "node:fs";
import path from "node:path";
import { fetchSpotifyInfo, startDownloadProcess } from "./bridge";

export interface CronJobConfig {
  id: string;
  name: string;
  url: string;
  cronExpr: string;
  quality: number;
  enabled: boolean;
  createdAt: string;
  lastRun?: string;
  lastRunStatus?: "success" | "error" | "running";
  lastRunMessage?: string;
}

export interface SyncLog {
  id: string;
  jobId: string;
  jobName: string;
  timestamp: string;
  status: "success" | "error" | "running";
  message: string;
  newTracksDownloaded: number;
}

const SCHEDULES_FILE = path.resolve(import.meta.dir, "..", "schedules.json");
const DOWNLOAD_DIR = path.resolve(import.meta.dir, "..", "downloads");

export class CronService {
  private jobs: Map<string, { config: CronJobConfig; cronInstance?: Cron }> = new Map();
  private history: SyncLog[] = [];
  private onBroadcast?: (event: any) => void;

  constructor(broadcastCallback?: (event: any) => void) {
    this.onBroadcast = broadcastCallback;
    this.loadSchedules();
  }

  setBroadcaster(callback: (event: any) => void) {
    this.onBroadcast = callback;
  }

  private loadSchedules() {
    if (!fs.existsSync(SCHEDULES_FILE)) return;
    try {
      const data = JSON.parse(fs.readFileSync(SCHEDULES_FILE, "utf-8"));
      if (Array.isArray(data)) {
        for (const item of data) {
          this.schedule(item, false);
        }
      }
    } catch (e) {
      console.error("Failed to load schedules.json:", e);
    }
  }

  private saveSchedules() {
    try {
      const configs = Array.from(this.jobs.values()).map((j) => j.config);
      fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(configs, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save schedules.json:", e);
    }
  }

  public getJobs(): Array<CronJobConfig & { nextRun?: string | null }> {
    return Array.from(this.jobs.values()).map(({ config, cronInstance }) => ({
      ...config,
      nextRun: cronInstance ? cronInstance.nextRun()?.toISOString() || null : null,
    }));
  }

  public getHistory(): SyncLog[] {
    return this.history.slice(0, 50);
  }

  public addJob(config: Omit<CronJobConfig, "id" | "createdAt" | "enabled">): CronJobConfig {
    const id = "cron_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(5);
    const fullConfig: CronJobConfig = {
      ...config,
      id,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    this.schedule(fullConfig, true);
    return fullConfig;
  }

  public removeJob(id: string): boolean {
    const entry = this.jobs.get(id);
    if (!entry) return false;
    if (entry.cronInstance) {
      entry.cronInstance.stop();
    }
    this.jobs.delete(id);
    this.saveSchedules();
    return true;
  }

  public toggleJob(id: string): CronJobConfig | null {
    const entry = this.jobs.get(id);
    if (!entry) return null;

    entry.config.enabled = !entry.config.enabled;
    if (entry.config.enabled) {
      this.initCron(entry.config);
    } else if (entry.cronInstance) {
      entry.cronInstance.stop();
      entry.cronInstance = undefined;
    }
    this.saveSchedules();
    return entry.config;
  }

  public async triggerJob(id: string): Promise<SyncLog> {
    const entry = this.jobs.get(id);
    if (!entry) {
      throw new Error(`Cron job ${id} not found`);
    }
    return this.executeSync(entry.config);
  }

  private schedule(config: CronJobConfig, persist = true) {
    let cronInstance: Cron | undefined;
    if (config.enabled) {
      try {
        cronInstance = new Cron(config.cronExpr, async () => {
          await this.executeSync(config);
        });
      } catch (err: any) {
        console.error(`Invalid cron expression for job ${config.name}:`, err.message);
      }
    }
    this.jobs.set(config.id, { config, cronInstance });
    if (persist) {
      this.saveSchedules();
    }
  }

  private initCron(config: CronJobConfig) {
    const entry = this.jobs.get(config.id);
    if (!entry) return;
    try {
      entry.cronInstance = new Cron(config.cronExpr, async () => {
        await this.executeSync(config);
      });
    } catch (err: any) {
      console.error(`Failed to initialize cron for ${config.name}:`, err.message);
    }
  }

  private async executeSync(config: CronJobConfig): Promise<SyncLog> {
    const logId = "log_" + Date.now();
    const startTime = new Date().toISOString();
    config.lastRun = startTime;
    config.lastRunStatus = "running";
    config.lastRunMessage = "Sync in progress...";

    const log: SyncLog = {
      id: logId,
      jobId: config.id,
      jobName: config.name,
      timestamp: startTime,
      status: "running",
      message: "Fetching playlist updates...",
      newTracksDownloaded: 0,
    };
    this.history.unshift(log);

    if (this.onBroadcast) {
      this.onBroadcast({
        type: "cron_update",
        jobId: config.id,
        status: "running",
        message: log.message,
      });
    }

    try {
      const info = await fetchSpotifyInfo(config.url);
      const tracks: any[] = info.tracks || [];

      // Check existing files in download folder to perform incremental sync (only download missing tracks)
      const existingFiles = new Set(
        fs.existsSync(DOWNLOAD_DIR)
          ? fs.readdirSync(DOWNLOAD_DIR).filter((f) => f.endsWith(".mp3")).map((f) => f.toLowerCase())
          : []
      );

      const missingTracks: any[] = [];
      for (const track of tracks) {
        const titleClean = (track.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const artistClean = (track.artist || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        
        let found = false;
        for (const file of existingFiles) {
          const fileClean = file.replace(/[^a-z0-9]/g, "");
          if (fileClean.includes(titleClean) && (artistClean === "" || fileClean.includes(artistClean))) {
            found = true;
            break;
          }
        }
        if (!found) {
          missingTracks.push(track);
        }
      }

      if (missingTracks.length === 0) {
        config.lastRunStatus = "success";
        config.lastRunMessage = `All ${tracks.length} tracks are already up to date.`;
        log.status = "success";
        log.message = config.lastRunMessage;
      } else {
        log.message = `Found ${missingTracks.length} new track(s). Downloading...`;
        await startDownloadProcess(
          missingTracks,
          config.quality || 320,
          DOWNLOAD_DIR,
          (progressEvent) => {
            if (this.onBroadcast) {
              this.onBroadcast({
                type: "progress",
                data: progressEvent,
              });
            }
          }
        );
        config.lastRunStatus = "success";
        config.lastRunMessage = `Synced! Downloaded ${missingTracks.length} new track(s).`;
        log.status = "success";
        log.message = config.lastRunMessage || "Sync completed successfully";
        log.newTracksDownloaded = missingTracks.length;
      }
    } catch (err: any) {
      config.lastRunStatus = "error";
      config.lastRunMessage = err.message || "Sync failed";
      log.status = "error";
      log.message = config.lastRunMessage || "Sync failed";
    }

    this.saveSchedules();

    if (this.onBroadcast) {
      this.onBroadcast({
        type: "cron_update",
        jobId: config.id,
        status: config.lastRunStatus,
        message: config.lastRunMessage,
        log,
      });
    }

    return log;
  }
}
