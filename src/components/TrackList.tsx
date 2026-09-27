import React from "react";
import { Download, Check, AlertCircle, Music, Clock } from "lucide-react";
import type { Track, DownloadProgress } from "../types";

interface TrackListProps {
  tracks: Track[];
  selectedTrackIds: Set<string>;
  downloadStatuses: Map<string, DownloadProgress>;
  onToggleSelect: (id: string) => void;
  onDownloadSingle: (track: Track) => void;
}

export const TrackList: React.FC<TrackListProps> = ({
  tracks,
  selectedTrackIds,
  downloadStatuses,
  onToggleSelect,
  onDownloadSingle,
}) => {
  if (tracks.length === 0) {
    return (
      <div
        className="glass-panel"
        style={{
          padding: "48px 20px",
          textAlign: "center",
          color: "var(--text-dim)",
          fontSize: "14px",
        }}
      >
        No tracks match your search filter.
      </div>
    );
  }

  return (
    <div
      className="glass-panel"
      style={{
        overflow: "hidden",
        marginBottom: "32px",
      }}
    >
      {/* Table Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "40px 40px 52px 1fr 100px 140px 60px",
          gap: "12px",
          alignItems: "center",
          padding: "14px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          fontSize: "12px",
          fontWeight: "700",
          color: "var(--text-dim)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        <span>#</span>
        <span>Sel</span>
        <span>Art</span>
        <span>Title & Artist</span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Clock size={12} />
          <span>Duration</span>
        </span>
        <span>Status</span>
        <span style={{ textAlign: "right" }}>Action</span>
      </div>

      {/* Rows */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {tracks.map((track, index) => {
          const trackId = track.id || `${track.artist}_${track.title}`;
          const isSelected = selectedTrackIds.has(trackId);
          const progressInfo = downloadStatuses.get(trackId);
          const status = progressInfo?.status;
          const pct = progressInfo?.progress || 0;

          return (
            <div
              key={trackId}
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "40px 40px 52px 1fr 100px 140px 60px",
                gap: "12px",
                alignItems: "center",
                padding: "10px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                background: isSelected ? "rgba(29, 185, 84, 0.04)" : "transparent",
                transition: "var(--transition)",
              }}
            >
              {/* Index */}
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--text-dim)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {index + 1}
              </div>

              {/* Checkbox */}
              <div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(trackId)}
                  style={{
                    accentColor: "var(--primary)",
                    cursor: "pointer",
                    width: "15px",
                    height: "15px",
                  }}
                />
              </div>

              {/* Thumbnail */}
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "6px",
                  overflow: "hidden",
                  background: "#182234",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {track.cover_url ? (
                  <img
                    src={track.cover_url}
                    alt={track.title}
                    loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Music size={18} style={{ color: "var(--text-dim)" }} />
                )}
              </div>

              {/* Title & Artist */}
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#fff",
                    marginBottom: "2px",
                  }}
                >
                  {track.title}
                </div>
                <div style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
                  {track.artist} {track.album ? `• ${track.album}` : ""}
                </div>
              </div>

              {/* Duration */}
              <div
                style={{
                  fontSize: "12.5px",
                  color: "var(--text-dim)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {track.duration_formatted || "--:--"}
              </div>

              {/* Status Badge */}
              <div>
                {status === "completed" ? (
                  <span
                    className="badge badge-green"
                    style={{ fontSize: "11px", padding: "3px 8px" }}
                  >
                    <Check size={12} />
                    <span>Done</span>
                  </span>
                ) : status === "downloading" ? (
                  <span
                    className="badge badge-cyan"
                    style={{ fontSize: "11px", padding: "3px 8px" }}
                  >
                    <div className="spinner" style={{ width: "10px", height: "10px" }} />
                    <span>{pct ? `${Math.round(pct)}%` : "Downloading"}</span>
                  </span>
                ) : status === "searching" ? (
                  <span
                    className="badge badge-purple"
                    style={{ fontSize: "11px", padding: "3px 8px" }}
                  >
                    <div className="spinner" style={{ width: "10px", height: "10px" }} />
                    <span>Matching</span>
                  </span>
                ) : status === "tagging" ? (
                  <span
                    className="badge badge-amber"
                    style={{ fontSize: "11px", padding: "3px 8px" }}
                  >
                    <div className="spinner" style={{ width: "10px", height: "10px" }} />
                    <span>Tagging</span>
                  </span>
                ) : status === "failed" ? (
                  <span
                    className="badge"
                    style={{
                      background: "rgba(244, 63, 94, 0.15)",
                      color: "#fb7185",
                      border: "1px solid rgba(244, 63, 94, 0.3)",
                      fontSize: "11px",
                      padding: "3px 8px",
                    }}
                    title={progressInfo?.message || "Failed"}
                  >
                    <AlertCircle size={12} />
                    <span>Failed</span>
                  </span>
                ) : status === "queued" ? (
                  <span
                    style={{
                      fontSize: "11.5px",
                      color: "var(--text-dim)",
                      padding: "3px 8px",
                      borderRadius: "var(--radius-full)",
                      background: "rgba(255,255,255,0.05)",
                    }}
                  >
                    Queued
                  </span>
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Ready</span>
                )}
              </div>

              {/* Action Button */}
              <div style={{ textAlign: "right" }}>
                <button
                  onClick={() => onDownloadSingle(track)}
                  disabled={
                    status === "downloading" || status === "searching" || status === "tagging"
                  }
                  className="btn btn-secondary btn-sm"
                  style={{
                    padding: "6px 8px",
                    borderRadius: "6px",
                  }}
                  title="Download single track"
                >
                  <Download size={13} />
                </button>
              </div>

              {/* Progress bar line under row */}
              {status && status !== "completed" && status !== "failed" && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    height: "2px",
                    width: `${pct || 10}%`,
                    background: "linear-gradient(90deg, var(--primary), var(--accent-cyan))",
                    transition: "width 0.3s ease",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
