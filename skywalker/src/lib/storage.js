// localStorage helpers for mock mode: when the Supabase env vars are unset,
// the stores (collection.js, commentStore, tripStore) read and write
// here instead. `delay` fakes network latency so mock mode keeps the same
// Promise API as Supabase mode. `makeId` is used in both modes.

const LATENCY_MS = 150;

export function delay(value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Date.now() alone collides when two items are created in the same ms.
export function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}${Date.now().toString(36)}`;
}
