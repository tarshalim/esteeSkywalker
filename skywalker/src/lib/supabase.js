import { createClient } from "@supabase/supabase-js";

// Supabase client, or null when the env vars aren't set — the stores fall back
// to their localStorage mock in that case so the app still runs offline.

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export const MEDIA_BUCKET = "media";

// Rows are stored as { id, data jsonb, ... } so the app's camelCase objects
// round-trip unchanged.
export function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export function fromRows(rows) {
  return (rows ?? []).map((r) => r.data);
}
