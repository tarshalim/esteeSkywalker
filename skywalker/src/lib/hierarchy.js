import { formatDateRange } from "./dateFilters";

// Pure helpers for the Location -> Trip -> (posts, gallery items) hierarchy.
// No store imports, so filters, pickers and search can all share them.

/** @typedef {import("../types/hierarchy").Trip} Trip */
/** @typedef {import("../types/hierarchy").TripDraft} TripDraft */
/** @typedef {import("../types/hierarchy").TripStop} TripStop */
/** @typedef {import("../types/hierarchy").GalleryItem} GalleryItem */

/** TripSelect's value for "create a new trip". */
export const NEW_TRIP = "new";

const todayISO = () => new Date().toISOString().slice(0, 10);

/** @returns {TripDraft} */
export function emptyTripDraft(startDate = todayISO(), endDate = startDate) {
  return { title: "", coverImage: "", startDate, endDate, note: "", companions: [], stops: [] };
}

/** @returns {TripDraft} */
export function draftFromTrip(trip) {
  return {
    title: trip.title,
    coverImage: trip.coverImage ?? "",
    startDate: trip.startDate,
    endDate: trip.endDate,
    note: trip.note ?? "",
    companions: (trip.companions ?? []).map((c) => ({ ...c, names: [...c.names] })),
    stops: sortStops(trip.stops ?? []).map((s) => ({ ...s })),
  };
}

/**
 * Stops in journey order: by start date, then `sequenceOrder` for stops
 * starting the same day. Returns a new array.
 * @param {TripStop[]} stops
 */
export function sortStops(stops) {
  return [...stops].sort(
    (a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? "") || (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0)
  );
}

const isCoord = (value, limit) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;

/** Whether a stop has been placed on the globe. */
export const stopHasCoords = (stop) => isCoord(stop?.lat, 90) && isCoord(stop?.lng, 180);

let stopRowSeq = 0;

/**
 * A blank itinerary row to append to `stops`: it starts the day the last one
 * ends (or the trip's first day) and has no place yet. The `new-` id is
 * replaced by tripStore on save.
 * @param {TripStop[]} stops
 * @returns {TripStop}
 */
export function blankStop(stops, tripStart, tripEnd) {
  const last = stops.at(-1);
  const startDate = last?.endDate && last.endDate <= tripEnd ? last.endDate : tripStart;
  return {
    id: `new-${Date.now().toString(36)}-${stopRowSeq++}`,
    locationName: "",
    country: "",
    countryCode: "",
    continent: "",
    lat: "",
    lng: "",
    startDate,
    endDate: startDate,
    sequenceOrder: stops.length,
  };
}

/**
 * Consecutive placed stops of a trip, as the legs of its route:
 * [{ from, to, index }]. Unplaced stops are skipped over, not breaks.
 * @param {Trip} trip
 */
export function journeyLegs(trip) {
  const placed = sortStops(trip.stops ?? []).filter(stopHasCoords);
  return placed.slice(1).map((to, i) => ({ from: placed[i], to, index: i }));
}

/**
 * The posts set at `stop`: those naming it, plus — on a single-stop trip,
 * where "anywhere on the trip" can only mean there — those naming no stop.
 * @param {{ stops?: TripStop[], posts?: import("../types/hierarchy").BlogPost[] }} trip
 * @param {TripStop} stop
 */
export function postsAtStop(trip, stop) {
  const onlyStop = (trip.stops ?? []).length === 1;
  return (trip.posts ?? []).filter((p) => p.stopId === stop.id || (onlyStop && !p.stopId));
}

/**
 * The globe pins for a trip: one per placed stop, in journey order, each
 * numbered and carrying the posts set there. A 1-stop trip is a single pin;
 * a many-stop trip is a route of pins joined by journeyLegs' arcs.
 * @param {import("../types/hierarchy").TripNode} trip
 * @param {string} locationId - the trip's home location (whose card the pin opens)
 * @returns {import("../types/hierarchy").StopPin[]}
 */
export function stopPinsOf(trip, locationId = trip.locationId) {
  const placed = sortStops(trip.stops ?? []).filter(stopHasCoords);
  return placed.map((stop, i) => ({
    ...stop,
    id: `stop:${trip.id}:${stop.id}`,
    stopId: stop.id,
    tripId: trip.id,
    pinId: locationId,
    tripTitle: trip.title,
    order: i + 1,
    stopCount: placed.length,
    posts: postsAtStop(trip, stop),
  }));
}

/** Unique countries / continents a trip visits, in journey order. */
export function tripCountries(trip) {
  return [...new Set(sortStops(trip?.stops ?? []).map((s) => s.country).filter(Boolean))];
}
export function tripContinents(trip) {
  return [...new Set(sortStops(trip?.stops ?? []).map((s) => s.continent).filter(Boolean))];
}

/** "Santiago → Cusco → La Paz"; repeated places in a row collapse to one. */
export function routeLabel(trip) {
  const names = sortStops(trip?.stops ?? []).map((s) => s.locationName);
  return names.filter((name, i) => name && name !== names[i - 1]).join(" → ");
}

/** The stop a post is set at, if it names one of its trip's stops. */
export function stopForPost(blog, trip) {
  return (blog?.stopId && trip?.stops?.find((s) => s.id === blog.stopId)) || null;
}

/**
 * The { continent, country, countryCode } regions a trip covers: its stops',
 * else `fallback` (e.g. its home pin's country, or its posts') for trips
 * without stops. Unique by country, in journey order.
 * @param {Trip} trip
 * @param {{ continent?: string, country?: string, countryCode?: string }[]} [fallback]
 */
export function tripRegions(trip, fallback = []) {
  const stops = sortStops(trip?.stops ?? []);
  const source = stops.some((s) => s.country || s.continent) ? stops : fallback;
  const seen = new Set();
  const regions = [];
  for (const r of source) {
    const region = { continent: r.continent || "", country: r.country || "", countryCode: r.countryCode || "" };
    const key = `${region.continent}|${region.countryCode || region.country}`;
    if ((!region.continent && !region.country) || seen.has(key)) continue;
    seen.add(key);
    regions.push(region);
  }
  return regions;
}

/**
 * Trips grouped Continent -> Country, A–Z, each trip under every country it
 * visits (a Chile–Peru–Bolivia trip sits under all three). Trips with no
 * known region go under "" (the caller labels it).
 * @param {Trip[]} trips
 * @param {(trip: Trip) => ReturnType<typeof tripRegions>} regionsOf
 * @returns {{ continent: string, trips: Trip[], countries: { country: string, countryCode: string, trips: Trip[] }[] }[]}
 */
export function groupTripsByRegion(trips, regionsOf) {
  const continents = new Map();
  const add = (map, key, make, trip) => {
    if (!map.has(key)) map.set(key, make());
    const group = map.get(key);
    if (!group.trips.includes(trip)) group.trips.push(trip);
    return group;
  };
  for (const trip of trips) {
    const regions = regionsOf(trip);
    for (const r of regions.length > 0 ? regions : [{ continent: "", country: "", countryCode: "" }]) {
      const continent = add(continents, r.continent, () => ({ continent: r.continent, trips: [], countries: new Map() }), trip);
      if (r.country || r.countryCode) {
        add(continent.countries, r.countryCode || r.country, () => ({ country: r.country || r.countryCode, countryCode: r.countryCode, trips: [] }), trip);
      }
    }
  }
  // Named groups A–Z; the unknown bucket last.
  const byName = (a, b) => (!a ? 1 : !b ? -1 : a.localeCompare(b));
  return [...continents.values()]
    .sort((a, b) => byName(a.continent, b.continent))
    .map((c) => ({ ...c, countries: [...c.countries.values()].sort((a, b) => byName(a.country, b.country)) }));
}

/** "Kyoto Food Tour · Oct 1 – Oct 9, 2026" */
export function tripLabel(trip) {
  return `${trip.title} · ${formatDateRange(trip.startDate, trip.endDate)}`;
}

/** Does [start, end] (yyyy-mm-dd, `end` optional) sit inside the trip's dates? */
export function isWithinTrip(trip, start, end = start) {
  return Boolean(start) && start >= trip.startDate && (end || start) <= trip.endDate;
}

/**
 * The trip at `locationId` that a photo taken on `day` (yyyy-mm-dd) most
 * likely belongs to: the shortest one covering that day, or null.
 * @param {Trip[]} trips
 */
export function tripCovering(trips, locationId, day) {
  if (!locationId || !day) return null;
  const span = (t) => Date.parse(t.endDate) - Date.parse(t.startDate);
  return (
    trips
      .filter((t) => t.locationId === locationId && isWithinTrip(t, day))
      .sort((a, b) => span(a) - span(b))[0] ?? null
  );
}

/**
 * Why a trip's name and dates aren't usable yet, or null — step 1 of the
 * new-trip wizard, before its stops are added.
 * @param {TripDraft | Trip} trip
 */
export function validateTripBasics(trip) {
  if (!trip.title?.trim()) return "Give the trip a name";
  if (!trip.startDate) return "Pick the trip's start date";
  if (!trip.endDate) return "Pick the trip's end date";
  if (trip.endDate < trip.startDate) return "The trip can't end before it starts";
  return null;
}

/**
 * Why a trip (or draft) can't be saved, or null. Companion intervals must sit
 * inside the trip and name at least one person; stops must sit inside the
 * trip, have a name, and either valid coordinates or none.
 * @param {TripDraft | Trip} trip
 */
export function validateTrip(trip) {
  const basics = validateTripBasics(trip);
  if (basics) return basics;
  for (const c of trip.companions ?? []) {
    const who = c.names?.filter((n) => n.trim()).join(", ") || "Companions";
    if (!c.startDate || !c.endDate) return `${who}: pick both dates`;
    if (c.endDate < c.startDate) return `${who}: the end date is before the start date`;
    if (c.startDate < trip.startDate || c.endDate > trip.endDate) return `${who}: dates must fall within the trip`;
  }
  for (const [i, s] of (trip.stops ?? []).entries()) {
    const where = s.locationName?.trim() || `Stop ${i + 1}`;
    if (!s.locationName?.trim()) return `Stop ${i + 1}: give it a place name`;
    if (!s.startDate || !s.endDate) return `${where}: pick both dates`;
    if (s.endDate < s.startDate) return `${where}: the end date is before the start date`;
    if (s.startDate < trip.startDate || s.endDate > trip.endDate) return `${where}: dates must fall within the trip`;
    const hasLat = s.lat != null && s.lat !== "";
    const hasLng = s.lng != null && s.lng !== "";
    if (hasLat !== hasLng) return `${where}: enter both latitude and longitude, or neither`;
    if (hasLat && !stopHasCoords({ lat: Number(s.lat), lng: Number(s.lng) })) return `${where}: those coordinates aren't on the globe`;
  }
  return null;
}

/** Names of everyone with the trip at any point in [start, end] (yyyy-mm-dd, inclusive). */
export function companionsDuring(trip, start, end = start) {
  if (!trip || !start) return [];
  const names = new Set();
  for (const c of trip.companions ?? []) {
    if (c.startDate <= end && c.endDate >= start) c.names.forEach((n) => names.add(n));
  }
  return [...names];
}

/** Everyone who came on the trip at some point. */
export const allCompanions = (trip) => companionsDuring(trip, trip?.startDate, trip?.endDate);

/** Companions for a post: those overlapping its own dates within its trip. */
export function companionsForPost(blog, trip) {
  if (!trip) return [];
  const start = blog.startDate ?? blog.postDate ?? blog.date ?? trip.startDate;
  return companionsDuring(trip, start, blog.endDate || start);
}

/** Companions for a photo: those with the trip on the day it was taken. */
export function companionsForPhoto(item, trip) {
  if (!trip) return [];
  const day = (item.timestamp ?? "").slice(0, 10) || trip.startDate;
  return companionsDuring(trip, day, day);
}

/**
 * How a gallery item hangs off the hierarchy.
 * @param {GalleryItem} item
 * @returns {import("../types/hierarchy").Attachment}
 */
export function attachmentOf(item) {
  if (item.blogId) return "blog";
  return item.tripId ? "standalone" : "unfiled";
}

export const ATTACHMENT_FILTERS = [
  { id: "", label: "All photos" },
  { id: "blog", label: "Blog-attached only" },
  { id: "standalone", label: "Standalone trip photos" },
];

/** Splits "Aiko, Ben ,  " into ["Aiko", "Ben"]. */
export function parseNames(text) {
  return [...new Set(text.split(",").map((n) => n.trim()).filter(Boolean))];
}

/** Parses "street food, temples" into lower-case tags. */
export function parseTags(text) {
  return [...new Set(text.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

/**
 * The trips that `items` (posts or gallery items, already narrowed by place
 * and date) point at — the options for a cascading Trip filter.
 * @param {Trip[]} trips
 * @param {{ tripId?: ?string }[]} items
 */
export function tripsReferencedBy(trips, items) {
  const ids = new Set(items.map((i) => i.tripId).filter(Boolean));
  return trips.filter((t) => ids.has(t.id));
}

/** Sorted unique companion names across `trips`. */
export function companionOptions(trips) {
  const names = new Set();
  for (const trip of trips) allCompanions(trip).forEach((n) => names.add(n));
  return [...names].sort((a, b) => a.localeCompare(b));
}
