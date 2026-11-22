import { supabase } from "./supabase";
import { fileToDataUrl } from "./files";
import { parseSpotifyItem, parseYouTubeId } from "./mediaUrl";

// A post's background track. Stored on the blog as `music`:
//   { type: "upload", url, storagePath?, title }   – file in the blog-audio bucket (or a data URL offline)
//   { type: "youtube", id, url, title }
//   { type: "spotify", id, url, title }
// Older posts only have `audioUrl` (a direct audio link); getBlogMusic reads both.

const AUDIO_BUCKET = "blog-audio";
export const AUDIO_ACCEPT = ".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const AUDIO_EXT = /\.(mp3|m4a|wav)$/i;
const AUDIO_MIME = /^audio\/(mpeg|mp3|mp4|x-m4a|m4a|aac|wav|x-wav|wave|vnd\.wave)$/i;
const EXT_MIME = { mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav" };

export const MUSIC_SOURCES = {
  upload: { label: "Audio file" },
  youtube: { label: "YouTube", app: "Open in YouTube" },
  spotify: { label: "Spotify", app: "Open in Spotify" },
};

/** Builds a music object from a pasted link, or null when it isn't a valid link of that type. */
export function musicFromLink(type, input) {
  if (type === "youtube") {
    const id = parseYouTubeId(input);
    return id ? { type, id, url: `https://www.youtube.com/watch?v=${id}`, title: "" } : null;
  }
  if (type === "spotify") {
    // Background music is a single track; albums and playlists have no one timeline to loop or trim.
    const item = parseSpotifyItem(input);
    return item?.kind === "track" ? { type, id: item.id, url: `https://open.spotify.com/track/${item.id}`, title: "" } : null;
  }
  return null;
}

export function getBlogMusic(blog) {
  if (blog?.music?.type) return blog.music;
  if (blog?.audioUrl) return { type: "upload", url: blog.audioUrl, title: "" };
  return null;
}

/** Stable identity for keying players, so switching tracks remounts cleanly. */
export function musicKey(music) {
  return music ? `${music.type}:${music.id ?? music.url}` : "";
}

/** Link to the track in its native app/site; null for uploaded files. */
export function musicExternalUrl(music) {
  if (music?.type === "youtube") return `https://www.youtube.com/watch?v=${music.id}`;
  if (music?.type === "spotify") return `https://open.spotify.com/track/${music.id}`;
  return null;
}

/** Best-effort track title from the provider's oEmbed endpoint; "" when it can't be fetched. */
export async function fetchMusicTitle(music) {
  const endpoint =
    music.type === "spotify"
      ? `https://open.spotify.com/oembed?url=${encodeURIComponent(music.url)}`
      : music.type === "youtube"
        ? `https://noembed.com/embed?url=${encodeURIComponent(music.url)}`
        : null;
  if (!endpoint) return "";
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return "";
    const json = await res.json();
    return typeof json.title === "string" ? json.title : "";
  } catch {
    return "";
  }
}

/** Returns an error message for files the picker shouldn't take, else null. */
export function validateAudioFile(file) {
  if (!AUDIO_EXT.test(file.name) && !AUDIO_MIME.test(file.type)) return "Only .mp3, .m4a and .wav files are supported.";
  if (file.size > MAX_AUDIO_BYTES) return `That file is over ${MAX_AUDIO_BYTES / 1024 / 1024} MB.`;
  return null;
}

/**
 * Uploads a track to the blog-audio bucket and returns its music object. Without
 * Supabase it falls back to a data URL (no storagePath, so nothing to delete later).
 */
export async function uploadBlogAudio(file) {
  const title = file.name.replace(/\.[^.]+$/, "");
  if (!supabase) return { type: "upload", url: await fileToDataUrl(file), title };
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  // Some browsers report "" for .m4a/.wav, which the bucket's MIME allowlist rejects.
  const contentType = file.type || EXT_MIME[ext] || "audio/mpeg";
  const { error } = await supabase.storage.from(AUDIO_BUCKET).upload(path, file, { contentType, upsert: false });
  if (error) throw error;
  const url = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
  return { type: "upload", url, storagePath: path, title };
}

/** Deletes an uploaded track's file. Failures are logged, not thrown — a stray file isn't worth blocking the UI. */
export async function deleteBlogAudio(storagePath) {
  if (!supabase || !storagePath) return;
  const { error } = await supabase.storage.from(AUDIO_BUCKET).remove([storagePath]);
  if (error) console.warn("Couldn't delete background music file", storagePath, error);
}
