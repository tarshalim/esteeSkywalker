import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { VIBES } from "./blogTaxonomy";

const STORAGE_KEY = "skywalker-vibes";
export const MAX_VIBE_LABEL = 32;

// Keeps only well-formed { id, label } entries with unique ids, so a stale or
// hand-edited blob can't break the chips. null means "nothing usable saved".
function sanitize(raw) {
  if (!Array.isArray(raw)) return null;
  const seen = new Set();
  const clean = [];
  for (const v of raw) {
    if (typeof v?.id !== "string" || typeof v?.label !== "string") continue;
    const label = v.label.trim().slice(0, MAX_VIBE_LABEL);
    if (!v.id || !label || seen.has(v.id)) continue;
    seen.add(v.id);
    clean.push({ id: v.id, label });
  }
  return clean;
}

function readLocal() {
  try {
    return sanitize(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return null;
  }
}

const newVibeId = () => `v-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * The user's own vibe list, seeded from the built-in VIBES. Posts store vibe
 * ids, so a rename shows up on every post; a deleted vibe's id just stops
 * resolving to a label. Mirrored to localStorage always, and to the signed-in
 * user's Supabase user_metadata (`vibes`) so it follows them across devices.
 */
export function useVibes() {
  const { user } = useAuth();
  const userId = user?.id;
  const userRef = useRef(user);
  userRef.current = user;
  const [vibes, setVibes] = useState(() => sanitize(user?.user_metadata?.vibes) ?? readLocal() ?? VIBES);

  // On sign-in the account's saved list wins over this browser's.
  useEffect(() => {
    if (!userId) return;
    const saved = sanitize(userRef.current?.user_metadata?.vibes);
    if (saved) setVibes(saved);
  }, [userId]);

  const save = useCallback(
    (next) => {
      setVibes(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage blocked (private mode etc.) — the account copy still saves.
      }
      if (!supabase || !userId) return;
      // updateUser merges into user_metadata, so other keys survive.
      supabase.auth.updateUser({ data: { vibes: next } }).then(({ error }) => {
        if (error) console.error("Failed to save vibes", error);
      });
    },
    [userId]
  );

  /** Adds a vibe and returns its id, or the existing one's id if the label is taken. */
  const addVibe = useCallback(
    (label) => {
      const clean = label.trim().slice(0, MAX_VIBE_LABEL);
      if (!clean) return null;
      const existing = vibes.find((v) => v.label.toLowerCase() === clean.toLowerCase());
      if (existing) return existing.id;
      const id = newVibeId();
      save([...vibes, { id, label: clean }]);
      return id;
    },
    [vibes, save]
  );

  const renameVibe = useCallback(
    (id, label) => {
      const clean = label.trim().slice(0, MAX_VIBE_LABEL);
      if (!clean) return;
      save(vibes.map((v) => (v.id === id ? { ...v, label: clean } : v)));
    },
    [vibes, save]
  );

  const deleteVibe = useCallback((id) => save(vibes.filter((v) => v.id !== id)), [vibes, save]);

  return { vibes, addVibe, renameVibe, deleteVibe };
}
