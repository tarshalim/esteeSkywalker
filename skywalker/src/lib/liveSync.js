import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

// Keeps open views (the globe, its quick cards) current when posts or pins
// change, without a page refresh:
//   * this tab   — the stores call notifyDataChanged() after every write
//   * other tabs — the same notice over a BroadcastChannel
//   * other users — Supabase Realtime row changes (see the
//     location_trip_hierarchy migration, which adds `locations`, `trips`,
//     `trip_companions`, `gallery_items` and `blogs` to the realtime publication)

const EVENT = "skywalker:data-changed";
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("skywalker-data") : null;
// A save fires the local event and then echoes back over Realtime; one reload covers both.
const RELOAD_DEBOUNCE_MS = 250;

/** @param {"blogs"|"locations"|"trips"|"trip_companions"|"gallery_items"} table - a real table name: Realtime subscribes by it */
export function notifyDataChanged(table) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { table } }));
  channel?.postMessage({ table });
}

/**
 * Calls `onChange` (debounced) whenever one of `tables` changes anywhere.
 * @param {string[]} tables
 * @param {function(): void} onChange
 */
export function useDataChanges(tables, onChange) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const tablesKey = tables.join(",");

  useEffect(() => {
    const watched = new Set(tablesKey.split(","));
    let timeout = null;
    const schedule = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => onChangeRef.current(), RELOAD_DEBOUNCE_MS);
    };
    const onLocal = (e) => watched.has(e.detail?.table) && schedule();
    const onRemoteTab = (e) => watched.has(e.data?.table) && schedule();

    window.addEventListener(EVENT, onLocal);
    channel?.addEventListener("message", onRemoteTab);

    let realtime = null;
    if (supabase) {
      realtime = supabase.channel(`live:${tablesKey}:${Math.random().toString(36).slice(2)}`);
      for (const table of watched) {
        realtime.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
      }
      realtime.subscribe();
    }

    return () => {
      clearTimeout(timeout);
      window.removeEventListener(EVENT, onLocal);
      channel?.removeEventListener("message", onRemoteTab);
      if (realtime) supabase.removeChannel(realtime);
    };
  }, [tablesKey]);
}
