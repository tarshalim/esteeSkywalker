import { mockCustomPins } from "../data/mockData";
import { delay, readJSON, writeJSON } from "./storage";
import { supabase, unwrap, fromRows } from "./supabase";

// Pins API: Supabase `pins` table when configured, otherwise a localStorage
// mock mirroring blogStore.js's pattern. Every function returns a Promise so
// callers (GlobeExplorer) don't care which backend is active.

const PINS_KEY = "skywalker.pins.v1";

function ensureSeeded() {
  if (localStorage.getItem(PINS_KEY) == null) {
    writeJSON(PINS_KEY, mockCustomPins);
  }
}

export async function getPins() {
  if (supabase) {
    return fromRows(unwrap(await supabase.from("pins").select("data").order("created_at")));
  }
  ensureSeeded();
  return delay(readJSON(PINS_KEY, []));
}

export async function createPin({ lat, lng, title, note = "" }) {
  const pin = {
    id: `pin_${Date.now().toString(36)}`,
    lat,
    lng,
    title,
    note,
    createdAt: new Date().toISOString(),
  };
  if (supabase) {
    unwrap(await supabase.from("pins").insert({ id: pin.id, data: pin }));
    return pin;
  }
  ensureSeeded();
  const pins = readJSON(PINS_KEY, []);
  pins.push(pin);
  writeJSON(PINS_KEY, pins);
  return delay(pin);
}

export async function deletePin(id) {
  if (supabase) {
    unwrap(await supabase.from("pins").delete().eq("id", id));
    return true;
  }
  ensureSeeded();
  const pins = readJSON(PINS_KEY, []).filter((p) => p.id !== id);
  writeJSON(PINS_KEY, pins);
  return delay(true);
}
