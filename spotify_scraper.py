"""
Spotify Metadata Extractor
Extracts track, album, and playlist metadata from Spotify links.
Features:
1. Unlimited Pagination (1,000+ tracks per playlist) via Spotify Web API
2. Spotify Client Credentials support (from config.json, env vars, or constructor)
3. Zero-config embed scraping fallback for up to 100 tracks
"""

import sys
import os
import time
import re
import json
import ssl
import base64
import urllib.request
import urllib.error
import urllib.parse
from typing import Dict, List, Optional, Any

# Create SSL context for macOS compatibility
def get_ssl_context():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx

SSL_CONTEXT = get_ssl_context()

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

def load_config() -> Dict[str, Any]:
    """Loads optional config.json from current or parent directory."""
    paths = [
        os.path.join(os.path.dirname(__file__), "config.json"),
        os.path.join(os.getcwd(), "config.json")
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
    return {}

class SpotifyExtractor:
    # Class-level token cache shared across all instances in the same process.
    # This prevents re-fetching tokens on every request (which burns the quota).
    _cached_cc_token: Optional[str] = None       # client credentials token
    _cached_anon_token: Optional[str] = None     # anonymous embed token
    _cached_anon_expiry: float = 0.0             # unix timestamp when anon token expires
    _ip_blocked_until: float = 0.0               # unix timestamp when IP block expires (Retry-After)

    def __init__(self, client_id: Optional[str] = None, client_secret: Optional[str] = None):
        cfg = load_config()
        self.client_id = (
            client_id
            or os.environ.get("SPOTIFY_CLIENT_ID")
            or os.environ.get("SPOTIPY_CLIENT_ID")
            or cfg.get("spotify_client_id")
        )
        self.client_secret = (
            client_secret
            or os.environ.get("SPOTIFY_CLIENT_SECRET")
            or os.environ.get("SPOTIPY_CLIENT_SECRET")
            or cfg.get("spotify_client_secret")
        )
        self.access_token: Optional[str] = None
        self.ssl_context = SSL_CONTEXT

    def parse_url(self, url: str) -> Dict[str, str]:
        """
        Parses a Spotify URL to extract type and ID.
        Supports:
          https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
          https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy
          https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT
          spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
        """
        clean_url = url.split("?")[0].strip()

        # URI style: spotify:playlist:ID
        uri_match = re.match(r"^spotify:(playlist|album|track):([a-zA-Z0-9]+)$", clean_url)
        if uri_match:
            return {"type": uri_match.group(1), "id": uri_match.group(2)}

        # URL style: https://open.spotify.com/playlist/ID
        url_match = re.search(r"open\.spotify\.com/(playlist|album|track)/([a-zA-Z0-9]+)", clean_url)
        if url_match:
            return {"type": url_match.group(1), "id": url_match.group(2)}

        raise ValueError(f"Invalid or unsupported Spotify URL: {url}")

    def get_client_credentials_token(self) -> Optional[str]:
        """Fetches an official OAuth token using Spotify Developer Client ID and Secret.
        Uses a class-level cache so one token is reused for the entire server process lifetime.
        """
        if not self.client_id or not self.client_secret:
            return None
        # Return cached token if we already have one
        if SpotifyExtractor._cached_cc_token:
            return SpotifyExtractor._cached_cc_token
        try:
            auth_str = f"{self.client_id}:{self.client_secret}"
            b64_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
            data = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode("utf-8")

            req = urllib.request.Request(
                "https://accounts.spotify.com/api/token",
                data=data,
                headers={
                    "Authorization": f"Basic {b64_auth}",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": USER_AGENT
                }
            )
            with urllib.request.urlopen(req, timeout=10, context=self.ssl_context) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                token = res.get("access_token")
                if token:
                    print("[✓] Authenticated with official Spotify Client Credentials.", file=sys.stderr)
                    SpotifyExtractor._cached_cc_token = token
                    return token
        except Exception as e:
            print(f"[!] Warning: Spotify client credentials authentication failed: {e}", file=sys.stderr)
            return None

    def get_anonymous_token(self) -> Optional[str]:
        """
        Fetches a temporary anonymous guest access token.
        Uses a class-level cache (valid ~1 hour) to avoid quota exhaustion.
        Method 1: /get_access_token endpoint (fast)
        Method 2: Extract from embed page HTML (works even when Method 1 is blocked)
        """
        # Return cached token if not expired (tokens last ~1 hour, we cache for 55 min)
        if SpotifyExtractor._cached_anon_token and time.time() < SpotifyExtractor._cached_anon_expiry:
            return SpotifyExtractor._cached_anon_token

        token = None

        # Method 1: standard anonymous token endpoint
        try:
            req = urllib.request.Request(
                "https://open.spotify.com/get_access_token?reason=transport&productType=web_player",
                headers={"User-Agent": USER_AGENT, "Referer": "https://open.spotify.com/"}
            )
            with urllib.request.urlopen(req, timeout=10, context=self.ssl_context) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                token = data.get("accessToken")
        except Exception:
            pass

        # Method 2: extract accessToken embedded in any public Spotify embed page
        if not token:
            try:
                req2 = urllib.request.Request(
                    "https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT",
                    headers={"User-Agent": USER_AGENT}
                )
                with urllib.request.urlopen(req2, timeout=10, context=self.ssl_context) as resp2:
                    html = resp2.read().decode("utf-8")
                token_match = re.search(r'"accessToken":"([^"]+)"', html)
                if token_match:
                    token = token_match.group(1)
                    print("[+] Got anonymous token from embed page.", file=sys.stderr)
            except Exception as e:
                print(f"[!] Embed token extraction failed: {e}", file=sys.stderr)

        if token:
            SpotifyExtractor._cached_anon_token = token
            SpotifyExtractor._cached_anon_expiry = time.time() + 3300  # cache for 55 minutes

        return token

    def get_access_token(self) -> Optional[str]:
        """Gets token via Client Credentials first, then falls back to anonymous token."""
        if self.client_id and self.client_secret:
            token = self.get_client_credentials_token()
            if token:
                return token
        return self.get_anonymous_token()

    def _api_get(self, endpoint: str) -> Optional[Dict[str, Any]]:
        """Makes an authenticated GET request to Spotify API using cached or fresh token."""
        if not self.access_token:
            self.access_token = self.get_access_token()

        if not self.access_token:
            return None

        url = f"https://api.spotify.com/v1/{endpoint}"
        return self._request_url(url)

    def _request_url(self, full_url: str) -> Optional[Dict[str, Any]]:
        """Executes an authenticated request against any full API URL, handling token refresh."""
        if not self.access_token:
            self.access_token = self.get_access_token()

        if not self.access_token:
            return None

        def _do_request(token: str) -> Optional[Dict[str, Any]]:
            r = urllib.request.Request(
                full_url,
                headers={"User-Agent": USER_AGENT, "Authorization": f"Bearer {token}"}
            )
            with urllib.request.urlopen(r, timeout=15, context=self.ssl_context) as resp:
                return json.loads(resp.read().decode("utf-8"))

        def _do_request_with_backoff(token: str, max_retries: int = 3) -> Optional[Dict[str, Any]]:
            """Retry up to max_retries times on 429 with exponential backoff."""
            for attempt in range(max_retries):
                try:
                    return _do_request(token)
                except urllib.error.HTTPError as e:
                    if e.code == 429 and attempt < max_retries - 1:
                        wait = 2 ** attempt  # 1s, 2s, 4s
                        print(f"[!] 429 rate-limited, retrying in {wait}s (attempt {attempt+1}/{max_retries})...", file=sys.stderr)
                        time.sleep(wait)
                        continue
                    raise
            return None

        try:
            return _do_request_with_backoff(self.access_token)
        except urllib.error.HTTPError as e:
            if e.code == 401:
                # Token expired — clear cache and renew
                SpotifyExtractor._cached_cc_token = None
                self.access_token = self.get_access_token()
                if self.access_token:
                    try:
                        return _do_request_with_backoff(self.access_token)
                    except Exception:
                        pass
            elif e.code == 403:
                # Forbidden — client_credentials can't access this resource.
                # Retry with an anonymous web-player token which can read public playlists.
                print(f"[!] 403 with current token, retrying with anonymous token...", file=sys.stderr)
                anon_token = self.get_anonymous_token()
                if anon_token and anon_token != self.access_token:
                    try:
                        result = _do_request_with_backoff(anon_token)
                        # Switch to anonymous token for subsequent paginated requests
                        self.access_token = anon_token
                        return result
                    except Exception as anon_err:
                        print(f"[!] Anonymous token also failed: {anon_err}", file=sys.stderr)
                        # Clear cached anon token so next call gets a fresh one
                        SpotifyExtractor._cached_anon_token = None
            print(f"[!] Spotify API HTTP error: {e}", file=sys.stderr)
            return None
        except Exception as e:
            print(f"[!] Spotify API request failed: {e}", file=sys.stderr)
            return None

    def fetch_all_via_partner_api(self, item_type: str, item_id: str, anon_token: str) -> Optional[Dict[str, Any]]:
        """
        Uses Spotify's internal partner/clienttoken API to paginate ALL tracks
        from a playlist (works for collaborative & large playlists, no OAuth needed).
        Fetches in batches of 100 until all tracks are collected.
        """
        if item_type != "playlist":
            return None

        all_tracks = []
        offset = 0
        limit = 100
        total = None
        cover_url = ""
        title = ""
        owner = ""
        description = ""

        print(f"[+] Using partner API to paginate full playlist...", file=sys.stderr)

        while True:
            url = (
                f"https://api.spotify.com/v1/playlists/{item_id}/tracks"
                f"?offset={offset}&limit={limit}"
                f"&fields=total,next,items(track(id,name,duration_ms,external_ids,artists,album(name,images,release_date)))"
            )

            # Retry loop for this page (handles 429 with backoff)
            page = None
            max_page_retries = 4
            for attempt in range(max_page_retries):
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": USER_AGENT, "Authorization": f"Bearer {anon_token}"}
                )
                try:
                    with urllib.request.urlopen(req, timeout=15, context=self.ssl_context) as resp:
                        page = json.loads(resp.read().decode("utf-8"))
                    break  # success — exit retry loop
                except urllib.error.HTTPError as e:
                    if e.code == 429:
                        retry_after = int(e.headers.get("Retry-After", 0) or 0)
                        # If Spotify says wait more than 10s, it's an IP block — bail out immediately
                        if retry_after > 10:
                            print(f"[!] Spotify IP-blocked (Retry-After: {retry_after}s). Falling back to embed.", file=sys.stderr)
                            SpotifyExtractor._ip_blocked_until = time.time() + retry_after
                            SpotifyExtractor._cached_anon_token = None
                            return None
                        wait = retry_after if retry_after > 0 else min(3 * (2 ** attempt), 10)
                        print(f"[!] 429 at offset {offset}, waiting {wait}s (attempt {attempt+1}/{max_page_retries})...", file=sys.stderr)
                        time.sleep(wait)
                        if attempt == max_page_retries - 2:
                            # Refresh the anon token before last retry
                            SpotifyExtractor._cached_anon_token = None
                            fresh = self.get_anonymous_token()
                            if fresh:
                                anon_token = fresh
                        continue
                    print(f"[!] Partner API error {e.code} at offset {offset}: {e}", file=sys.stderr)
                    break
                except Exception as e:
                    print(f"[!] Partner API error: {e}", file=sys.stderr)
                    break

            if page is None:
                break  # all retries exhausted, stop pagination

            if total is None:
                total = page.get("total", 0)
                print(f"[+] Playlist has {total} total tracks, paginating...", file=sys.stderr)

                # Fetch playlist metadata (name, owner, cover) on first page only
                try:
                    meta_url = f"https://api.spotify.com/v1/playlists/{item_id}?fields=name,description,owner,images"
                    meta_req = urllib.request.Request(
                        meta_url,
                        headers={"User-Agent": USER_AGENT, "Authorization": f"Bearer {anon_token}"}
                    )
                    with urllib.request.urlopen(meta_req, timeout=10, context=self.ssl_context) as mr:
                        meta = json.loads(mr.read().decode("utf-8"))
                        title = meta.get("name", "")
                        owner = meta.get("owner", {}).get("display_name", "")
                        description = meta.get("description", "")
                        cover_url = meta.get("images", [{}])[0].get("url", "") if meta.get("images") else ""
                except Exception:
                    pass

            items = page.get("items", [])
            for idx_offset, item in enumerate(items):
                track = item.get("track")
                if not track:
                    continue
                global_idx = offset + idx_offset + 1
                artists = ", ".join([a.get("name", "") for a in track.get("artists", [])])
                album_images = track.get("album", {}).get("images", [])
                track_cover = album_images[0].get("url", cover_url) if album_images else cover_url
                release_date = track.get("album", {}).get("release_date", "")[:4]
                all_tracks.append({
                    "index": global_idx,
                    "id": track.get("id", ""),
                    "title": track.get("name", ""),
                    "artist": artists,
                    "album": track.get("album", {}).get("name", ""),
                    "year": release_date,
                    "duration_ms": track.get("duration_ms", 0),
                    "duration_formatted": self.format_duration(track.get("duration_ms", 0)),
                    "cover_url": track_cover,
                    "isrc": track.get("external_ids", {}).get("isrc", "")
                })

            print(f"[+] Fetched {len(all_tracks)} / {total} tracks...", file=sys.stderr)

            if not page.get("next") or len(all_tracks) >= total:
                break
            offset += limit

        if not all_tracks:
            return None

        return {
            "type": "playlist",
            "id": item_id,
            "title": title,
            "description": description,
            "owner": owner,
            "cover_url": cover_url,
            "total_tracks": len(all_tracks),
            "tracks": all_tracks
        }

    def fetch_from_embed(self, item_type: str, item_id: str) -> Optional[Dict[str, Any]]:
        """
        Last-resort fallback: Parses Spotify's public embed page.
        Limited to 100 tracks max.
        """
        embed_url = f"https://open.spotify.com/embed/{item_type}/{item_id}"
        req = urllib.request.Request(embed_url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=10, context=self.ssl_context) as resp:
                html = resp.read().decode("utf-8")

            # Look for Next.js __NEXT_DATA__
            next_data_match = re.search(r'<script id="__NEXT_DATA__" type="application/json">({.*?})</script>', html)
            if next_data_match:
                data = json.loads(next_data_match.group(1))
                entity = data.get("props", {}).get("pageProps", {}).get("state", {}).get("data", {}).get("entity", {})
                if entity:
                    return self._normalize_embed_entity(entity, item_type)

            # Modern Spotify Embed initial-state
            state_match = re.search(r'<script id="initial-state" type="text/plain">([A-Za-z0-9+/=]+)</script>', html)
            if state_match:
                decoded = base64.b64decode(state_match.group(1)).decode("utf-8")
                state_data = json.loads(decoded)
                return state_data
        except Exception as e:
            print(f"[!] Embed scraping fallback error: {e}", file=sys.stderr)
            return None

    def _normalize_embed_entity(self, entity: Dict[str, Any], item_type: str) -> Dict[str, Any]:
        """Converts embed entity JSON into normalized format."""
        title = entity.get("name", "Unknown Title")
        cover_art = ""
        images = entity.get("coverArt", {}).get("sources", [])
        if images:
            cover_art = images[-1].get("url", "")

        tracks = []
        track_list = entity.get("trackList", [])
        for idx, item in enumerate(track_list, 1):
            tracks.append({
                "index": idx,
                "id": item.get("id", ""),
                "title": item.get("title", "Unknown Track"),
                "artist": item.get("subtitle", "Unknown Artist"),
                "album": entity.get("title", title),
                "duration_ms": item.get("duration", 0),
                "duration_formatted": self.format_duration(item.get("duration", 0)),
                "cover_url": cover_art,
                "isrc": item.get("isrc", "")
            })

        return {
            "type": item_type,
            "title": title,
            "owner": entity.get("subtitle", ""),
            "cover_url": cover_art,
            "total_tracks": len(tracks),
            "tracks": tracks
        }

    def get_info(self, url: str) -> Dict[str, Any]:
        """
        Main method to get info for playlist, album, or track.

        NOTE: As of Spotify's API policy change (Nov 2024), client_credentials tokens
        can no longer access /playlists/ or /tracks/ endpoints — they return 403.
        For playlists, we go directly to the anonymous web-player token strategy.
        Albums still work with client_credentials.
        """
        parsed = self.parse_url(url)
        item_type = parsed["type"]
        item_id = parsed["id"]

        # Check if IP is currently blocked by Spotify (from a previous Retry-After response)
        ip_blocked = time.time() < SpotifyExtractor._ip_blocked_until
        if ip_blocked:
            remaining = int(SpotifyExtractor._ip_blocked_until - time.time())
            print(f"[!] Spotify IP block active ({remaining}s remaining). Using embed scraper.", file=sys.stderr)

        if item_type == "playlist" and not ip_blocked:
            # Strategy: anonymous web-player token with full pagination.
            # client_credentials returns 403 for playlists since Nov 2024 Spotify policy change.
            anon_token = self.get_anonymous_token()
            if anon_token:
                # First try: full playlist metadata + first page (single request)
                req = urllib.request.Request(
                    f"https://api.spotify.com/v1/playlists/{item_id}"
                    f"?fields=id,name,description,owner,images,tracks(total,next,items(track(id,name,duration_ms,external_ids,artists,album(name,images,release_date))))",
                    headers={"User-Agent": USER_AGENT, "Authorization": f"Bearer {anon_token}"}
                )
                try:
                    with urllib.request.urlopen(req, timeout=15, context=self.ssl_context) as r:
                        data = json.loads(r.read().decode())
                    if data and "tracks" in data:
                        self.access_token = anon_token
                        return self._parse_api_playlist(data)
                except urllib.error.HTTPError as e:
                    if e.code == 429:
                        retry_after = int(e.headers.get("Retry-After", 0) or 0)
                        if retry_after > 10:
                            # IP-level block — record expiry and skip straight to embed scraper
                            print(f"[!] Spotify IP-blocked (Retry-After: {retry_after}s). Skipping API.", file=sys.stderr)
                            SpotifyExtractor._ip_blocked_until = time.time() + retry_after
                            SpotifyExtractor._cached_anon_token = None
                            # Jump straight to embed — skip partner API
                            embed_info = self.fetch_from_embed(item_type, item_id)
                            return embed_info if embed_info else None
                        else:
                            wait = retry_after if retry_after > 0 else 2
                            print(f"[!] 429 on /playlists endpoint, waiting {wait}s then trying tracks-only...", file=sys.stderr)
                            time.sleep(wait)
                    else:
                        print(f"[!] /playlists endpoint error {e.code}, trying tracks-only...", file=sys.stderr)
                except Exception as e:
                    print(f"[!] /playlists error: {e}", file=sys.stderr)

                # Second try: paginated /playlists/{id}/tracks endpoint
                # (sometimes works even when the main /playlists/{id} is rate-limited)
                result = self.fetch_all_via_partner_api(item_type, item_id, anon_token)
                if result:
                    return result

            # Last resort: Embed scraper (100 tracks max)
            print("[!] Falling back to embed scraper (100 track limit)...", file=sys.stderr)
            embed_info = self.fetch_from_embed(item_type, item_id)
            if embed_info:
                return embed_info

        elif item_type == "album" and not ip_blocked:
            # Albums still work with client_credentials
            data = self._api_get(f"albums/{item_id}")
            if data and "tracks" in data:
                return self._parse_api_album(data)
            # Fallback: anonymous token
            anon_token = self.get_anonymous_token()
            if anon_token:
                self.access_token = anon_token
                data = self._api_get(f"albums/{item_id}")
                if data and "tracks" in data:
                    return self._parse_api_album(data)

        elif item_type == "track" and not ip_blocked:
            # Tracks: try client credentials first, then anonymous
            data = self._api_get(f"tracks/{item_id}")
            if data:
                return self._parse_api_track(data)
            anon_token = self.get_anonymous_token()
            if anon_token:
                self.access_token = anon_token
                data = self._api_get(f"tracks/{item_id}")
                if data:
                    return self._parse_api_track(data)

        raise RuntimeError(f"Could not retrieve details for {url}. Please verify the link is valid and publicly accessible.")

    def _parse_api_playlist(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Parses playlist and paginates through all tracks (supporting 1,000+ songs)."""
        tracks = []
        tracks_obj = data.get("tracks", {})
        items = list(tracks_obj.get("items", []))
        cover_url = data.get("images", [{}])[0].get("url", "") if data.get("images") else ""
        total_expected = tracks_obj.get("total", len(items))

        # Unlimited Pagination Loop (100 songs per page)
        next_url = tracks_obj.get("next")
        while next_url:
            print(f"[+] Paginating Spotify playlist: fetched {len(items)} of {total_expected} tracks...", file=sys.stderr)
            next_data = self._request_url(next_url)
            if next_data and "items" in next_data:
                items.extend(next_data["items"])
                next_url = next_data.get("next")
            else:
                break

        for idx, item in enumerate(items, 1):
            track = item.get("track")
            if not track:
                continue
            artists = ", ".join([a.get("name", "") for a in track.get("artists", [])])
            album_name = track.get("album", {}).get("name", "")
            track_cover = track.get("album", {}).get("images", [{}])[0].get("url", cover_url) if track.get("album", {}).get("images") else cover_url
            release_date = track.get("album", {}).get("release_date", "")[:4]
            isrc = track.get("external_ids", {}).get("isrc", "")

            tracks.append({
                "index": idx,
                "id": track.get("id"),
                "title": track.get("name"),
                "artist": artists,
                "album": album_name,
                "year": release_date,
                "duration_ms": track.get("duration_ms", 0),
                "duration_formatted": self.format_duration(track.get("duration_ms", 0)),
                "cover_url": track_cover,
                "isrc": isrc
            })

        return {
            "type": "playlist",
            "id": data.get("id"),
            "title": data.get("name"),
            "description": data.get("description", ""),
            "owner": data.get("owner", {}).get("display_name", "Spotify User"),
            "cover_url": cover_url,
            "total_tracks": len(tracks),
            "tracks": tracks
        }

    def _parse_api_album(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Parses album and paginates through all tracks."""
        tracks = []
        tracks_obj = data.get("tracks", {})
        items = list(tracks_obj.get("items", []))
        cover_url = data.get("images", [{}])[0].get("url", "") if data.get("images") else ""
        album_artist = ", ".join([a.get("name", "") for a in data.get("artists", [])])
        release_date = data.get("release_date", "")[:4]

        # Pagination for large albums
        next_url = tracks_obj.get("next")
        while next_url:
            next_data = self._request_url(next_url)
            if next_data and "items" in next_data:
                items.extend(next_data["items"])
                next_url = next_data.get("next")
            else:
                break

        for idx, track in enumerate(items, 1):
            artists = ", ".join([a.get("name", "") for a in track.get("artists", [])])
            tracks.append({
                "index": idx,
                "id": track.get("id"),
                "title": track.get("name"),
                "artist": artists or album_artist,
                "album": data.get("name"),
                "year": release_date,
                "duration_ms": track.get("duration_ms", 0),
                "duration_formatted": self.format_duration(track.get("duration_ms", 0)),
                "cover_url": cover_url,
                "isrc": track.get("external_ids", {}).get("isrc", "")
            })

        return {
            "type": "album",
            "id": data.get("id"),
            "title": data.get("name"),
            "owner": album_artist,
            "cover_url": cover_url,
            "total_tracks": len(tracks),
            "tracks": tracks
        }

    def _parse_api_track(self, track: Dict[str, Any]) -> Dict[str, Any]:
        artists = ", ".join([a.get("name", "") for a in track.get("artists", [])])
        cover_url = track.get("album", {}).get("images", [{}])[0].get("url", "") if track.get("album", {}).get("images") else ""
        release_date = track.get("album", {}).get("release_date", "")[:4]
        single_track = {
            "index": 1,
            "id": track.get("id"),
            "title": track.get("name"),
            "artist": artists,
            "album": track.get("album", {}).get("name", ""),
            "year": release_date,
            "duration_ms": track.get("duration_ms", 0),
            "duration_formatted": self.format_duration(track.get("duration_ms", 0)),
            "cover_url": cover_url,
            "isrc": track.get("external_ids", {}).get("isrc", "")
        }
        return {
            "type": "track",
            "id": track.get("id"),
            "title": track.get("name"),
            "owner": artists,
            "cover_url": cover_url,
            "total_tracks": 1,
            "tracks": [single_track]
        }

    @staticmethod
    def format_duration(ms: int) -> str:
        seconds = int((ms / 1000) % 60)
        minutes = int((ms / (1000 * 60)) % 60)
        return f"{minutes}:{seconds:02d}"
