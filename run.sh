#!/bin/bash
# SpotFlow Studio Launcher
# React 19 + TypeScript + Bun + Cron Auto-Sync + Python Downloader

cd "$(dirname "$0")"

echo "=========================================================="
echo "  🎵 Starting SpotFlow Studio (React 19 + Bun + Crons)"
echo "=========================================================="

# 1. Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not found."
    exit 1
fi

# 2. Check Bun
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is required but not found. Please install Bun: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# 3. Create python venv if missing
if [ ! -d ".venv" ]; then
    echo "📦 Creating Python virtual environment (.venv)..."
    python3 -m venv .venv
fi

# 4. Ensure yt-dlp & mutagen are installed
echo "🔍 Checking Python dependencies (yt-dlp, mutagen)..."
.venv/bin/pip install --quiet yt-dlp mutagen

# 5. Build React frontend bundle if needed
if [ ! -d "dist" ]; then
    echo "⚡ Building React 19 frontend..."
    bun run build
fi

echo "🚀 Launching SpotFlow Bun Server..."
echo "👉 Opening http://localhost:5050 in your browser..."

# Open browser automatically on macOS
(sleep 1.2 && open "http://localhost:5050") &

# Start Bun Backend Server (serving both API and React frontend)
bun run server/index.ts
