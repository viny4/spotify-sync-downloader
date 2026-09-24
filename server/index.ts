import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { fetchSpotifyInfo, startDownloadProcess, type ProgressEvent } from "./bridge";
import { CronService } from "./cronService";

const PORT = parseInt(process.env.PORT || "5050", 10);
const PROJECT_ROOT = path.resolve(import.meta.dir, "..");
const DOWNLOAD_DIR = path.join(PROJECT_ROOT, "downloads");
const CONFIG_FILE = path.join(PROJECT_ROOT, "config.json");

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// In-memory download state
const activeDownloads = new Map<string, ProgressEvent>();
const sseClients = new Set<(msg: string) => void>();

function broadcast(payload: any) {
  const json = JSON.stringify(payload);
  for (const send of sseClients) {
    try {
      send(json);
    } catch {
      sseClients.delete(send);
    }
  }
}

// Initialize Cron Service
const cronService = new CronService((event) => {
  broadcast(event);
});

// Helper for CORS & JSON
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
    },
  });
}

function handleCorsOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
    },
  });
}

// Helper to open OS folder
function openFolder(dirPath: string) {
  if (process.platform === "darwin") {
    spawn("open", [dirPath]);
  } else if (process.platform === "win32") {
    spawn("explorer", [dirPath]);
  } else {
    spawn("xdg-open", [dirPath]);
  }
}

// Audio streamer with HTTP Range support for scrubbing
function streamAudio(filePath: string, req: Request): Response {
  if (!fs.existsSync(filePath)) {
    return new Response("Not Found", { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;

    const fileStream = fs.createReadStream(filePath, { start, end });
    return new Response(fileStream as any, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": "audio/mpeg",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const fileStream = fs.createReadStream(filePath);
  return new Response(fileStream as any, {
    headers: {
      "Content-Length": fileSize.toString(),
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  idleTimeout: 255,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (req.method === "OPTIONS") {
      return handleCorsOptions();
    }

    // ── API ROUTES ──────────────────────────────────────────

    // 1. SSE Events Stream
    if (pathname === "/api/events") {
      let clientSend: (msg: string) => void;
      let heartbeatTimer: any;
      const stream = new ReadableStream({
        start(controller) {
          clientSend = (msg: string) => {
            controller.enqueue(`data: ${msg}\n\n`);
          };
          sseClients.add(clientSend);

          // Periodic heartbeat to prevent socket timeouts
          heartbeatTimer = setInterval(() => {
            try {
              controller.enqueue(`: heartbeat\n\n`);
            } catch {
              clearInterval(heartbeatTimer);
            }
          }, 15000);

          // Send initial snapshot
          const snapshot = JSON.stringify({
            type: "snapshot",
            data: Array.from(activeDownloads.values()),
          });
          controller.enqueue(`data: ${snapshot}\n\n`);
        },
        cancel() {
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
          }
          if (clientSend) {
            sseClients.delete(clientSend);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // 2. Fetch Spotify info
    if (pathname === "/api/fetch-info" && req.method === "POST") {
      try {
        const body = (await req.json()) as any;
        const spotifyUrl = (body.url || "").trim();
        if (!spotifyUrl) {
          return jsonResponse({ success: false, error: "Spotify URL is required" }, 400);
        }
        const info = await fetchSpotifyInfo(spotifyUrl);
        return jsonResponse({ success: true, info });
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    // 3. Download Tracks
    if (pathname === "/api/download-tracks" && req.method === "POST") {
      try {
        const body = (await req.json()) as any;
        const tracks = body.tracks || [];
        const quality = parseInt(body.quality || "320", 10);

        if (!Array.isArray(tracks) || tracks.length === 0) {
          return jsonResponse({ success: false, error: "No tracks provided" }, 400);
        }

        // Initialize queue entries
        for (const track of tracks) {
          const trackId = track.id || `${track.artist}_${track.title}`;
          const initialEvent: ProgressEvent = {
            type: "progress",
            track_id: trackId,
            status: "queued",
            progress: 0,
            message: "Queued for download...",
          };
          activeDownloads.set(trackId, initialEvent);
          broadcast({ type: "progress", data: initialEvent });
        }

        // Run background download task
        (async () => {
          try {
            await startDownloadProcess(tracks, quality, DOWNLOAD_DIR, (event) => {
              activeDownloads.set(event.track_id, event);
              broadcast({ type: "progress", data: event });
            });
          } catch (err: any) {
            console.error("Batch download error:", err);
          }
        })();

        return jsonResponse({
          success: true,
          message: `Queued ${tracks.length} track(s) for download.`,
        });
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    // 4. Download Status
    if (pathname === "/api/status" && req.method === "GET") {
      return jsonResponse({ downloads: Array.from(activeDownloads.values()) });
    }

    // 5. Config (Spotify API keys)
    if (pathname === "/api/config" && req.method === "GET") {
      let cfg: any = {};
      if (fs.existsSync(CONFIG_FILE)) {
        try {
          cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
        } catch {}
      }
      const configured = Boolean(cfg.spotify_client_id && cfg.spotify_client_secret);
      const preview = cfg.spotify_client_id ? cfg.spotify_client_id.substring(0, 6) + "..." : "";
      return jsonResponse({ configured, client_id_preview: preview });
    }

    if (pathname === "/api/save-config" && req.method === "POST") {
      try {
        const body = (await req.json()) as any;
        const clientId = (body.client_id || "").trim();
        const clientSecret = (body.client_secret || "").trim();
        fs.writeFileSync(
          CONFIG_FILE,
          JSON.stringify({ spotify_client_id: clientId, spotify_client_secret: clientSecret }, null, 2),
          "utf-8"
        );
        return jsonResponse({ success: true, message: "API credentials saved successfully!" });
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    // 6. Downloaded Files List
    if (pathname === "/api/files" && req.method === "GET") {
      const files: any[] = [];
      if (fs.existsSync(DOWNLOAD_DIR)) {
        const entries = fs.readdirSync(DOWNLOAD_DIR);
        for (const file of entries) {
          if (file.endsWith(".mp3")) {
            const filePath = path.join(DOWNLOAD_DIR, file);
            const stat = fs.statSync(filePath);
            files.push({
              name: file,
              size_mb: Math.round((stat.size / (1024 * 1024)) * 100) / 100,
              path: filePath,
              url: `/api/audio/${encodeURIComponent(file)}`,
              modified: stat.mtime.toISOString(),
            });
          }
        }
      }
      // Sort newest first
      files.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
      return jsonResponse({ files, download_dir: DOWNLOAD_DIR });
    }

    // 7. Audio stream
    if (pathname.startsWith("/api/audio/")) {
      const filename = decodeURIComponent(pathname.replace("/api/audio/", ""));
      const filePath = path.join(DOWNLOAD_DIR, filename);
      return streamAudio(filePath, req);
    }

    // 8. Open Folder in OS
    if (pathname === "/api/open-folder" && req.method === "POST") {
      openFolder(DOWNLOAD_DIR);
      return jsonResponse({ success: true, path: DOWNLOAD_DIR });
    }

    // 9. Crons & Auto-Sync Routes
    if (pathname === "/api/crons" && req.method === "GET") {
      return jsonResponse({
        jobs: cronService.getJobs(),
        history: cronService.getHistory(),
      });
    }

    if (pathname === "/api/crons" && req.method === "POST") {
      try {
        const body = (await req.json()) as any;
        const { name, url: spotifyUrl, cronExpr, quality } = body;
        if (!name || !spotifyUrl || !cronExpr) {
          return jsonResponse({ success: false, error: "Missing required cron fields (name, url, cronExpr)" }, 400);
        }
        const job = cronService.addJob({
          name,
          url: spotifyUrl,
          cronExpr,
          quality: parseInt(quality || "320", 10),
        });
        return jsonResponse({ success: true, job });
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    if (pathname.startsWith("/api/crons/") && pathname.endsWith("/run") && req.method === "POST") {
      const id = pathname.replace("/api/crons/", "").replace("/run", "");
      try {
        const log = await cronService.triggerJob(id);
        return jsonResponse({ success: true, log });
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    if (pathname.startsWith("/api/crons/") && pathname.endsWith("/toggle") && req.method === "POST") {
      const id = pathname.replace("/api/crons/", "").replace("/toggle", "");
      const updated = cronService.toggleJob(id);
      if (updated) {
        return jsonResponse({ success: true, job: updated });
      }
      return jsonResponse({ success: false, error: "Cron job not found" }, 404);
    }

    if (pathname.startsWith("/api/crons/") && req.method === "DELETE") {
      const id = pathname.replace("/api/crons/", "");
      const removed = cronService.removeJob(id);
      return jsonResponse({ success: removed });
    }

    // Serve built static frontend files if production build exists
    const distDir = path.join(PROJECT_ROOT, "dist");
    if (fs.existsSync(distDir)) {
      let relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
      let localPath = path.join(distDir, relativePath);
      if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
        return new Response(Bun.file(localPath));
      }
      // SPA Fallback
      const indexHtml = path.join(distDir, "index.html");
      if (fs.existsSync(indexHtml)) {
        return new Response(Bun.file(indexHtml));
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("\n" + "=".repeat(60));
console.log(`  🚀 SPOTFLOW BUN BACKEND READY`);
console.log(`  👉 API Port:         ${PORT}`);
console.log(`  ⚡ Crons Engine:     Active (in-memory & schedules.json)`);
console.log(`  📁 Audio Directory:  ${DOWNLOAD_DIR}`);
console.log("=".repeat(60) + "\n");
