import exifr from "exifr/dist/lite.esm.js";

/**
 * Extracts date-taken + GPS from an uploaded image file, entirely client-side.
 * `lite` build (jpg/heic, TIFF+GPS dictionaries only) keeps the bundle small
 * since we only need DateTimeOriginal + coordinates, not the full tag set.
 * Always resolves — files with no EXIF (screenshots, PNGs, stripped photos)
 * just come back with null fields so callers fall back to manual input.
 * @returns {Promise<{dateTaken: string|null, lat: number|null, lng: number|null}>}
 */
export async function extractPhotoMetadata(file) {
  // A single unfiltered parse() call, rather than exifr's `pick` option: this
  // version of exifr throws ("undefined is not iterable") when `pick` is
  // passed as either an array or `{pick: [...]}, so we just read the two
  // fields we need off the full (still small — `lite` build) result instead.
  let result = null;
  try {
    result = await exifr.parse(file);
  } catch {
    // no EXIF segment at all (e.g. PNG, screenshot, stripped photo)
  }

  const rawDate = result?.DateTimeOriginal;
  const dateTaken = rawDate instanceof Date && !Number.isNaN(rawDate.getTime()) ? rawDate.toISOString() : null;

  const lat = typeof result?.latitude === "number" ? result.latitude : null;
  const lng = typeof result?.longitude === "number" ? result.longitude : null;

  return { dateTaken, lat, lng };
}
