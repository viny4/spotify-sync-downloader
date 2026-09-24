import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const PROJECT_ROOT = path.resolve(import.meta.dir, "..");
const VENV_PYTHON = path.join(PROJECT_ROOT, ".venv", "bin", "python3");
const SYSTEM_PYTHON = "python3";
const PYTHON_BIN = fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : SYSTEM_PYTHON;
const BRIDGE_SCRIPT = path.join(PROJECT_ROOT, "python_bridge.py");

export interface ProgressEvent {
  type: string;
  track_id: string;
  status: "queued" | "searching" | "downloading" | "tagging" | "completed" | "failed";
  progress: number;
  message: string;
  file?: string;
  error?: string;
}

export function fetchSpotifyInfo(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [BRIDGE_SCRIPT, "fetch-info", url], {
      cwd: PROJECT_ROOT,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        return reject(new Error(stderr || `Process exited with code ${code}`));
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.success) {
          resolve(parsed.info);
        } else {
          reject(new Error(parsed.error || "Failed to fetch Spotify information"));
        }
      } catch (err: any) {
        reject(new Error(`Failed to parse response: ${err.message}. Raw output: ${stdout.slice(0, 300)}`));
      }
    });
  });
}

export function startDownloadProcess(
  tracks: any[],
  quality: number,
  outputDir: string,
  onProgress: (event: ProgressEvent) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Write tracks to a temp file to avoid CLI argument length limitations on massive 1,000+ track playlists
    const tempDir = path.join(PROJECT_ROOT, ".tmp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFile = path.join(tempDir, `batch_${Date.now()}_${Math.random().toString(36).substring(7)}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(tracks), "utf-8");

    const proc = spawn(
      PYTHON_BIN,
      [BRIDGE_SCRIPT, "download-tracks", "--tracks", tempFile, "--quality", quality.toString(), "--output", outputDir],
      { cwd: PROJECT_ROOT }
    );

    let lineBuffer = "";

    proc.stdout.on("data", (chunk) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.type === "progress") {
            onProgress(parsed);
          }
        } catch {
          // Non-JSON debug output, ignore
        }
      }
    });

    proc.stderr.on("data", (data) => {
      console.error("[Python Downloader Stderr]:", data.toString().trim());
    });

    proc.on("close", (code) => {
      // Clean up temp file
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch {}

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Downloader process exited with code ${code}`));
      }
    });
  });
}
