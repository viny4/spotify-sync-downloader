"""
Audio Downloader & Metadata Tagger
Searches YouTube/YouTube Music using yt-dlp, downloads the audio,
transcodes to MP3, and embeds ID3 tags & Album Cover art.
"""

import os
import sys
import re
import json
import ssl
import subprocess
import urllib.request
import urllib.parse
from typing import Dict, Any, Callable, Optional, Tuple

# Set SSL Certificate path for macOS Python
try:
    import certifi
    os.environ["SSL_CERT_FILE"] = certifi.where()
    os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()
except Exception:
    pass

class AudioDownloader:
    def __init__(self, output_dir: str = "downloads", quality_kbps: int = 320):
        self.output_dir = os.path.abspath(output_dir)
        self.quality_kbps = quality_kbps
        os.makedirs(self.output_dir, exist_ok=True)
        self._ensure_tools()

    def _ensure_tools(self):
        """Verifies ffmpeg presence and yt-dlp."""
        # Find ffmpeg
        self.ffmpeg_path = self._find_binary("ffmpeg")
        if not self.ffmpeg_path:
            # Common paths on macOS
            for p in ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]:
                if os.path.isfile(p) and os.access(p, os.X_OK):
                    self.ffmpeg_path = p
                    break

        # Check yt-dlp (either as python module or CLI executable)
        self.has_yt_dlp_module = False
        try:
            import yt_dlp
            self.has_yt_dlp_module = True
        except ImportError:
            self.has_yt_dlp_module = False

        self.yt_dlp_cli = self._find_binary("yt-dlp")

    @staticmethod
    def _find_binary(name: str) -> Optional[str]:
        import shutil
        return shutil.which(name)

    def download_track(
        self,
        track_info: Dict[str, Any],
        progress_callback: Optional[Callable[[str, float, str], None]] = None
    ) -> Dict[str, Any]:
        """
        Downloads a single track and embeds tags.
        progress_callback(status, percentage, message)
        """
        title = track_info.get("title", "Unknown Track")
        artist = track_info.get("artist", "Unknown Artist")
        album = track_info.get("album", "")
        year = track_info.get("year", "")
        index = track_info.get("index", 1)
        cover_url = track_info.get("cover_url", "")

        def notify(status: str, pct: float, msg: str):
            if progress_callback:
                progress_callback(status, pct, msg)
            else:
                print(f"[{status.upper()}] {msg}")

        notify("searching", 10.0, f"Searching YouTube for '{artist} - {title}'...")

        # Sanitize filename
        clean_title = "".join(c for c in title if c.isalnum() or c in " .-_()").strip()
        clean_artist = "".join(c for c in artist if c.isalnum() or c in " .-_()").strip()
        base_filename = f"{clean_artist} - {clean_title}"
        final_mp3_path = os.path.join(self.output_dir, f"{base_filename}.mp3")

        # Skip if already downloaded and valid
        if os.path.exists(final_mp3_path) and os.path.getsize(final_mp3_path) > 102400:
            notify("completed", 100.0, f"Already downloaded: {os.path.basename(final_mp3_path)}")
            return {"success": True, "file": final_mp3_path, "skipped": True}

        # Temp files
        temp_audio_template = os.path.join(self.output_dir, f"temp_{track_info.get('id', 'track')}.%(ext)s")
        cover_image_path = os.path.join(self.output_dir, f"temp_{track_info.get('id', 'track')}_cover.jpg")

        search_queries = [
            f"ytsearch1:{artist} - {title} audio",
            f"ytsearch1:{artist} - {title} official audio",
            f"ytsearch1:{artist} - {title}"
        ]

        try:
            # 1. Download audio via yt-dlp with query fallback
            notify("downloading", 30.0, "Downloading highest quality audio stream...")
            download_success = False
            for sq in search_queries:
                download_success = self._run_ytdlp_download(sq, temp_audio_template, notify)
                if download_success:
                    break

            if not download_success:
                raise RuntimeError("Failed to extract audio from YouTube across all search variations.")

            # Locate downloaded temp file
            temp_files = [
                os.path.join(self.output_dir, f)
                for f in os.listdir(self.output_dir)
                if f.startswith(f"temp_{track_info.get('id', 'track')}.")
            ]
            if not temp_files:
                raise FileNotFoundError("Audio download completed but temp audio file was not found.")
            downloaded_temp_file = temp_files[0]

            # 2. Resolve True Album Artwork and Metadata (Individual 600x600 Cover & Album Name)
            cover_url, album, year = self._resolve_track_metadata(title, artist, cover_url, album, str(year or ""))

            # Download Album Cover if available
            has_cover = False
            if cover_url:
                notify("tagging", 75.0, "Fetching high-resolution album artwork...")
                try:
                    ctx = ssl.create_default_context()
                    ctx.check_hostname = False
                    ctx.verify_mode = ssl.CERT_NONE
                    req = urllib.request.Request(cover_url, headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
                        with open(cover_image_path, "wb") as f:
                            f.write(resp.read())
                    has_cover = os.path.exists(cover_image_path) and os.path.getsize(cover_image_path) > 0
                except Exception as e:
                    print(f"[!] Warning: Failed to download cover art: {e}")

            # 3. Transcode to MP3 & Embed Metadata using FFmpeg or Mutagen
            notify("tagging", 85.0, "Transcoding & embedding metadata tags...")
            self._transcode_and_tag(
                input_audio=downloaded_temp_file,
                output_mp3=final_mp3_path,
                cover_image=cover_image_path if has_cover else None,
                metadata={
                    "title": title,
                    "artist": artist,
                    "album": album,
                    "year": str(year),
                    "track": str(index),
                }
            )

            # 4. Clean up temp files
            if os.path.exists(downloaded_temp_file):
                try:
                    os.remove(downloaded_temp_file)
                except Exception:
                    pass
            if has_cover and os.path.exists(cover_image_path):
                try:
                    os.remove(cover_image_path)
                except Exception:
                    pass

            notify("completed", 100.0, f"Saved: {os.path.basename(final_mp3_path)}")
            # Gentle anti-throttling delay for big playlist downloads
            import time, random
            time.sleep(random.uniform(0.6, 1.2))
            return {"success": True, "file": final_mp3_path, "skipped": False}

        except Exception as e:
            notify("failed", 0.0, f"Error: {str(e)}")
            return {"success": False, "error": str(e)}

    def _run_ytdlp_download(self, query: str, out_template: str, notify_fn: Callable) -> bool:
        """Downloads audio using either yt_dlp python module or CLI executable."""
        if self.has_yt_dlp_module:
            import yt_dlp
            ydl_opts = {
                "format": "bestaudio/best",
                "outtmpl": out_template,
                "quiet": True,
                "no_warnings": True,
                "default_search": "ytsearch1",
                "noplaylist": True,
                "nocheckcertificate": True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([query])
            return True
        elif self.yt_dlp_cli:
            cmd = [
                self.yt_dlp_cli,
                query,
                "-f", "bestaudio/best",
                "-o", out_template,
                "--no-playlist",
                "--no-check-certificate",
                "--quiet",
                "--no-warnings"
            ]
            res = subprocess.run(cmd, capture_output=True, text=True)
            return res.returncode == 0
        else:
            # Fallback: invoke via sys.executable -m yt_dlp
            cmd = [
                sys.executable, "-m", "yt_dlp",
                query,
                "-f", "bestaudio/best",
                "-o", out_template,
                "--no-playlist",
                "--no-check-certificate",
                "--quiet",
                "--no-warnings"
            ]
            res = subprocess.run(cmd, capture_output=True, text=True)
            return res.returncode == 0

    def _transcode_and_tag(
        self,
        input_audio: str,
        output_mp3: str,
        cover_image: Optional[str],
        metadata: Dict[str, str]
    ):
        """Converts downloaded audio stream into a tagged MP3 with cover art."""
        ffmpeg_bin = self.ffmpeg_path or "ffmpeg"

        # Build FFmpeg command
        cmd = [ffmpeg_bin, "-y", "-i", input_audio]

        if cover_image and os.path.exists(cover_image):
            cmd.extend(["-i", cover_image])
            cmd.extend([
                "-map", "0:a:0",
                "-map", "1:v:0",
                "-c:v", "copy",
                "-id3v2_version", "3",
                "-metadata:s:v", "title=Album cover",
                "-metadata:s:v", "comment=Cover (front)"
            ])
        else:
            cmd.extend(["-map", "0:a:0"])

        cmd.extend([
            "-c:a", "libmp3lame",
            "-b:a", f"{self.quality_kbps}k",
            "-metadata", f"title={metadata.get('title', '')}",
            "-metadata", f"artist={metadata.get('artist', '')}",
            "-metadata", f"album={metadata.get('album', '')}",
            "-metadata", f"date={metadata.get('year', '')}",
            "-metadata", f"track={metadata.get('track', '1')}",
            output_mp3
        ])

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg error: {result.stderr[-300:]}")

    def _resolve_track_metadata(
        self,
        title: str,
        artist: str,
        cover_url: str,
        album: str,
        year: str
    ) -> Tuple[str, str, str]:
        """
        Ensures each song receives its true unique high-res album cover and real album title.
        If cover_url is a generic playlist mosaic (contains mosaic.scdn.co) or empty,
        resolves the official high-resolution album cover and album name via Apple Music/iTunes Search API.
        """
        is_mosaic = not cover_url or "mosaic.scdn.co" in cover_url
        if not is_mosaic and album and year:
            return cover_url, album, year

        try:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            # Clean search query (strip parenthetical text like "(Remastered)")
            clean_t = re.sub(r"\(.*?\)|\[.*?\]", "", title).strip()
            clean_a = re.sub(r"\(.*?\)|\[.*?\]", "", artist).strip()
            query = urllib.parse.quote_plus(f"{clean_a} {clean_t}")
            url = f"https://itunes.apple.com/search?term={query}&entity=song&limit=1"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

            with urllib.request.urlopen(req, timeout=5, context=ctx) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("resultCount", 0) > 0:
                    item = data["results"][0]
                    # Upgrade to 600x600 high-res cover
                    art = item.get("artworkUrl100", "").replace("100x100bb.jpg", "600x600bb.jpg")
                    real_album = item.get("collectionName", album)
                    real_year = item.get("releaseDate", "")[:4] or year
                    return art or cover_url, real_album or album, real_year or year
        except Exception:
            pass

        return cover_url, album, year

