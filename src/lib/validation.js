export const VALID_QUALITIES = [128, 192, 256, 320];

export function sanitizeSpotifyUrl(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";

  const withoutQuery = trimmed.split("?")[0].replace(/\/+$/, "");
  const spotifyPattern = /^(https?:\/\/)?(open\.spotify\.com\/(playlist|album|track)\/[A-Za-z0-9]+|spotify:(playlist|album|track):[A-Za-z0-9]+)$/i;

  if (!spotifyPattern.test(withoutQuery)) {
    return "";
  }

  return withoutQuery;
}

export function normalizeQuality(value, fallback = 320) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  const quality = Math.min(320, Math.max(128, Math.round(numeric)));
  if (quality <= 160) return 128;
  if (quality <= 220) return 192;
  if (quality <= 290) return 256;
  return 320;
}

export function maskClientId(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  return `${trimmed.slice(0, 6)}...`;
}
