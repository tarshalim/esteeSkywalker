// Start/end trimming for embedded media (background music, canvas audio and
// video). A trimmed media object carries:
//   startSec: number | null   – where playback starts (null = the beginning)
//   endSec:   number | null   – where it stops (null = the natural end)
//   loop:     boolean          – at the end, jump back to startSec (else pause there)
// Each player enforces these itself; readTrim normalizes whatever is stored.

// "45", "45.5", "0:45", "2:15", "1:02:03". Hours/minutes are optional; seconds may be fractional.
const TIMESTAMP = /^(?:(\d+):)?(?:(\d+):)?(\d+(?:\.\d+)?)$/;
// Pressing play this close before the start still counts as "at the start".
const START_TOLERANCE_SEC = 0.25;

/** Parses a timestamp into seconds: null for blank input, NaN when it isn't a valid time. */
export function parseTimestamp(input) {
  const text = String(input ?? "").trim();
  if (!text) return null;
  const match = text.match(TIMESTAMP);
  if (!match) return NaN;
  const [, a, b, s] = match;
  // With one colon the leading group is minutes; with two it's hours then minutes.
  const hours = b !== undefined ? Number(a) : 0;
  const minutes = b !== undefined ? Number(b) : Number(a ?? 0);
  const seconds = Number(s);
  if (a !== undefined && seconds >= 60) return NaN;
  if (b !== undefined && minutes >= 60) return NaN;
  return hours * 3600 + minutes * 60 + seconds;
}

/** 135 → "2:15", 3725 → "1:02:05", 45.5 → "0:45.5"; "" for no time. */
export function formatTimestamp(sec) {
  if (!Number.isFinite(sec)) return "";
  const whole = Math.floor(sec);
  const fraction = Math.round((sec - whole) * 10);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, "0") + (fraction ? `.${fraction}` : "");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Returns a message when a start/end pair can't be saved, else null. */
export function trimError(startSec, endSec) {
  if (Number.isNaN(startSec) || Number.isNaN(endSec)) return "Use m:ss or seconds, e.g. 0:45 or 45.";
  if (startSec != null && endSec != null && endSec <= startSec) return "End time must be after the start time.";
  return null;
}

/** Normalized trim for a media object; `loop` falls back to the player's usual behaviour. */
export function readTrim(media, { loop = false } = {}) {
  const start = Number.isFinite(media?.startSec) && media.startSec > 0 ? media.startSec : 0;
  const end = Number.isFinite(media?.endSec) && media.endSec > start ? media.endSec : null;
  return { start, end, loop: media?.loop ?? loop };
}

export function hasTrim(trim) {
  return trim.start > 0 || trim.end != null;
}

/** YouTube embed params for a trim. The player only takes whole seconds. */
export function youTubeTrimParams(trim) {
  const params = {};
  if (trim.start > 0) params.start = Math.floor(trim.start);
  if (trim.end != null) params.end = Math.ceil(trim.end);
  return params;
}

/**
 * Enforces a trim on an <audio>/<video>: starts at `start`, and on reaching
 * `end` (or the natural end) loops back or pauses there. Untrimmed media keeps
 * the native, gapless `loop`. Returns a cleanup function.
 */
export function attachTrim(media, trim) {
  if (!hasTrim(trim)) {
    media.loop = trim.loop;
    return () => {};
  }
  // `loop` would restart at 0:00 and swallow `ended`, so the handlers below take over.
  media.loop = false;
  const { start, end } = trim;
  const outside = () => media.currentTime < start - START_TOLERANCE_SEC || (end != null && media.currentTime >= end);
  const atEnd = () => {
    media.currentTime = start;
    if (trim.loop) media.play().catch(() => {});
    else media.pause();
  };

  const onLoaded = () => {
    if (media.currentTime < start) media.currentTime = start;
  };
  const onPlay = () => {
    if (outside()) media.currentTime = start;
  };
  const onTime = () => {
    if (end != null && media.currentTime >= end) atEnd();
  };

  media.addEventListener("loadedmetadata", onLoaded);
  media.addEventListener("play", onPlay);
  media.addEventListener("timeupdate", onTime);
  media.addEventListener("ended", atEnd);
  if (media.readyState >= 1) onLoaded();

  return () => {
    media.removeEventListener("loadedmetadata", onLoaded);
    media.removeEventListener("play", onPlay);
    media.removeEventListener("timeupdate", onTime);
    media.removeEventListener("ended", atEnd);
  };
}
