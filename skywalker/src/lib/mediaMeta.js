// Per-media metadata on scrapbook canvas elements: where and when a photo or
// clip was taken, as read from the file on upload (lib/exif.js) and/or set by
// hand in the editor's metadata inspector.
//
// Stored on the element as `mediaMeta`, tagged with the `src` it describes:
//
// {
//   src,                       // the photo/clip URL this describes
//   mediaType,                 // "image" | "video"
//   lat, lng,                  // signed decimal degrees, or null
//   locationSource,            // "exif" (read from the file) | "manual" | null
//   locationTitle,             // "Fushimi Inari" — the writer's own name for the spot
//   dateTaken, timeTaken,      // yyyy-mm-dd / HH:MM wall clock, or null
//   dateSource,                // "exif" | "file" (last-modified) | "manual" | null
//   camera, width, height, fileSize,
// }
//
// Anything that swaps the element's media without new metadata (a pasted
// link, a gallery pick, "Change video") leaves a stale `src`, so readMediaMeta
// ignores it — no code path has to remember to clear it.

import { ELEMENT_KIND } from "./canvasElements";

const SRC_FIELDS = ["src", "url", "mediaSrc", "imageSrc"];

/** URL of the photo or clip an element shows, or "" when it has none. */
export function mediaSourceOf(element) {
  switch (element?.kind) {
    case ELEMENT_KIND.IMAGE:
      return element.src || "";
    case ELEMENT_KIND.VIDEO:
    case ELEMENT_KIND.VIEWFINDER:
      return element.url || "";
    case ELEMENT_KIND.POLAROID:
    case ELEMENT_KIND.NOTE:
      return element.mediaSrc || "";
    case ELEMENT_KIND.FRAME_STICKER:
      return element.imageSrc || "";
    default:
      return "";
  }
}

/** "image" | "video" for the media an element shows, or null. */
export function mediaTypeOf(element) {
  if (!mediaSourceOf(element)) return null;
  switch (element.kind) {
    case ELEMENT_KIND.VIDEO:
    case ELEMENT_KIND.VIEWFINDER:
      return "video";
    case ELEMENT_KIND.POLAROID:
    case ELEMENT_KIND.NOTE:
      return element.mediaType === "video" ? "video" : "image";
    default:
      return "image";
  }
}

/** The element's metadata, or null when it has none for the media it shows now. */
export function readMediaMeta(element) {
  const src = mediaSourceOf(element);
  const meta = element?.mediaMeta;
  return src && meta && meta.src === src ? meta : null;
}

const finite = (v) => (Number.isFinite(v) ? v : null);

/** `mediaMeta` (minus `src`) from lib/exif.js extractPhotoMetadata's result for an upload. */
export function metaFromExtraction(extracted, mediaType) {
  const lat = finite(extracted?.lat);
  const lng = finite(extracted?.lng);
  const located = lat != null && lng != null;
  return {
    mediaType,
    lat: located ? lat : null,
    lng: located ? lng : null,
    locationSource: located ? "exif" : null,
    locationTitle: "",
    dateTaken: extracted?.dateTaken ?? null,
    timeTaken: extracted?.timeTaken ?? null,
    dateSource: extracted?.dateTaken ? extracted.dateSource ?? null : null,
    camera: extracted?.camera ?? null,
    width: finite(extracted?.width),
    height: finite(extracted?.height),
    fileSize: finite(extracted?.fileSize),
  };
}

/**
 * Wraps an upload's element patch (an object, or a `(current) => patch`
 * function) so that whichever of its media fields got an uploaded URL also
 * carries that file's metadata — one update, one undo step.
 * @param {Map<string, object>} metaByUrl uploaded URL → metaFromExtraction(...)
 */
export function withMediaMeta(patch, metaByUrl) {
  if (!metaByUrl?.size) return patch;
  const attach = (p) => {
    if (!p || typeof p !== "object") return p;
    for (const field of SRC_FIELDS) {
      const meta = typeof p[field] === "string" ? metaByUrl.get(p[field]) : undefined;
      if (meta) return { ...p, mediaMeta: { ...meta, src: p[field] } };
    }
    return p;
  };
  return typeof patch === "function" ? (current) => attach(patch(current)) : attach(patch);
}

/** "exif" (GPS read from the file) | "manual" | "missing". */
export function coordinateStatus(meta) {
  if (meta?.lat == null || meta?.lng == null) return "missing";
  return meta.locationSource === "manual" ? "manual" : "exif";
}

/**
 * A typed latitude/longitude as a number, or null when blank. Accepts
 * "35.68", "-139.7", and hemisphere suffixes ("35.68 N", "139.7°W").
 * @returns {{value:number|null}|{error:string}}
 */
export function parseCoordinate(input, axis) {
  const raw = String(input ?? "").trim();
  if (!raw) return { value: null };
  const m = /^([+-]?\d+(?:\.\d+)?)\s*°?\s*([NSEW])?$/i.exec(raw);
  const label = axis === "lat" ? "Latitude" : "Longitude";
  if (!m) return { error: `${label} must be a number, e.g. ${axis === "lat" ? "35.6895" : "139.6917"}` };
  let value = Number(m[1]);
  const hemi = m[2]?.toUpperCase();
  if (hemi) {
    if ((axis === "lat") !== (hemi === "N" || hemi === "S")) return { error: `${label} takes ${axis === "lat" ? "N or S" : "E or W"}` };
    if (hemi === "S" || hemi === "W") value = -Math.abs(value);
  }
  const max = axis === "lat" ? 90 : 180;
  if (Math.abs(value) > max) return { error: `${label} must be between -${max} and ${max}` };
  return { value };
}

/**
 * The metadata after a hand edit in the inspector. Fields the writer changed
 * become "manual"; untouched ones keep their source. Returns { error } when
 * the edit can't be saved.
 * @param {object|null} meta current readMediaMeta(element)
 * @param {{src:string, mediaType:string}} media what the element shows
 * @param {{lat:string, lng:string, locationTitle:string, dateTaken:string, timeTaken:string}} form
 */
export function editMediaMeta(meta, media, form) {
  const lat = parseCoordinate(form.lat, "lat");
  if (lat.error) return { error: lat.error };
  const lng = parseCoordinate(form.lng, "lng");
  if (lng.error) return { error: lng.error };
  if ((lat.value == null) !== (lng.value == null)) return { error: "Enter both latitude and longitude, or neither" };
  if (form.timeTaken && !form.dateTaken) return { error: "Add the date the time belongs to" };

  const base = meta ?? metaFromExtraction(null, media.mediaType);
  const sameCoord = (a, b) => (a == null ? b == null : b != null && Math.abs(a - b) < 1e-7);
  const coordsChanged = !sameCoord(lat.value, base.lat) || !sameCoord(lng.value, base.lng);
  const dateTaken = form.dateTaken || null;
  const timeTaken = dateTaken ? form.timeTaken || null : null;
  const dateChanged = dateTaken !== base.dateTaken || timeTaken !== base.timeTaken;

  return {
    meta: {
      ...base,
      src: media.src,
      mediaType: base.mediaType ?? media.mediaType,
      lat: lat.value,
      lng: lng.value,
      locationSource: !coordsChanged ? base.locationSource : lat.value == null ? null : "manual",
      locationTitle: (form.locationTitle ?? "").trim(),
      dateTaken,
      timeTaken,
      dateSource: !dateChanged ? base.dateSource : dateTaken ? "manual" : null,
    },
  };
}
