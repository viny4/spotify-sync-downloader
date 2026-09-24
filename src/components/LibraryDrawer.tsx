import React, { useState, useRef } from "react";
import { Music, Play, Pause, FolderOpen, RefreshCw, Volume2 } from "lucide-react";
import type { DownloadedFile } from "../types";

interface LibraryDrawerProps {
  files: DownloadedFile[];
  onRefresh: () => Promise<void>;
  onOpenFolder: () => void;
}

export const LibraryDrawer: React.FC<LibraryDrawerProps> = ({ files, onRefresh, onOpenFolder }) => {
  const [currentFile, setCurrentFile] = useState<DownloadedFile | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayToggle = (file: DownloadedFile) => {
    if (currentFile?.name === file.name) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      setCurrentFile(file);
      setIsPlaying(true);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play();
        }
      }, 50);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec)) return "0:00";
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Drawer Header */}
      <div
        className="glass-panel"
        style={{
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
            <Music size={18} style={{ color: "var(--primary)" }} />
            <span>Local Music Library ({files.length} MP3s)</span>
          </h2>
          <p style={{ fontSize: "12.5px", color: "var(--text-muted)", marginTop: "2px" }}>
            High-definition 320 kbps MP3 files saved locally in your <code>./downloads</code> folder.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onRefresh} className="btn btn-secondary btn-sm">
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
          <button onClick={onOpenFolder} className="btn btn-primary btn-sm">
            <FolderOpen size={14} />
            <span>Open in Finder</span>
          </button>
        </div>
      </div>

      {/* Floating Audio Player if file selected */}
      {currentFile && (
        <div
          className="glass-panel"
          style={{
            padding: "16px 20px",
            background: "linear-gradient(90deg, rgba(20, 28, 46, 0.95), rgba(15, 20, 34, 0.98))",
            border: "1px solid var(--primary-glow)",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => handlePlayToggle(currentFile)}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              background: "var(--primary)",
              color: "#000",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {isPlaying ? <Pause size={18} fill="#000" /> : <Play size={18} fill="#000" style={{ marginLeft: "2px" }} />}
          </button>

          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff", marginBottom: "4px" }}>
              {currentFile.name.replace(".mp3", "")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--text-dim)" }}>
              <span>{formatSeconds(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                style={{ flex: 1, accentColor: "var(--primary)", cursor: "pointer" }}
              />
              <span>{formatSeconds(duration)}</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-dim)", fontSize: "12px" }}>
            <Volume2 size={16} />
            <span>Streaming Local MP3</span>
          </div>

          <audio
            ref={audioRef}
            src={currentFile.url}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
          />
        </div>
      )}

      {/* Files List */}
      <div className="glass-panel" style={{ overflow: "hidden" }}>
        {files.length === 0 ? (
          <div
            style={{
              padding: "48px 20px",
              textAlign: "center",
              color: "var(--text-dim)",
              fontSize: "14px",
            }}
          >
            No downloaded MP3 files found yet. Use the <b>Downloader Studio</b> to fetch and download tracks!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {files.map((file) => {
              const isCurrent = currentFile?.name === file.name;

              return (
                <div
                  key={file.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 20px",
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                    background: isCurrent ? "rgba(29, 185, 84, 0.05)" : "transparent",
                    transition: "var(--transition)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                      onClick={() => handlePlayToggle(file)}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: isCurrent && isPlaying ? "var(--primary)" : "rgba(255,255,255,0.08)",
                        color: isCurrent && isPlaying ? "#000" : "#fff",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "var(--transition)",
                      }}
                      title="Play in browser"
                    >
                      {isCurrent && isPlaying ? (
                        <Pause size={14} fill="#000" />
                      ) : (
                        <Play size={14} fill="currentColor" style={{ marginLeft: "1px" }} />
                      )}
                    </button>

                    <div>
                      <div style={{ fontSize: "13.5px", fontWeight: "600", color: isCurrent ? "var(--primary)" : "#fff" }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: "11.5px", color: "var(--text-dim)", marginTop: "1px" }}>
                        Saved: {new Date(file.modified).toLocaleDateString()} at {new Date(file.modified).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--text-dim)",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {file.size_mb} MB
                    </span>
                    <a
                      href={file.url}
                      download={file.name}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: "4px 8px" }}
                      title="Save to device"
                    >
                      Save
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
