// Shared localStorage helpers for the app's mock "API" stores (blogStore.js,
// pinStore.js). Every store function returns a Promise so swapping these for
// real fetch() calls later doesn't change any callers.

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
