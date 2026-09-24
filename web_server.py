#!/usr/bin/env python3
"""
Spotify Downloader Local Web Application Server
Lightweight, multi-threaded HTTP server with REST API and real-time SSE progress streaming.
Runs with standard Python libraries.
"""

import os
import sys
import json
import time
import queue
import threading
import subprocess
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from spotify_scraper import SpotifyExtractor
from audio_downloader import AudioDownloader

PORT = 5050
DOWNLOAD_DIR = os.path.abspath("downloads")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# Global download state & queue
download_lock = threading.Lock()
active_downloads = {}  # track_id -> {status, progress, message, file, error}
progress_subscribers = []  # list of queue.Queue for SSE

def broadcast_update(track_id: str, status: str, progress: float, message: str, extra: dict = None):
    with download_lock:
        active_downloads[track_id] = {
            "track_id": track_id,
            "status": status,
            "progress": progress,
            "message": message,
            **(extra or {})
        }
    payload = json.dumps({
        "type": "progress",
        "data": active_downloads[track_id]
    })
    for q in list(progress_subscribers):
        try:
            q.put_nowait(payload)
        except Exception:
            pass

class DownloaderHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress routine GET logging for cleaner terminal
        if self.path.startswith("/api/events"):
            return
        super().log_message(format, *args)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/" or path == "/index.html":
            self._serve_file("index.html", "text/html; charset=utf-8")
        elif path == "/api/status":
            with download_lock:
                data = list(active_downloads.values())
            self._send_json({"downloads": data})
        elif path == "/api/config":
            cfg = {}
            cfg_path = os.path.join(os.path.dirname(__file__), "config.json")
            if os.path.exists(cfg_path):
                try:
                    with open(cfg_path, "r", encoding="utf-8") as f:
                        cfg = json.load(f)
                except Exception:
                    pass
            has_creds = bool(cfg.get("spotify_client_id") and cfg.get("spotify_client_secret"))
            cid_masked = cfg.get("spotify_client_id", "")[:6] + "..." if cfg.get("spotify_client_id") else ""
            self._send_json({"configured": has_creds, "client_id_preview": cid_masked})
        elif path == "/api/files":
            files = []
            if os.path.exists(DOWNLOAD_DIR):
                for f in sorted(os.listdir(DOWNLOAD_DIR)):
                    if f.endswith(".mp3"):
                        full_path = os.path.join(DOWNLOAD_DIR, f)
                        size_mb = round(os.path.getsize(full_path) / (1024 * 1024), 2)
                        files.append({"name": f, "size_mb": size_mb, "path": full_path})
            self._send_json({"files": files, "download_dir": DOWNLOAD_DIR})
        elif path == "/api/events":
            # Server-Sent Events (SSE) stream for real-time progress
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            q = queue.Queue()
            progress_subscribers.append(q)

            try:
                # Send initial snapshot
                with download_lock:
                    snapshot = json.dumps({"type": "snapshot", "data": list(active_downloads.values())})
                self.wfile.write(f"data: {snapshot}\n\n".encode("utf-8"))
                self.wfile.flush()

                while True:
                    try:
                        msg = q.get(timeout=20.0)
                        self.wfile.write(f"data: {msg}\n\n".encode("utf-8"))
                        self.wfile.flush()
                    except queue.Empty:
                        # Keep-alive heartbeat
                        self.wfile.write(b": heartbeat\n\n")
                        self.wfile.flush()
            except (ConnectionResetError, BrokenPipeError):
                pass
            finally:
                if q in progress_subscribers:
                    progress_subscribers.remove(q)
        else:
            self.send_error(404, "Not Found")

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = {}

        if path == "/api/fetch-info":
            url = payload.get("url", "").strip()
            if not url:
                self._send_json({"error": "No URL provided"}, status=400)
                return

            extractor = SpotifyExtractor()
            try:
                info = extractor.get_info(url)
                self._send_json({"success": True, "info": info})
            except Exception as e:
                self._send_json({"success": False, "error": str(e)}, status=500)

        elif path == "/api/download-tracks":
            tracks = payload.get("tracks", [])
            quality = int(payload.get("quality", 320))
            if not tracks:
                self._send_json({"error": "No tracks provided"}, status=400)
                return

            # Start background worker thread
            thread = threading.Thread(target=self._process_download_queue, args=(tracks, quality), daemon=True)
            thread.start()

            self._send_json({"success": True, "message": f"Queued {len(tracks)} track(s) for download."})

        elif path == "/api/config":
            cfg = {}
            cfg_path = os.path.join(os.path.dirname(__file__), "config.json")
            if os.path.exists(cfg_path):
                try:
                    with open(cfg_path, "r", encoding="utf-8") as f:
                        cfg = json.load(f)
                except Exception:
                    pass
            has_creds = bool(cfg.get("spotify_client_id") and cfg.get("spotify_client_secret"))
            cid_masked = cfg.get("spotify_client_id", "")[:6] + "..." if cfg.get("spotify_client_id") else ""
            self._send_json({"configured": has_creds, "client_id_preview": cid_masked})

        elif path == "/api/open-folder":
            # macOS Finder opener
            if sys.platform == "darwin":
                subprocess.run(["open", DOWNLOAD_DIR])
            elif sys.platform == "win32":
                os.startfile(DOWNLOAD_DIR)
            else:
                subprocess.run(["xdg-open", DOWNLOAD_DIR])
            self._send_json({"success": True, "path": DOWNLOAD_DIR})

        elif path == "/api/save-config":
            client_id = payload.get("client_id", "").strip()
            client_secret = payload.get("client_secret", "").strip()
            cfg_path = os.path.join(os.path.dirname(__file__), "config.json")
            with open(cfg_path, "w", encoding="utf-8") as f:
                json.dump({"spotify_client_id": client_id, "spotify_client_secret": client_secret}, f, indent=2)
            self._send_json({"success": True, "message": "Spotify API credentials saved successfully!"})

        else:
            self.send_error(404, "Not Found")

    def _process_download_queue(self, tracks, quality):
        downloader = AudioDownloader(output_dir=DOWNLOAD_DIR, quality_kbps=quality)
        for track in tracks:
            track_id = track.get("id", f"{track.get('artist')}_{track.get('title')}")
            broadcast_update(track_id, "queued", 0.0, "Waiting in queue...")

        for track in tracks:
            track_id = track.get("id", f"{track.get('artist')}_{track.get('title')}")

            def progress_hook(status, pct, msg):
                broadcast_update(track_id, status, pct, msg)

            try:
                res = downloader.download_track(track, progress_callback=progress_hook)
                if res.get("success"):
                    filename = os.path.basename(res.get("file", ""))
                    broadcast_update(track_id, "completed", 100.0, "Downloaded & Tagged", extra={"file": filename})
                else:
                    broadcast_update(track_id, "failed", 0.0, res.get("error", "Failed"))
            except Exception as e:
                broadcast_update(track_id, "failed", 0.0, str(e))

    def _serve_file(self, filename: str, content_type: str):
        filepath = os.path.join(os.path.dirname(__file__), filename)
        if not os.path.exists(filepath):
            self.send_error(404, f"File {filename} not found")
            return

        with open(filepath, "rb") as f:
            content = f.read()

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _send_json(self, data: dict, status: int = 200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

def run_server(port=PORT):
    server = ThreadingHTTPServer(("127.0.0.1", port), DownloaderHandler)
    print("\n" + "=" * 60)
    print(f"  🚀 SPOTIFY DOWNLOADER LOCAL DASHBOARD RUNNING")
    print(f"  👉 Open in your browser: http://localhost:{port}")
    print(f"  📁 Downloads folder:    {DOWNLOAD_DIR}")
    print("=" * 60 + "\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping web dashboard...")
        server.server_close()

if __name__ == "__main__":
    port = PORT
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    run_server(port)
