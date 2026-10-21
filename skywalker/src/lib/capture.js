import { extractPhotoMetadata } from "./exif";
import { writeJpegExif } from "./exifWrite";

// Shared pipeline for photos taken on the spot (webcam snapshot or the
// device's native camera): downscale + JPEG-compress, then stamp the capture
// time and GPS fix into EXIF so the regular upload flow (extractPhotoMetadata
// -> reverse geocode -> nearest Location / covering Trip) files it with no
// special casing.

const MAX_EDGE = 2048; // px, long edge
const JPEG_QUALITY = 0.85;
const GEO_TIMEOUT_MS = 8000;
const GEO_MAX_AGE_MS = 60_000;

const pad = (n) => String(n).padStart(2, "0");

/**
 * Current browser position, or null when unsupported, denied, or too slow.
 * Never rejects — a photo without a location is still worth keeping.
 * @returns {Promise<?{lat:number,lng:number,accuracy:number}>}
 */
export function getCurrentPosition({ timeout = GEO_TIMEOUT_MS } = {}) {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: GEO_MAX_AGE_MS }
    );
  });
}

/** "capture-20261021-143205.jpg" — the upload path adds a UUID, so this only needs to be readable. */
export function captureFileName(date = new Date()) {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `capture-${stamp}.jpg`;
}

function canvasToJpeg(canvas, quality = JPEG_QUALITY) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the photo"))), "image/jpeg", quality)
  );
}

/** Draws `source` (video frame or decoded image) onto a canvas no larger than MAX_EDGE. */
function drawScaled(source, width, height, { mirror = false } = {}) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Snapshot of the current frame of a playing <video> as a compressed JPEG.
 * `mirror` matches a selfie preview that is shown flipped.
 */
export function snapshotVideo(video, { mirror = false } = {}) {
  if (!video.videoWidth) return Promise.reject(new Error("The camera isn't ready yet"));
  return canvasToJpeg(drawScaled(video, video.videoWidth, video.videoHeight, { mirror }));
}

/** Re-encodes an image file as a downscaled JPEG; EXIF orientation is applied while decoding. */
async function compressImageFile(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    return await canvasToJpeg(drawScaled(bitmap, bitmap.width, bitmap.height));
  } finally {
    bitmap.close();
  }
}

/**
 * Turns a raw capture into the File that gets uploaded.
 *
 * - Webcam snapshot (`jpeg`): already compressed; stamped with now + `position`.
 * - Native camera file (`file`): its own EXIF date/GPS win when present (some
 *   browsers strip GPS from camera files, so `position` fills the gap). It is
 *   re-encoded to keep uploads small, which drops the original EXIF — hence
 *   re-stamping it.
 *
 * Falls back to the untouched file if it can't be decoded (e.g. HEIC outside Safari).
 *
 * @param {{ jpeg?: Blob, file?: File, position?: ?{lat:number,lng:number} }} raw
 * @returns {Promise<File>}
 */
export async function prepareCapturedPhoto({ jpeg, file, position = null }) {
  let date = new Date();
  let coords = position ? { lat: position.lat, lng: position.lng } : null;
  let compressed = jpeg;

  if (file) {
    const meta = await extractPhotoMetadata(file);
    if (meta.dateTaken) date = new Date(`${meta.dateTaken}T${meta.timeTaken ?? "12:00"}`);
    if (meta.lat != null && meta.lng != null) coords = { lat: meta.lat, lng: meta.lng };
    try {
      compressed = await compressImageFile(file);
    } catch (err) {
      console.warn("Couldn't re-encode captured photo; uploading the original", err);
      return file;
    }
  }

  const stamped = await writeJpegExif(compressed, { date, coords });
  return new File([stamped], captureFileName(date), { type: "image/jpeg", lastModified: date.getTime() });
}
