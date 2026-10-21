import exifr from "exifr/dist/lite.esm.js";

const pad = (n) => String(n).padStart(2, "0");

/** "Canon EOS R6" from Make "Canon" + Model "Canon EOS R6" (models often repeat the make). */
function cameraLabel(make, model) {
  const mk = typeof make === "string" ? make.trim() : "";
  const md = typeof model === "string" ? model.trim() : "";
  if (!md) return mk || null;
  return mk && !md.toLowerCase().startsWith(mk.toLowerCase().split(" ")[0]) ? `${mk} ${md}` : md;
}

/**
 * Extracts date/time taken, GPS and camera from an uploaded image file,
 * entirely client-side. `lite` build (jpg/heic, TIFF+EXIF+GPS dictionaries)
 * keeps the bundle small; exifr already converts GPS rationals + N/S/E/W refs
 * to signed decimal `latitude` / `longitude`.
 * Always resolves — files with no EXIF (screenshots, PNGs, stripped photos)
 * just come back with null fields so callers fall back to manual input.
 * @returns {Promise<{
 *   dateTaken: string|null,  // yyyy-mm-dd, the camera's wall-clock day
 *   timeTaken: string|null,  // HH:MM, the camera's wall-clock time
 *   lat: number|null,
 *   lng: number|null,
 *   camera: string|null,     // "FUJIFILM X100V"
 * }>}
 */
export async function extractPhotoMetadata(file) {
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
  const dateTaken = valid ? `${raw.getFullYear()}-${pad(raw.getMonth() + 1)}-${pad(raw.getDate())}` : null;
  const timeTaken = valid ? `${pad(raw.getHours())}:${pad(raw.getMinutes())}` : null;

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
