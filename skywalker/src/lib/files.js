import { supabase, MEDIA_BUCKET } from "./supabase";

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Uploads to Supabase Storage and returns the public URL; falls back to a
// data URL when Supabase isn't configured.
export async function fileToUrl(file) {
  if (!supabase) return fileToDataUrl(file);
  const ext = file.name?.split(".").pop() || "bin";
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
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
