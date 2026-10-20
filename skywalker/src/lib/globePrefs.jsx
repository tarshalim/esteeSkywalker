import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

const GlobePrefsContext = createContext(null);
const STORAGE_KEY = "skywalker-globe-prefs";
// Remote saves wait for toggling to settle so a burst of clicks is one request.
const REMOTE_SAVE_DEBOUNCE_MS = 600;

// eslint-disable-next-line react-refresh/only-export-components
export const DEFAULT_GLOBE_PREFS = {
  labelMode: "hover", // "hover" | "always"
  showBorders: true,
  showGrid: false,
  showAtmosphere: true,
  autoRotate: true,
};

// Keeps only known keys whose type matches the default, so a stale or
// hand-edited blob can't put garbage into the globe props.
function sanitize(raw) {
  const clean = {};
  if (!raw || typeof raw !== "object") return clean;
  for (const [key, fallback] of Object.entries(DEFAULT_GLOBE_PREFS)) {
    if (typeof raw[key] === typeof fallback) clean[key] = raw[key];
  }
  if (clean.labelMode && clean.labelMode !== "hover" && clean.labelMode !== "always") delete clean.labelMode;
  return clean;
}

function readLocal() {
  try {
    return { ...DEFAULT_GLOBE_PREFS, ...sanitize(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}")) };
  } catch {
    return DEFAULT_GLOBE_PREFS;
  }
}

const samePrefs = (a, b) => Object.keys(DEFAULT_GLOBE_PREFS).every((key) => a?.[key] === b?.[key]);

/**
 * Globe display preferences, edited on the Account page and read by
 * GlobeExplorer. Context state means a change applies to the globe at once;
 * it's mirrored to localStorage always, and to the signed-in user's Supabase
 * user_metadata (`globe_prefs`) so it follows them across devices.
 */
export function GlobePrefsProvider({ children }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(readLocal);
  const userId = user?.id;
  const userRef = useRef(user);
  userRef.current = user;

  // On sign-in the account's saved prefs win over this browser's.
  useEffect(() => {
    if (!userId) return;
    const saved = userRef.current?.user_metadata?.globe_prefs;
    if (saved) setPrefs((prev) => ({ ...prev, ...sanitize(saved) }));
  }, [userId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Storage blocked (private mode etc.) — prefs just last this session.
    }
  }, [prefs]);

  useEffect(() => {
    if (!supabase || !userId) return;
    if (samePrefs(prefs, userRef.current?.user_metadata?.globe_prefs)) return;
    const timeout = setTimeout(async () => {
      // updateUser merges into user_metadata, so display_name/avatar survive.
      const { error } = await supabase.auth.updateUser({ data: { globe_prefs: prefs } });
      if (error) console.error("Failed to save globe settings", error);
    }, REMOTE_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [prefs, userId]);

  const setPref = useCallback((key, value) => setPrefs((prev) => ({ ...prev, [key]: value })), []);

  const value = useMemo(
    () => ({ prefs, setPref, syncsToAccount: Boolean(supabase && userId) }),
    [prefs, setPref, userId]
  );

  return <GlobePrefsContext.Provider value={value}>{children}</GlobePrefsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGlobePrefs() {
  const ctx = useContext(GlobePrefsContext);
  if (!ctx) throw new Error("useGlobePrefs must be used within a GlobePrefsProvider");
  return ctx;
}
