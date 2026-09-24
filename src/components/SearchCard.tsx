import React, { useState } from "react";
import { Link2, Sparkles, SlidersHorizontal, ArrowRight } from "lucide-react";

interface SearchCardProps {
  onFetch: (url: string, quality: number) => Promise<void>;
  isLoading: boolean;
}

export const SearchCard: React.FC<SearchCardProps> = ({ onFetch, isLoading }) => {
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState(320);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onFetch(url.trim(), quality);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.includes("spotify.com")) {
        setUrl(text.trim());
      }
    } catch {}
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: "32px 28px",
        marginBottom: "28px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "280px",
          height: "280px",
          background: "radial-gradient(circle, rgba(29, 185, 84, 0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: "680px", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#fff", marginBottom: "8px" }}>
          Download Spotify Playlists, Albums & Tracks
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.5 }}>
          Paste any Spotify link below. SpotFlow extracts all tracks, streams high-definition 320 kbps audio, and embeds ID3 tags with full album artwork.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          {/* URL Input */}
          <div
            style={{
              flex: "1 1 360px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "rgba(10, 14, 24, 0.9)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 14px",
              transition: "var(--transition)",
            }}
          >
            <Link2 size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://open.spotify.com/playlist/... or album/..."
              required
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: "14px",
                width: "100%",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            {url ? (
              <button
                type="button"
                onClick={() => setUrl("")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                ✕
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePaste}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-muted)",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Paste Link
              </button>
            )}
          </div>

          {/* Quality Select */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(10, 14, 24, 0.9)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 14px",
            }}
          >
            <SlidersHorizontal size={16} style={{ color: "var(--text-muted)" }} />
            <select
              value={quality}
              onChange={(e) => setQuality(parseInt(e.target.value, 10))}
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: "13px",
                fontWeight: "600",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="320" style={{ background: "#0f1422" }}>320 kbps (Extreme)</option>
              <option value="256" style={{ background: "#0f1422" }}>256 kbps (High)</option>
              <option value="192" style={{ background: "#0f1422" }}>192 kbps (Standard)</option>
            </select>
          </div>

          {/* Fetch Button */}
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="btn btn-primary"
            style={{ padding: "12px 22px", height: "45px" }}
          >
            {isLoading ? (
              <>
                <div className="spinner" />
                <span>Fetching Tracks...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Fetch Collection</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
