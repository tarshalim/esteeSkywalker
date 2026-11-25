import { hasCoords } from "./geo";

// A post's `location` as the editor saves it and reads it back. The stored
// object also feeds the globe, search and readers, which need a name and,
// where possible, a point, so the editor fills gaps with fallbacks. Those
// fallbacks must not come back as if the writer had entered them.

/** What a post with no waypoint name and no country is called. */
export const UNNAMED_WAYPOINT = "Unnamed waypoint";

/**
 * The `location` to save. `coords` is the exact spot the writer picked (or
 * null); without one, `centroid` (the country's) still places the post on the
 * globe and is marked `approx` so it isn't read back as a picked spot.
 * `lat`/`lng` are always present (null when there's no point), because
 * `upsertBlog` merges `location` into the stored one and would otherwise keep
 * a cleared spot.
 * @param {{ name: string, coords: ?{lat: number, lng: number}, countryName?: string, centroid?: ?{lat: number, lng: number} }} input
 */
export function postLocationPayload({ name, coords, countryName = "", centroid = null }) {
  const exact = hasCoords(coords);
  const point = exact ? coords : hasCoords(centroid) ? centroid : null;
  return {
    name: name.trim() || countryName || UNNAMED_WAYPOINT,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    approx: !exact && point !== null,
  };
}

/**
 * The editor fields for a stored `location`: the typed waypoint name ("" for
 * the placeholder name) and the exact spot (null for a country centroid).
 * @returns {{ name: string, coords: ?{lat: number, lng: number} }}
 */
export function postLocationFields(location) {
  const name = location?.name ?? "";
  return {
    name: name === UNNAMED_WAYPOINT ? "" : name,
    coords: hasCoords(location) && !location.approx ? { lat: location.lat, lng: location.lng } : null,
  };
}

/** True when the post has a spot the writer picked, not just a country centroid. */
export const hasExactCoords = (location) => hasCoords(location) && !location.approx;
