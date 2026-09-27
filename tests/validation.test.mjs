import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeSpotifyUrl, normalizeQuality, maskClientId } from "../src/lib/validation.js";

test("sanitizeSpotifyUrl accepts valid Spotify URLs", () => {
  assert.equal(
    sanitizeSpotifyUrl("https://open.spotify.com/playlist/abc123?si=123"),
    "https://open.spotify.com/playlist/abc123"
  );
  assert.equal(sanitizeSpotifyUrl("spotify:album:abc123"), "spotify:album:abc123");
});

test("sanitizeSpotifyUrl rejects invalid URLs", () => {
  assert.equal(sanitizeSpotifyUrl("https://example.com/playlist/abc123"), "");
  assert.equal(sanitizeSpotifyUrl(""), "");
});

test("normalizeQuality clamps supported values", () => {
  assert.equal(normalizeQuality(500, 320), 320);
  assert.equal(normalizeQuality(220, 320), 192);
  assert.equal(normalizeQuality(90, 320), 128);
  assert.equal(normalizeQuality(320, 320), 320);
});

test("maskClientId hides most of the id", () => {
  assert.equal(maskClientId("abcdef123456"), "abcdef...");
  assert.equal(maskClientId(""), "");
});
