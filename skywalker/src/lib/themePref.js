// Theme preference helpers for src/lib/theme.jsx. Kept free of React so they
// can be unit-tested. The inline script in index.html mirrors resolveTheme.

export const THEME_STORAGE_KEY = "skywalker-theme";

// Browser chrome colour per theme (matches --bg in index.css).
export const THEME_COLORS = { light: "#fafaf9", dark: "#0f172a" };

const isTheme = (v) => v === "light" || v === "dark";

/** The user's explicit choice, or null. Never throws (storage may be blocked). */
export function readStoredTheme(storage) {
  try {
    const v = storage?.getItem(THEME_STORAGE_KEY);
    return isTheme(v) ? v : null;
  } catch {
    return null;
  }
}

/** Saves an explicit choice. Returns false when storage refuses it. */
export function writeStoredTheme(storage, theme) {
  if (!isTheme(theme)) return false;
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

/** A stored choice wins; otherwise follow the OS. */
export function resolveTheme(stored, prefersDark) {
  return isTheme(stored) ? stored : prefersDark ? "dark" : "light";
}
