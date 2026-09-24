export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration_ms?: number;
  duration_formatted?: string;
  cover_url?: string;
}

export interface PlaylistInfo {
  id?: string;
  title: string;
  owner?: string;
  description?: string;
  cover_url?: string;
  type?: "playlist" | "album" | "track";
  total_tracks?: number;
  tracks: Track[];
}

export interface DownloadProgress {
  track_id: string;
  status: "queued" | "searching" | "downloading" | "tagging" | "completed" | "failed";
  progress: number;
  message: string;
  file?: string;
  error?: string;
}

export interface DownloadedFile {
  name: string;
  size_mb: number;
  path: string;
  url: string;
  modified: string;
}

export interface CronJob {
  id: string;
  name: string;
  url: string;
  cronExpr: string;
  quality: number;
  enabled: boolean;
  createdAt: string;
  lastRun?: string;
  lastRunStatus?: "success" | "error" | "running";
  lastRunMessage?: string;
  nextRun?: string | null;
}

export interface SyncLog {
  id: string;
  jobId: string;
  jobName: string;
  timestamp: string;
  status: "success" | "error" | "running";
  message: string;
  newTracksDownloaded: number;
}
