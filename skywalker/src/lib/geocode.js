// Place search + reverse geocoding via Photon (komoot's OpenStreetMap
// geocoder). Photon rather than Nominatim because Nominatim's usage policy
// forbids client-side search-as-you-type. Both calls are best-effort: callers
// always have a local fallback (country polygon / raw coordinates), so
// network errors resolve to null / [] instead of throwing — except aborts.

const PHOTON_URL = "https://photon.komoot.io";
// Reverse lookups only count a place within this many km as "here", so a pin
// dropped mid-ocean doesn't borrow the name of the nearest coastal town.
const REVERSE_RADIUS_KM = 40;
const SEARCH_LIMIT = 5;

const LOCALITY_TYPES = new Set(["city", "town", "village", "hamlet", "suburb", "island", "locality"]);

const reverseCache = new Map();
const searchCache = new Map();

const cacheKeyFor = (lat, lng) => `${lat.toFixed(2)}:${lng.toFixed(2)}`;
const uniq = (parts) => parts.filter((part, i) => part && parts.indexOf(part) === i);

async function photon(path, params, signal) {
  const url = `${PHOTON_URL}${path}?${new URLSearchParams({ lang: "en", ...params })}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  return (await res.json()).features ?? [];
}

/** "Kyoto, Japan" from a Photon feature's properties. */
function reverseLabel(p) {
  if (p.type === "country") return p.country ?? p.name;
  const locality =
    p.city || p.town || p.village || (LOCALITY_TYPES.has(p.osm_value) ? p.name : null) || p.county || p.state;
  return uniq([locality, p.country]).join(", ") || null;
}

/** Synchronous cache peek, so a re-opened coordinate shows its name instantly. */
export function cachedPlaceName(lat, lng) {
  return reverseCache.get(cacheKeyFor(lat, lng)) ?? null;
}

/**
 * Human place name ("Kyoto, Japan") for a coordinate, or null if nothing is
 * nearby / the service is unreachable. Rejects only on abort.
 */
export async function reverseGeocode(lat, lng, { signal } = {}) {
  const key = cacheKeyFor(lat, lng);
  if (reverseCache.has(key)) return reverseCache.get(key);
  try {
    const [feature] = await photon(
      "/reverse",
      { lat: String(lat), lon: String(lng), radius: String(REVERSE_RADIUS_KM), limit: "1" },
      signal
    );
    const name = feature ? reverseLabel(feature.properties) : null;
    reverseCache.set(key, name);
    return name;
  } catch (err) {
    if (err.name === "AbortError") throw err;
    console.warn("Reverse geocoding failed", err);
    return null;
  }
}

/**
 * Free-text place search ("Santorini") -> [{ label, sublabel, lat, lng }].
 * Resolves [] on network failure; rejects only on abort.
 */
export async function searchPlaces(query, { signal } = {}) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (searchCache.has(q)) return searchCache.get(q);
  try {
    const features = await photon("/api/", { q, limit: String(SEARCH_LIMIT) }, signal);
    const results = features.map(({ properties: p, geometry }) => {
      const [lng, lat] = geometry.coordinates;
      const label = p.name ?? reverseLabel(p);
      return {
        label,
        sublabel: uniq([p.city, p.state, p.country]).filter((part) => part !== label).join(", "),
        placeName: uniq([label, p.country]).join(", "),
        lat,
        lng,
      };
    });
    searchCache.set(q, results);
    return results;
  } catch (err) {
    if (err.name === "AbortError") throw err;
    console.warn("Place search failed", err);
    return [];
  }
}
