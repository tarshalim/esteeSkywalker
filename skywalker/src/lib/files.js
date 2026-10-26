import { supabase, MEDIA_BUCKET, unwrap } from "./supabase";

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Supabase's project-wide upload cap (50 MB on the Free plan) — anything
// bigger is rejected with 413 only after the whole file has been sent. Keep
// in step with the `media` bucket's file_size_limit (see migrations).
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// Formats every current browser can play in a <video>. QuickTime is the
// iPhone camera's format; Safari plays all of it, Chrome/Firefox the H.264 ones.
export const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];
export const VIDEO_ACCEPT = VIDEO_MIME_TYPES.join(",");
const VIDEO_EXT_TYPES = { mp4: "video/mp4", m4v: "video/x-m4v", webm: "video/webm", mov: "video/quicktime" };

const extensionOf = (file) => file.name?.split(".").pop()?.toLowerCase() ?? "";
const formatMb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** The upload's MIME type, falling back to its extension (some OS pickers leave `type` empty for .mov/.m4v). */
function mimeTypeOf(file) {
  return file.type || VIDEO_EXT_TYPES[extensionOf(file)] || "";
}

/** Throws a user-facing Error when `file` can't be uploaded (too big, unplayable video). */
export function validateUpload(file) {
  const type = mimeTypeOf(file);
  if (type.startsWith("video/") && !VIDEO_MIME_TYPES.includes(type)) {
    throw new Error("That video format can't play on the web — use MP4, WebM or MOV.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const what = type.startsWith("video/") ? "Videos" : "Files";
    throw new Error(`${what} must be ${formatMb(MAX_UPLOAD_BYTES)} or smaller — this one is ${formatMb(file.size)}. Try a shorter or lower-resolution clip.`);
  }
}

// Uploads to Supabase Storage and returns the public URL; falls back to a
// data URL when Supabase isn't configured.
export async function fileToUrl(file) {
  validateUpload(file);
  if (!supabase) return fileToDataUrl(file);
  const ext = extensionOf(file) || "bin";
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: mimeTypeOf(file) || undefined, upsert: false });
  if (error) throw error;
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Public media URLs look like <project>/storage/v1/object/public/media/<path>.
const MEDIA_URL_PATTERN = new RegExp(`/storage/v1/object/public/${MEDIA_BUCKET}/([^?#"'\\s)]+)`, "g");

/** Adds the storage path of every media-bucket file referenced anywhere in `value` (nested objects/arrays included). */
export function collectMediaPaths(value, paths = new Set()) {
  if (typeof value === "string") {
    for (const m of value.matchAll(MEDIA_URL_PATTERN)) paths.add(decodeURIComponent(m[1]));
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectMediaPaths(v, paths);
  }
  return paths;
}

/** Deletes media-bucket files. Failures are logged, not thrown — a stray file isn't worth blocking the UI. */
export async function deleteMediaFiles(paths) {
  if (!supabase || paths.length === 0) return;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
  if (error) console.warn("Couldn't delete media files", paths, error);
}

// Every table whose `data` can reference an upload.
const MEDIA_TABLES = ["blogs", "templates", "gallery_items", "locations", "trips"];

/**
 * Deletes the uploads a just-deleted record referenced. Templates copy a
 * post's cover/canvas URLs, and gallery photos, pins or trips can point at
 * the same upload, so only files nothing else references are removed.
 * Failures are logged, not thrown.
 */
export async function deleteOrphanedMedia(value, label) {
  const paths = collectMediaPaths(value);
  if (!supabase || paths.size === 0) return;
  try {
    const results = await Promise.all(MEDIA_TABLES.map((t) => supabase.from(t).select("data")));
    const stillUsed = new Set();
    for (const rows of results.map(unwrap)) for (const row of rows) collectMediaPaths(row.data, stillUsed);
    await deleteMediaFiles([...paths].filter((p) => !stillUsed.has(p)));
  } catch (err) {
    console.warn(`Couldn't clean up media for deleted ${label}`, err);
  }
}
