import { createContext, useContext, useEffect, useState } from "react";
import {
  THEME_COLORS,
  THEME_STORAGE_KEY,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
} from "./themePref";

const ThemeContext = createContext(null);
const DARK_QUERY = "(prefers-color-scheme: dark)";

// Reading `window.localStorage` itself throws when storage is blocked.
function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function prefersDark() {
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  return resolveTheme(readStoredTheme(getStorage()), prefersDark());
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    // The theme-color metas are keyed on the OS scheme; point both at the
    // app's theme so the mobile status bar matches an in-app override.
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((m) => m.setAttribute("content", THEME_COLORS[theme]));
  }, [theme]);

  // Until the user picks a theme, follow the OS (e.g. automatic dark mode at
  // night). Also pick up a choice made in another tab.
  useEffect(() => {
    const sync = () => setTheme(resolveTheme(readStoredTheme(getStorage()), prefersDark()));
    const mq = typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
    const onStorage = (e) => {
      if (e.key === THEME_STORAGE_KEY || e.key === null) sync();
    };
    mq?.addEventListener?.("change", sync);
    window.addEventListener("storage", onStorage);
    return () => {
      mq?.removeEventListener?.("change", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Only an explicit toggle is saved, so a first visit doesn't pin the OS
  // setting of that moment.
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    writeStoredTheme(getStorage(), next);
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
