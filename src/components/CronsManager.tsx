import React, { useState } from "react";
import { Clock, Plus, Play, Pause, Trash2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import type { CronJob, SyncLog } from "../types";

interface CronsManagerProps {
  jobs: CronJob[];
  history: SyncLog[];
  onAddJob: (job: { name: string; url: string; cronExpr: string; quality: number }) => Promise<void>;
  onToggleJob: (id: string) => Promise<void>;
  onDeleteJob: (id: string) => Promise<void>;
  onRunNow: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export const CronsManager: React.FC<CronsManagerProps> = ({
  jobs,
  history,
  onAddJob,
  onToggleJob,
  onDeleteJob,
  onRunNow,
  onRefresh,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [preset, setPreset] = useState("0 */6 * * *");
  const [customCron, setCustomCron] = useState("");
  const [quality, setQuality] = useState(320);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  const cronOptions = [
    { label: "Every 1 Hour (0 * * * *)", value: "0 * * * *" },
    { label: "Every 6 Hours (0 */6 * * *)", value: "0 */6 * * *" },
    { label: "Every 12 Hours (0 */12 * * *)", value: "0 */12 * * *" },
    { label: "Daily at Midnight (0 0 * * *)", value: "0 0 * * *" },
    { label: "Daily at 8:00 AM (0 8 * * *)", value: "0 8 * * *" },
    { label: "Weekly on Sunday (0 0 * * 0)", value: "0 0 * * 0" },
    { label: "Custom Expression", value: "custom" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCron = preset === "custom" ? customCron.trim() : preset;
    if (!name.trim() || !url.trim() || !finalCron) return;

    setIsSubmitting(true);
    try {
      await onAddJob({
        name: name.trim(),
        url: url.trim(),
        cronExpr: finalCron,
        quality,
      });
      setName("");
      setUrl("");
      setShowAddForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunNow = async (id: string) => {
    setRunningJobId(id);
    try {
      await onRunNow(id);
    } finally {
      setRunningJobId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Intro Header */}
      <div
        className="glass-panel"
        style={{
          padding: "24px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <Clock size={22} style={{ color: "var(--primary)" }} />
            <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#fff" }}>
              Automated Playlist Sync & Cron Schedules
            </h2>
          </div>
          <p style={{ fontSize: "13.5px", color: "var(--text-muted)", maxWidth: "700px" }}>
            Set periodic cron schedules for your favorite playlists. The Bun background engine periodically scans Spotify, detects newly added tracks, and automatically downloads only the new additions without re-downloading existing songs.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onRefresh} className="btn btn-secondary btn-sm">
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary"
            style={{ padding: "9px 16px" }}
          >
            <Plus size={15} />
            <span>{showAddForm ? "Cancel" : "Add New Schedule"}</span>
          </button>
        </div>
      </div>

      {/* Add Schedule Form */}
      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="glass-panel"
          style={{
            padding: "24px",
            border: "1px solid var(--primary-glow)",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#fff" }}>
            Schedule New Playlist Auto-Sync
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                Schedule Name
              </label>
              <input
                type="text"
                className="input-base"
                style={{ width: "100%" }}
                placeholder="e.g. Daily Hits Auto-Sync"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                Spotify Playlist URL
              </label>
              <input
                type="url"
                className="input-base"
                style={{ width: "100%" }}
                placeholder="https://open.spotify.com/playlist/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                Sync Frequency
              </label>
              <select
                className="input-base"
                style={{ width: "100%", cursor: "pointer" }}
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
              >
                {cronOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} style={{ background: "#0f1422" }}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {preset === "custom" && (
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                  Custom Cron Expression (min hour day month dow)
                </label>
                <input
                  type="text"
                  className="input-base"
                  style={{ width: "100%" }}
                  placeholder="e.g. */30 * * * *"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                Audio Bitrate
              </label>
              <select
                className="input-base"
                style={{ width: "100%", cursor: "pointer" }}
                value={quality}
                onChange={(e) => setQuality(parseInt(e.target.value, 10))}
              >
                <option value="320" style={{ background: "#0f1422" }}>320 kbps (Extreme Quality)</option>
                <option value="256" style={{ background: "#0f1422" }}>256 kbps (High Quality)</option>
                <option value="192" style={{ background: "#0f1422" }}>192 kbps (Standard)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary btn-sm"
            >
              {isSubmitting ? "Saving..." : "Create Schedule"}
            </button>
          </div>
        </form>
      )}

      {/* Schedules List */}
      <div>
        <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#fff", marginBottom: "14px" }}>
          Active Sync Tasks ({jobs.length})
        </h3>

        {jobs.length === 0 ? (
          <div
            className="glass-panel"
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "var(--text-dim)",
              fontSize: "14px",
            }}
          >
            No scheduled sync tasks yet. Click <b>"Add New Schedule"</b> above to schedule periodic playlist syncing.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {jobs.map((job) => {
              const isRunning = runningJobId === job.id || job.lastRunStatus === "running";

              return (
                <div
                  key={job.id}
                  className="glass-panel"
                  style={{
                    padding: "18px 24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "16px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxWidth: "600px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "16px", fontWeight: "700", color: "#fff" }}>
                        {job.name}
                      </span>
                      <span
                        className={`badge ${job.enabled ? "badge-green" : "badge-amber"}`}
                        style={{ fontSize: "10px", padding: "2px 7px" }}
                      >
                        {job.enabled ? "ACTIVE" : "PAUSED"}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontFamily: "'JetBrains Mono', monospace",
                          color: "var(--accent-cyan)",
                          background: "rgba(56, 189, 248, 0.1)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        {job.cronExpr}
                      </span>
                    </div>

                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: "12.5px",
                        color: "var(--text-dim)",
                        textDecoration: "none",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {job.url}
                    </a>

                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      {job.nextRun && (
                        <span>
                          Next Run: <b style={{ color: "#fff" }}>{new Date(job.nextRun).toLocaleTimeString()}</b>
                        </span>
                      )}
                      {job.lastRun && (
                        <span>
                          Last Run: {new Date(job.lastRun).toLocaleTimeString()} (
                          <span style={{ color: job.lastRunStatus === "success" ? "var(--primary)" : "var(--accent-rose)" }}>
                            {job.lastRunStatus}
                          </span>
                          )
                        </span>
                      )}
                      {job.lastRunMessage && (
                        <span style={{ color: "var(--text-dim)" }}>• {job.lastRunMessage}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      onClick={() => handleRunNow(job.id)}
                      disabled={isRunning}
                      className="btn btn-secondary btn-sm"
                      title="Trigger sync immediately"
                    >
                      {isRunning ? (
                        <>
                          <div className="spinner" style={{ width: "12px", height: "12px" }} />
                          <span>Syncing...</span>
                        </>
                      ) : (
                        <>
                          <Play size={13} style={{ color: "var(--primary)" }} />
                          <span>Sync Now</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => onToggleJob(job.id)}
                      className="btn btn-secondary btn-sm"
                      title={job.enabled ? "Pause schedule" : "Resume schedule"}
                    >
                      {job.enabled ? <Pause size={13} /> : <Play size={13} />}
                      <span>{job.enabled ? "Pause" : "Resume"}</span>
                    </button>

                    <button
                      onClick={() => onDeleteJob(job.id)}
                      className="btn btn-danger btn-sm"
                      title="Delete schedule"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sync Execution History */}
      {history.length > 0 && (
        <div className="glass-panel" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#fff", marginBottom: "12px" }}>
            Recent Sync History
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {history.slice(0, 10).map((log) => (
              <div
                key={log.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-xs)",
                  background: "rgba(10, 14, 24, 0.6)",
                  fontSize: "12.5px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {log.status === "success" ? (
                    <CheckCircle2 size={15} style={{ color: "var(--primary)" }} />
                  ) : log.status === "error" ? (
                    <AlertTriangle size={15} style={{ color: "var(--accent-rose)" }} />
                  ) : (
                    <div className="spinner" style={{ width: "13px", height: "13px" }} />
                  )}
                  <span style={{ fontWeight: "600", color: "#fff" }}>{log.jobName}</span>
                  <span style={{ color: "var(--text-muted)" }}>{log.message}</span>
                </div>
                <span style={{ color: "var(--text-dim)", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
