# spotify-sync-downloader

A local web app to browse, download, and auto-sync Spotify playlists and albums as high-quality MP3s — no Spotify Premium required.

![Tech Stack](https://img.shields.io/badge/stack-React%20%2B%20Bun%20%2B%20Python-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- 🎵 **Paste any Spotify URL** — playlist, album, or track
- 📥 **Download up to 320kbps MP3** with metadata (title, artist, album art)
- 📋 **Full playlist pagination** — fetches all tracks (no 100-track limit)
- ⏱️ **Cron scheduler** — auto-sync playlists on a schedule
- 🔄 **Incremental sync** — only downloads new/missing tracks
- ⚙️ **Settings panel** — configure Spotify API keys and download quality
- 📡 **Real-time progress** via WebSocket

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite |
| Backend | Bun (TypeScript) |
| Scraper | Python 3 (stdlib only, no dependencies) |
| Scheduler | croner |

---

## Setup

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- Python 3.9+
- Node.js (for Vite dev server)

### 1. Install dependencies

```bash
# JS dependencies
bun install

# Python virtual environment
python3 -m venv .venv
```

### 2. Configure Spotify API (optional but recommended)

Without API keys, the app falls back to Spotify's embed scraper.
With API keys, it fetches full playlists with all metadata.

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create an app → copy **Client ID** and **Client Secret**
3. Paste them in the app's **Settings** panel (gear icon) — saved in `config.json`

> ⚠️ Never commit `config.json` — it contains your API keys (already in `.gitignore`)

### 3. Run

```bash
# Start both frontend and backend
./run.sh

# Or separately:
bun run be    # backend on :3001
bun run fe    # frontend on :5173
```

Open [http://localhost:5173](http://localhost:5173)

---

## Usage

1. Paste a Spotify playlist/album/track URL into the search bar
2. Browse tracks and click **Download All** or individual tracks
3. Files saved to `./downloads/` as MP3s
4. Use the **Crons** tab to schedule automatic playlist syncs

---

## How It Works

```
Browser → Bun Backend → Python Bridge → spotify_scraper.py
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                        Spotify API    Embed Scraper    audio_downloader.py
                      (anon token)    (100 track fallback)   (yt-dlp based)
```

The scraper tries the Spotify Web API first (using an anonymous web-player token extracted from embed pages), then falls back to the embed scraper if rate-limited.

---

## Notes

- Spotify's API rate limits apply. If you see "100 tracks only", the IP may be rate-limited — try again in a few minutes or switch networks.
- Downloaded files are named `Artist - Title.mp3`
- Album art and ID3 tags are embedded automatically

---

## License

MIT
