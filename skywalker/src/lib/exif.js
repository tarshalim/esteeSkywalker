import exifr from "exifr/dist/lite.esm.js";

const pad = (n) => String(n).padStart(2, "0");

/** "Canon EOS R6" from Make "Canon" + Model "Canon EOS R6" (models often repeat the make). */
function cameraLabel(make, model) {
  const mk = typeof make === "string" ? make.trim() : "";
  const md = typeof model === "string" ? model.trim() : "";
  if (!md) return mk || null;
  return mk && !md.toLowerCase().startsWith(mk.toLowerCase().split(" ")[0]) ? `${mk} ${md}` : md;
}

const localDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "3.2 MB" / "840 KB". */
export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Pixel size as displayed (EXIF orientation applied), by decoding the file —
 * EXIF's own PixelXDimension is often missing or pre-rotation. Null when the
 * browser can't decode it (e.g. HEIC outside Safari).
 * @returns {Promise<{width:number,height:number}|null>}
 */
export async function readMediaDimensions(file) {
  try {
    if (file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      try {
        return await new Promise((resolve) => {
          const video = document.createElement("video");
          video.preload = "metadata";
          video.onloadedmetadata = () => resolve(video.videoWidth ? { width: video.videoWidth, height: video.videoHeight } : null);
          video.onerror = () => resolve(null);
          video.src = url;
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

/**
 * Extracts date/time taken, GPS, camera, pixel size and file size from an
 * uploaded image or video, entirely client-side. `lite` build (jpg/heic,
 * TIFF+EXIF+GPS dictionaries) keeps the bundle small; exifr already converts
 * GPS rationals + N/S/E/W refs to signed decimal `latitude` / `longitude`.
 * Always resolves — files with no EXIF (screenshots, PNGs, stripped photos)
 * fall back to the file's last-modified date (`dateSource: "file"`) and come
 * back with null GPS/camera so callers fall back to manual input.
 * @returns {Promise<{
 *   dateTaken: string|null,  // yyyy-mm-dd, the camera's wall-clock day
 *   timeTaken: string|null,  // HH:MM, the camera's wall-clock time
 *   dateSource: "exif"|"file"|null,
 *   lat: number|null,
 *   lng: number|null,
 *   camera: string|null,     // "FUJIFILM X100V"
 *   width: number|null,
 *   height: number|null,
 *   fileSize: number|null,   // bytes
 * }>}
 */
export async function extractPhotoMetadata(file) {
  const [exif, dimensions] = await Promise.all([extractExif(file), readMediaDimensions(file)]);
  let { dateTaken, timeTaken } = exif;
  let dateSource = dateTaken ? "exif" : null;
  if (!dateTaken && file.lastModified) {
    const modified = new Date(file.lastModified);
    if (!Number.isNaN(modified.getTime())) {
      dateTaken = localDay(modified);
      timeTaken = localTime(modified);
      dateSource = "file";
    }
  }
  return {
    ...exif,
    dateTaken,
    timeTaken,
    dateSource,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    fileSize: Number.isFinite(file.size) ? file.size : null,
  };
}

async function extractExif(file) {
  // A single unfiltered parse() call, rather than exifr's `pick` option: this
  // version of exifr throws ("undefined is not iterable") when `pick` is
  // passed as either an array or `{pick: [...]}, so we just read the fields
  // we need off the full (still small — `lite` build) result instead.
  let result = null;
  try {
    result = await exifr.parse(file);
  } catch {
    // no EXIF segment at all (e.g. PNG, screenshot, stripped photo)
  }

  // DateTimeOriginal has no timezone; exifr builds it as a *local* Date from
  // the camera's wall clock. Read it back with local getters — toISOString()
  // would shift photos taken near midnight onto the neighbouring day.
  const raw = result?.DateTimeOriginal ?? result?.CreateDate;
  const valid = raw instanceof Date && !Number.isNaN(raw.getTime());
  const dateTaken = valid ? localDay(raw) : null;
  const timeTaken = valid ? localTime(raw) : null;

  const lat = Number.isFinite(result?.latitude) ? result.latitude : null;
  const lng = Number.isFinite(result?.longitude) ? result.longitude : null;
  // Some phones write 0,0 when they had no fix.
  const hasFix = lat != null && lng != null && !(lat === 0 && lng === 0);

  return {
    dateTaken,
    timeTaken,
    lat: hasFix ? lat : null,
    lng: hasFix ? lng : null,
    camera: cameraLabel(result?.Make, result?.Model),
  };
}
