import React from "react";
import { FolderOpen, Settings, Clock, Music, Download, Radio } from "lucide-react";

interface HeaderProps {
  activeTab: "studio" | "crons" | "library";
  setActiveTab: (tab: "studio" | "crons" | "library") => void;
  apiConfigured: boolean;
  activeCronsCount: number;
  downloadedFilesCount: number;
  onOpenSettings: () => void;
  onOpenFolder: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  apiConfigured,
  activeCronsCount,
  downloadedFilesCount,
  onOpenSettings,
  onOpenFolder,
}) => {
  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        marginBottom: "32px",
        paddingBottom: "20px",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              background: "linear-gradient(135deg, #1db954 0%, #0d682c 100%)",
              borderRadius: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 24px var(--primary-glow)",
            }}
          >
            <div className="equalizer">
              <span className="eq-bar" />
              <span className="eq-bar" />
              <span className="eq-bar" />
              <span className="eq-bar" />
            </div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  fontSize: "22px",
                  fontWeight: "800",
                  letterSpacing: "-0.5px",
                  color: "#fff",
                }}
              >
                Spot<span style={{ color: "var(--primary)" }}>Flow</span>
              </span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  padding: "2px 7px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.08)",
                  color: "var(--text-muted)",
                  letterSpacing: "0.8px",
                }}
              >
                Bun + React 19
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "1px" }}>
              High-Speed Spotify Downloader & Cron Sync Studio
            </div>
          </div>
        </div>

        {/* Status Pills & Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={onOpenSettings}
            className={`badge ${apiConfigured ? "badge-green" : "badge-cyan"}`}
            style={{ cursor: "pointer", border: "none" }}
            title="Click to manage Spotify Developer API keys"
          >
            <Radio size={12} />
            {apiConfigured ? "Spotify Web API (1,000+ tracks)" : "⚡ Embed Mode (100 max)"}
          </button>

          <button onClick={onOpenSettings} className="btn btn-secondary btn-sm">
            <Settings size={14} />
            <span>API Settings</span>
          </button>

          <button onClick={onOpenFolder} className="btn btn-secondary btn-sm">
            <FolderOpen size={14} />
            <span>Downloads Folder</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          background: "rgba(10, 14, 24, 0.6)",
          padding: "5px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-subtle)",
          width: "fit-content",
        }}
      >
        <button
          onClick={() => setActiveTab("studio")}
          className="btn btn-sm"
          style={{
            background: activeTab === "studio" ? "var(--primary)" : "transparent",
            color: activeTab === "studio" ? "#060911" : "var(--text-muted)",
            fontWeight: activeTab === "studio" ? "700" : "500",
          }}
        >
          <Download size={14} />
          <span>Downloader Studio</span>
        </button>

        <button
          onClick={() => setActiveTab("crons")}
          className="btn btn-sm"
          style={{
            background: activeTab === "crons" ? "var(--primary)" : "transparent",
            color: activeTab === "crons" ? "#060911" : "var(--text-muted)",
            fontWeight: activeTab === "crons" ? "700" : "500",
          }}
        >
          <Clock size={14} />
          <span>Crons & Auto-Sync</span>
          {activeCronsCount > 0 && (
            <span
              style={{
                background: activeTab === "crons" ? "#060911" : "var(--primary)",
                color: activeTab === "crons" ? "#fff" : "#060911",
                fontSize: "10px",
                fontWeight: "800",
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              {activeCronsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("library")}
          className="btn btn-sm"
          style={{
            background: activeTab === "library" ? "var(--primary)" : "transparent",
            color: activeTab === "library" ? "#060911" : "var(--text-muted)",
            fontWeight: activeTab === "library" ? "700" : "500",
          }}
        >
          <Music size={14} />
          <span>Music Library</span>
          {downloadedFilesCount > 0 && (
            <span
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "var(--text-main)",
                fontSize: "10px",
                fontWeight: "700",
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              {downloadedFilesCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
