import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "./components/Header";
import { SearchCard } from "./components/SearchCard";
import { PlaylistBanner } from "./components/PlaylistBanner";
import { TrackList } from "./components/TrackList";
import { CronsManager } from "./components/CronsManager";
import { LibraryDrawer } from "./components/LibraryDrawer";
import { SettingsModal } from "./components/SettingsModal";
import { Toast, type ToastMessage } from "./components/Toast";
import type {
  PlaylistInfo,
  Track,
  DownloadProgress,
  DownloadedFile,
  CronJob,
  SyncLog,
} from "./types";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"studio" | "crons" | "library">("studio");
  const [playlist, setPlaylist] = useState<PlaylistInfo | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [downloadStatuses, setDownloadStatuses] = useState<Map<string, DownloadProgress>>(
    new Map()
  );
  const [files, setFiles] = useState<DownloadedFile[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [cronHistory, setCronHistory] = useState<SyncLog[]>([]);
  const [apiConfig, setApiConfig] = useState({ configured: false, client_id_preview: "" });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [currentQuality, setCurrentQuality] = useState(320);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = "toast_" + Date.now() + "_" + Math.random().toString(36).substring(5);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load Initial Data
  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/files");
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
      }
    } catch (error) {
      console.warn("Failed to load files:", error);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      setApiConfig(data);
    } catch (error) {
      console.warn("Failed to load config:", error);
    }
  }, []);

  const loadCrons = useCallback(async () => {
    try {
      const res = await fetch("/api/crons");
      const data = await res.json();
      if (data.jobs) setCronJobs(data.jobs);
      if (data.history) setCronHistory(data.history);
    } catch (error) {
      console.warn("Failed to load cron jobs:", error);
    }
  }, []);

  // Connect to SSE for real-time progress
  useEffect(() => {
    loadFiles();
    loadConfig();
    loadCrons();

    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === "progress" && payload.data) {
          const item: DownloadProgress = payload.data;
          setDownloadStatuses((prev) => {
            const next = new Map(prev);
            next.set(item.track_id, item);
            return next;
          });

          if (item.status === "completed") {
            loadFiles();
          }
        } else if (payload.type === "snapshot" && Array.isArray(payload.data)) {
          setDownloadStatuses((prev) => {
            const next = new Map(prev);
            for (const item of payload.data) {
              next.set(item.track_id, item);
            }
            return next;
          });
        } else if (payload.type === "cron_update") {
          loadCrons();
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    // Retry initial data after 1.5s in case backend was starting up
    const retryTimer = setTimeout(() => {
      loadFiles();
      loadConfig();
      loadCrons();
    }, 1500);

    return () => {
      clearTimeout(retryTimer);
      eventSource.close();
    };
  }, [loadFiles, loadConfig, loadCrons]);

  // Fetch Spotify Playlist Info
  const handleFetch = async (url: string, quality: number) => {
    setIsLoading(true);
    setCurrentQuality(quality);
    try {
      const res = await fetch("/api/fetch-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!data.success) {
        showToast(data.error || "Failed to fetch Spotify playlist", "error");
        return;
      }

      setPlaylist(data.info);
      const allIds = new Set<string>(
        (data.info.tracks || []).map((t: Track) => t.id || `${t.artist}_${t.title}`)
      );
      setSelectedTrackIds(allIds);
      setFilterText("");
      showToast(`Loaded ${data.info.tracks?.length || 0} track(s)!`, "success");
    } catch (err: any) {
      showToast("Error connecting to server: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Queue tracks for download
  const queueDownload = async (tracksToDownload: Track[]) => {
    if (tracksToDownload.length === 0) return;

    try {
      const res = await fetch("/api/download-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: tracksToDownload, quality: currentQuality }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(`Queued ${tracksToDownload.length} track(s) for download!`, "success");
      } else {
        showToast(data.error || "Failed to queue tracks", "error");
      }
    } catch (err: any) {
      showToast("Download error: " + err.message, "error");
    }
  };

  const handleDownloadAll = () => {
    if (playlist && playlist.tracks) {
      queueDownload(playlist.tracks);
    }
  };

  const handleDownloadSelected = () => {
    if (!playlist || !playlist.tracks) return;
    const selected = playlist.tracks.filter((t) =>
      selectedTrackIds.has(t.id || `${t.artist}_${t.title}`)
    );
    queueDownload(selected);
  };

  const handleDownloadSingle = (track: Track) => {
    queueDownload([track]);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!playlist || !playlist.tracks) return;
    const all = new Set(playlist.tracks.map((t) => t.id || `${t.artist}_${t.title}`));
    setSelectedTrackIds(all);
  };

  const handleDeselectAll = () => {
    setSelectedTrackIds(new Set());
  };

  // Open Downloads Folder
  const handleOpenFolder = async () => {
    try {
      await fetch("/api/open-folder", { method: "POST" });
      showToast("Opened downloads folder", "info");
    } catch (error) {
      console.warn("Failed to open downloads folder:", error);
    }
  };

  // Save Spotify API Config
  const handleSaveConfig = async (clientId: string, clientSecret: string) => {
    try {
      const res = await fetch("/api/save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Spotify API credentials saved! 1,000+ tracks enabled.", "success");
        loadConfig();
        return true;
      } else {
        showToast(data.error || "Failed to save credentials", "error");
        return false;
      }
    } catch (err: any) {
      showToast("Error saving credentials: " + err.message, "error");
      return false;
    }
  };

  // Crons Handlers
  const handleAddCronJob = async (config: {
    name: string;
    url: string;
    cronExpr: string;
    quality: number;
  }) => {
    try {
      const res = await fetch("/api/crons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Created schedule "${config.name}"!`, "success");
        loadCrons();
      } else {
        showToast(data.error || "Failed to add schedule", "error");
      }
    } catch (err: any) {
      showToast("Error adding schedule: " + err.message, "error");
    }
  };

  const handleToggleCronJob = async (id: string) => {
    try {
      await fetch(`/api/crons/${id}/toggle`, { method: "POST" });
      loadCrons();
    } catch (error) {
      console.warn("Failed to toggle cron job:", error);
    }
  };

  const handleDeleteCronJob = async (id: string) => {
    try {
      await fetch(`/api/crons/${id}`, { method: "DELETE" });
      showToast("Schedule removed", "info");
      loadCrons();
    } catch (error) {
      console.warn("Failed to delete cron job:", error);
    }
  };

  const handleRunCronNow = async (id: string) => {
    showToast("Starting immediate sync...", "info");
    try {
      const res = await fetch(`/api/crons/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast(data.log?.message || "Sync finished successfully!", "success");
        loadCrons();
        loadFiles();
      } else {
        showToast(data.error || "Sync encountered an error", "error");
      }
    } catch (err: any) {
      showToast("Sync error: " + err.message, "error");
    }
  };

  // Filtered tracks
  const filteredTracks = useMemo(() => {
    if (!playlist || !playlist.tracks) return [];
    if (!filterText.trim()) return playlist.tracks;
    const query = filterText.toLowerCase();
    return playlist.tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.artist.toLowerCase().includes(query) ||
        (t.album && t.album.toLowerCase().includes(query))
    );
  }, [playlist, filterText]);

  const completedCount = useMemo(() => {
    let count = 0;
    for (const val of downloadStatuses.values()) {
      if (val.status === "completed") count++;
    }
    return count;
  }, [downloadStatuses]);

  return (
    <div className="container">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiConfigured={apiConfig.configured}
        activeCronsCount={cronJobs.filter((j) => j.enabled).length}
        downloadedFilesCount={files.length}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenFolder={handleOpenFolder}
      />

      {/* Main Content Area based on Tab */}
      {activeTab === "studio" && (
        <main>
          <SearchCard onFetch={handleFetch} isLoading={isLoading} />

          {playlist && (
            <>
              <PlaylistBanner
                info={playlist}
                selectedCount={selectedTrackIds.size}
                totalCount={playlist.tracks?.length || 0}
                completedCount={completedCount}
                filterText={filterText}
                setFilterText={setFilterText}
                onDownloadAll={handleDownloadAll}
                onDownloadSelected={handleDownloadSelected}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
              />

              <TrackList
                tracks={filteredTracks}
                selectedTrackIds={selectedTrackIds}
                downloadStatuses={downloadStatuses}
                onToggleSelect={handleToggleSelect}
                onDownloadSingle={handleDownloadSingle}
              />
            </>
          )}

          {/* Quick Library Preview at bottom of Studio */}
          {files.length > 0 && (
            <div style={{ marginTop: "40px" }}>
              <LibraryDrawer
                files={files.slice(0, 10)}
                onRefresh={loadFiles}
                onOpenFolder={handleOpenFolder}
              />
            </div>
          )}
        </main>
      )}

      {activeTab === "crons" && (
        <CronsManager
          jobs={cronJobs}
          history={cronHistory}
          onAddJob={handleAddCronJob}
          onToggleJob={handleToggleCronJob}
          onDeleteJob={handleDeleteCronJob}
          onRunNow={handleRunCronNow}
          onRefresh={loadCrons}
        />
      )}

      {activeTab === "library" && (
        <LibraryDrawer files={files} onRefresh={loadFiles} onOpenFolder={handleOpenFolder} />
      )}

      {/* API Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveConfig}
        apiConfigured={apiConfig.configured}
        clientIdPreview={apiConfig.client_id_preview}
      />

      {/* Toast Alerts */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
