#!/usr/bin/env python3
"""
Python Bridge for SpotFlow Studio
Provides JSON CLI interface for Bun backend:
- fetch-info: Extracts playlist, album, or track info from Spotify (supports 1,000+ tracks).
- download-tracks: Downloads and tags songs, streaming JSON progress lines to stdout.
"""

import sys
import os
import json
import argparse
from spotify_scraper import SpotifyExtractor
from audio_downloader import AudioDownloader

def emit(data: dict):
    print(json.dumps(data), flush=True)

def cmd_fetch_info(url: str):
    try:
        extractor = SpotifyExtractor()
        info = extractor.get_info(url)
        emit({"success": True, "info": info})
    except Exception as e:
        emit({"success": False, "error": str(e)})

def cmd_download(tracks_json: str, quality: int, output_dir: str):
    try:
        tracks = json.loads(tracks_json)
    except Exception as e:
        emit({"type": "error", "error": f"Invalid JSON payload: {e}"})
        return

    downloader = AudioDownloader(output_dir=output_dir, quality_kbps=quality)

    for track in tracks:
        track_id = track.get("id", f"{track.get('artist')}_{track.get('title')}")
        emit({
            "type": "progress",
            "track_id": track_id,
            "status": "queued",
            "progress": 0.0,
            "message": "Waiting in queue..."
        })

    for track in tracks:
        track_id = track.get("id", f"{track.get('artist')}_{track.get('title')}")

        def on_progress(status, pct, msg):
            emit({
                "type": "progress",
                "track_id": track_id,
                "status": status,
                "progress": pct,
                "message": msg
            })

        try:
            res = downloader.download_track(track, progress_callback=on_progress)
            if res.get("success"):
                filename = os.path.basename(res.get("file", ""))
                emit({
                    "type": "progress",
                    "track_id": track_id,
                    "status": "completed",
                    "progress": 100.0,
                    "message": "Downloaded & Tagged",
                    "file": filename
                })
            else:
                emit({
                    "type": "progress",
                    "track_id": track_id,
                    "status": "failed",
                    "progress": 0.0,
                    "message": res.get("error", "Failed")
                })
        except Exception as err:
            emit({
                "type": "progress",
                "track_id": track_id,
                "status": "failed",
                "progress": 0.0,
                "message": str(err)
            })

def main():
    parser = argparse.ArgumentParser(description="SpotFlow Python Bridge")
    subparsers = parser.add_subparsers(dest="command")

    fetch_parser = subparsers.add_parser("fetch-info")
    fetch_parser.add_argument("url", help="Spotify URL")

    dl_parser = subparsers.add_parser("download-tracks")
    dl_parser.add_argument("--tracks", required=True, help="JSON string or path to JSON file containing track list")
    dl_parser.add_argument("--quality", type=int, default=320, help="Bitrate in kbps (192, 256, 320)")
    dl_parser.add_argument("--output", default="downloads", help="Output directory")

    args = parser.parse_args()

    if args.command == "fetch-info":
        cmd_fetch_info(args.url)
    elif args.command == "download-tracks":
        tracks_data = args.tracks
        if os.path.exists(tracks_data):
            with open(tracks_data, "r", encoding="utf-8") as f:
                tracks_data = f.read()
        cmd_download(tracks_data, args.quality, args.output)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
