import { mockCustomPins } from "../data/mockData";
import { makeId } from "./storage";
import { createCollection } from "./collection";

// Pins API: Supabase `pins` table when configured, otherwise a localStorage
// mock. Every function returns a Promise so callers (GlobeExplorer) don't
// care which backend is active.

const pins = createCollection({ table: "pins", storageKey: "skywalker.pins.v1", seed: mockCustomPins });

export const getPins = pins.list;
export const deletePin = pins.remove;

export function createPin({ lat, lng, title, note = "" }) {
  return pins.insert({
    id: makeId("pin"),
    lat,
    lng,
    title,
    note,
    createdAt: new Date().toISOString(),
  });
}
