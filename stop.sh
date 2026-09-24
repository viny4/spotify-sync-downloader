#!/bin/bash
# Stop SpotFlow Studio Server

echo "🛑 Stopping SpotFlow Studio server..."

PID=$(lsof -t -i:5050 2>/dev/null)

if [ -n "$PID" ]; then
    kill -9 $PID 2>/dev/null
    echo "✅ SpotFlow Studio server (PID $PID on port 5050) stopped successfully."
else
    echo "ℹ️ No server was running on port 5050."
fi
