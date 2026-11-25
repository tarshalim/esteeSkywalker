import { supabase } from "./supabase";

// Supabase Free plan quotas. Not readable from the database, so keep these in
// step with https://supabase.com/pricing if the plan changes.
export const FREE_TIER = {
  storageBytes: 1024 ** 3, // 1 GB file storage
  databaseBytes: 500 * 1024 ** 2, // 500 MB database
};

const UNITS = ["B", "KB", "MB", "GB", "TB"];

/** "0 B", "812 KB", "1.4 MB", "1.02 GB": 1024-based, like files.js's upload limit message. */
export function formatBytes(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  if (n < 1024) return `${n} B`;
  const exp = Math.min(Math.floor(Math.log(n) / Math.log(1024)), UNITS.length - 1);
  const value = n / 1024 ** exp;
  return `${Number(value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2))} ${UNITS[exp]}`;
}

/** { used, limit, remaining, pct } for a quota meter. `remaining` goes negative when over quota; `pct` is uncapped. */
export function quota(used, limit) {
  const u = Math.max(0, Number(used) || 0);
  return { used: u, limit, remaining: limit - u, pct: limit > 0 ? (u / limit) * 100 : 0 };
}

/**
 * Live storage numbers from the admin_storage_usage() RPC, computed on the
 * server per call (nothing is cached or stored). Rejects for non-admins.
 */
export async function fetchStorageUsage() {
  if (!supabase) throw new Error("Storage usage needs Supabase to be configured.");
  const { data, error } = await supabase.rpc("admin_storage_usage");
  if (error) throw error;
  return normalizeUsage(data);
}

export function normalizeUsage(raw) {
  const num = (v) => Number(v) || 0;
  return {
    computedAt: raw?.computed_at ?? null,
    databaseBytes: num(raw?.database_bytes),
    storageBytes: num(raw?.storage_bytes),
    storageFiles: num(raw?.storage_files),
    blogMediaBytes: num(raw?.blog_media_bytes),
    blogMediaFiles: num(raw?.blog_media_files),
    buckets: (raw?.buckets ?? []).map((b) => ({ bucket: b.bucket, files: num(b.files), bytes: num(b.bytes) })),
    blogs: (raw?.blogs ?? []).map((b) => ({
      id: b.id,
      title: b.title || "Untitled Blog Post",
      status: b.status,
      updatedAt: b.updated_at ?? null,
      files: num(b.files),
      mediaBytes: num(b.media_bytes),
      rowBytes: num(b.row_bytes),
      totalBytes: num(b.media_bytes) + num(b.row_bytes),
    })),
  };
}
