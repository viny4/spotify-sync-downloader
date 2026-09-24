import React from "react";
import { Download, CheckSquare, Square, Search, Music2 } from "lucide-react";
import type { PlaylistInfo } from "../types";

interface PlaylistBannerProps {
  info: PlaylistInfo;
  selectedCount: number;
  totalCount: number;
  completedCount: number;
  filterText: string;
  setFilterText: (text: string) => void;
  onDownloadAll: () => void;
  onDownloadSelected: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export const PlaylistBanner: React.FC<PlaylistBannerProps> = ({
  info,
  selectedCount,
  totalCount,
  completedCount,
  filterText,
  setFilterText,
  onDownloadAll,
  onDownloadSelected,
  onSelectAll,
  onDeselectAll,
}) => {
  const isAllSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div
      className="glass-panel"
      style={{
        padding: "24px",
        marginBottom: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "24px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Cover Art */}
        <div
          style={{
            width: "140px",
            height: "140px",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
            boxShadow: "0 12px 30px rgba(0, 0, 0, 0.6)",
            background: "#121826",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {info.cover_url ? (
            <img
              src={info.cover_url}
              alt={info.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Music2 size={48} style={{ color: "var(--text-dim)" }} />
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: "260px" }}>
          <div
            style={{
              display: "inline-block",
              fontSize: "11px",
              fontWeight: "700",
              textTransform: "uppercase",
              padding: "3px 8px",
              borderRadius: "4px",
              background: "rgba(255, 255, 255, 0.08)",
              color: "var(--primary)",
              marginBottom: "8px",
              letterSpacing: "0.5px",
            }}
          >
            {info.type || "PLAYLIST"}
          </div>

          <h2
            style={{
              fontSize: "26px",
              fontWeight: "800",
              color: "#fff",
              marginBottom: "8px",
              lineHeight: 1.2,
            }}
          >
            {info.title}
          </h2>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13.5px",
              color: "var(--text-muted)",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: "#fff", fontWeight: "600" }}>{info.owner || "Spotify"}</span>
            <span>•</span>
            <span>{totalCount} tracks</span>
            {completedCount > 0 && (
              <>
                <span>•</span>
                <span style={{ color: "var(--primary)", fontWeight: "600" }}>
                  {completedCount} downloaded
                </span>
              </>
            )}
          </div>
        </div>

        {/* Batch Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "200px" }}>
          <button onClick={onDownloadAll} className="btn btn-primary" style={{ width: "100%" }}>
            <Download size={16} />
            <span>Download All ({totalCount})</span>
          </button>

          {selectedCount > 0 && selectedCount !== totalCount && (
            <button onClick={onDownloadSelected} className="btn btn-secondary" style={{ width: "100%" }}>
              <Download size={14} />
              <span>Download Selected ({selectedCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Selection Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          paddingTop: "16px",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={isAllSelected ? onDeselectAll : onSelectAll}
            className="btn btn-secondary btn-sm"
          >
            {isAllSelected ? <CheckSquare size={14} style={{ color: "var(--primary)" }} /> : <Square size={14} />}
            <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
          </button>
          <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>
            {selectedCount} of {totalCount} selected
          </span>
        </div>

        {/* Track Filter Input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(10, 14, 24, 0.8)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-xs)",
            padding: "6px 12px",
            width: "280px",
          }}
        >
          <Search size={14} style={{ color: "var(--text-dim)" }} />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search within playlist..."
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              fontSize: "12.5px",
              outline: "none",
              width: "100%",
            }}
          />
          {filterText && (
            <button
              onClick={() => setFilterText("")}
              style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "12px" }}
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
