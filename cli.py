#!/usr/bin/env python3
"""
Spotify Playlist & Track Downloader CLI
Usage:
    python3 cli.py "https://open.spotify.com/playlist/..."
    python3 cli.py "https://open.spotify.com/track/..." --output ./my_songs
"""

import sys
import argparse
from spotify_scraper import SpotifyExtractor
from audio_downloader import AudioDownloader

def print_banner():
    banner = """
======================================================
  🎵 SPOTIFY PLAYLIST DOWNLOADER (Local Testing)
  - No Spotify Premium Required
  - High Quality MP3 Transcoding (Up to 320 kbps)
  - Full Metadata & Album Cover Tagging
======================================================
"""
    print(banner)

def main():
    parser = argparse.ArgumentParser(description="Download Spotify playlists, albums, and tracks locally.")
    parser.add_argument("url", nargs="?", help="Spotify URL (Playlist, Album, or Track)")
    parser.add_argument("-o", "--output", default="downloads", help="Destination folder (default: ./downloads)")
    parser.add_argument("-q", "--quality", type=int, default=320, choices=[128, 192, 256, 320], help="Audio bitrate in kbps (default: 320)")

    args = parser.parse_args()

    print_banner()

    url = args.url
    if not url:
        try:
            url = input("🔗 Enter Spotify URL (Playlist/Album/Track): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(0)

    if not url:
        print("[!] No URL provided. Exiting.")
        sys.exit(1)

    print(f"\n[1/3] 🔍 Fetching Spotify metadata for:\n      {url}")
    extractor = SpotifyExtractor()
    try:
        data = extractor.get_info(url)
    except Exception as e:
        print(f"[❌] Error fetching info: {e}")
        sys.exit(1)

    title = data.get("title", "Untitled")
    owner = data.get("owner", "Unknown")
    total = data.get("total_tracks", len(data.get("tracks", [])))
    item_type = data.get("type", "playlist").capitalize()

    print(f"\n[✓] Found {item_type}: '{title}' by {owner}")
    print(f"    Total items: {total} track(s)")
    print(f"    Output directory: {args.output}\n")

    downloader = AudioDownloader(output_dir=args.output, quality_kbps=args.quality)

    print("[2/3] 🚀 Starting download & processing...\n")
    successful = 0
    failed = 0

    tracks = data.get("tracks", [])
    for idx, track in enumerate(tracks, 1):
        track_title = track.get("title")
        track_artist = track.get("artist")
        duration = track.get("duration_formatted", "")
        print(f"──────────────────────────────────────────────────────────")
        print(f"[{idx}/{total}] 🎵 {track_artist} - {track_title} ({duration})")

        def on_progress(status, pct, msg):
            print(f"      ↳ [{status.upper()}] {msg}")

        result = downloader.download_track(track, progress_callback=on_progress)
        if result.get("success"):
            successful += 1
        else:
            failed += 1

    print(f"\n──────────────────────────────────────────────────────────")
    print(f"[3/3] 🎉 Finished processing {total} track(s)!")
    print(f"      ✅ Successful: {successful}")
    if failed > 0:
        print(f"      ❌ Failed: {failed}")
    print(f"      📁 Files saved to: {downloader.output_dir}\n")

if __name__ == "__main__":
    main()
