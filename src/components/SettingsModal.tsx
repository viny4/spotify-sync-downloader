import React, { useState } from "react";
import { KeyRound, ExternalLink, X, ShieldCheck } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clientId: string, clientSecret: string) => Promise<boolean>;
  apiConfigured: boolean;
  clientIdPreview?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  apiConfigured,
  clientIdPreview,
}) => {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !clientSecret.trim()) return;

    setIsSaving(true);
    try {
      const success = await onSave(clientId.trim(), clientSecret.trim());
      if (success) {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#0f1422",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          padding: "28px",
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <KeyRound size={20} style={{ color: "var(--primary)" }} />
            <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#fff" }}>
              Spotify API Credentials (1,000+ Songs)
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 14px",
            borderRadius: "var(--radius-xs)",
            background: apiConfigured ? "rgba(29, 185, 84, 0.12)" : "rgba(56, 189, 248, 0.12)",
            border: `1px solid ${apiConfigured ? "rgba(29, 185, 84, 0.3)" : "rgba(56, 189, 248, 0.3)"}`,
            marginBottom: "16px",
          }}
        >
          <ShieldCheck size={18} style={{ color: apiConfigured ? "var(--primary)" : "var(--accent-cyan)" }} />
          <div style={{ fontSize: "12.5px" }}>
            <span style={{ fontWeight: "700", color: "#fff" }}>
              {apiConfigured ? "Active: Spotify Developer API" : "Mode: Public Embed Scraping"}
            </span>
            <div style={{ color: "var(--text-muted)", fontSize: "11.5px" }}>
              {apiConfigured
                ? `Unlimited pagination enabled (${clientIdPreview})`
                : "Scrapes without keys, but capped at 100 tracks per playlist."}
            </div>
          </div>
        </div>

        <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "20px" }}>
          By default, SpotFlow uses public embed scraping (capped at 100 songs). Adding your free{" "}
          <strong style={{ color: "#fff" }}>Spotify Developer API keys</strong> enables unlimited pagination to extract and download playlists with{" "}
          <strong style={{ color: "var(--primary)" }}>1,000+ tracks</strong>!
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
              Spotify Client ID
            </label>
            <input
              type="text"
              className="input-base"
              style={{ width: "100%" }}
              placeholder="Paste Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
              Spotify Client Secret
            </label>
            <input
              type="password"
              className="input-base"
              style={{ width: "100%" }}
              placeholder="Paste Client Secret"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              required
            />
          </div>

          <div style={{ fontSize: "12px", color: "var(--text-dim)", display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
            <span>Keys are 100% free at</span>
            <a
              href="https://developer.spotify.com/dashboard"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--primary)", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "2px" }}
            >
              <span>developer.spotify.com/dashboard</span>
              <ExternalLink size={11} />
            </a>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn btn-primary btn-sm">
              {isSaving ? "Saving..." : "Save Credentials"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
