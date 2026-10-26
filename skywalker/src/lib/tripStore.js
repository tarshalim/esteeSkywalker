import { delay, readJSON, writeJSON, makeId } from "./storage";
import { supabase, unwrap } from "./supabase";
import { notifyDataChanged } from "./liveSync";
import { deleteOrphanedMedia } from "./files";
import { sortStops, validateTrip } from "./hierarchy";

// Trips API: Supabase `trips` + `trip_companions` + `trip_stops` when
// configured, otherwise a localStorage mock (companions and stops embedded in
// the trip). Every function returns a Promise so callers don't care which
// backend is active.
//
// A trip has one home Location (`locationId`, the globe pin) and holds the
// posts and gallery items written/taken on it. Its `stops` are the itinerary
// (one or many places, each with its own dates), always in journey order.

/** @typedef {import("../types/hierarchy").Trip} Trip */
/** @typedef {import("../types/hierarchy").TripCompanionInterval} TripCompanionInterval */
/** @typedef {import("../types/hierarchy").TripStop} TripStop */

const TRIPS_KEY = "skywalker.trips.v1";

const COMPANION_COLUMNS = "id, start_date, end_date, companion_names";
const STOP_COLUMNS =
  "id, location_name, country, country_code, continent, latitude, longitude, start_date, end_date, sequence_order";
const TRIP_SELECT = `data, trip_companions(${COMPANION_COLUMNS}), trip_stops(${STOP_COLUMNS})`;

/** @returns {TripCompanionInterval} */
const fromCompanionRow = (row) => ({ id: row.id, startDate: row.start_date, endDate: row.end_date, names: row.companion_names ?? [] });

/** @returns {TripStop} */
const fromStopRow = (row) => ({
  id: row.id,
  locationName: row.location_name,
  country: row.country ?? "",
  countryCode: row.country_code ?? "",
  continent: row.continent ?? "",
  lat: row.latitude,
  lng: row.longitude,
  startDate: row.start_date,
  endDate: row.end_date,
  sequenceOrder: row.sequence_order,
});

const byStart = (a, b) => a.startDate.localeCompare(b.startDate);

/** @returns {Trip} */
function fromTripRow(row) {
  return {
    ...row.data,
    companions: (row.trip_companions ?? []).map(fromCompanionRow).sort(byStart),
    stops: sortStops((row.trip_stops ?? []).map(fromStopRow)),
  };
}

/** Mock trips saved before stops existed have none. */
const withStops = (trip) => ({ ...trip, stops: sortStops(trip.stops ?? []) });

/** @returns {Promise<Trip[]>} newest first */
export async function getTrips() {
  if (supabase) {
    const rows = unwrap(await supabase.from("trips").select(TRIP_SELECT).order("start_date", { ascending: false }));
    return rows.map(fromTripRow);
  }
  return delay([...readJSON(TRIPS_KEY, [])].sort((a, b) => b.startDate.localeCompare(a.startDate)).map(withStops));
}

/** @returns {Promise<?Trip>} */
export async function getTripById(id) {
  if (supabase) {
    const row = unwrap(await supabase.from("trips").select(TRIP_SELECT).eq("id", id).maybeSingle());
    return row ? fromTripRow(row) : null;
  }
  const trip = readJSON(TRIPS_KEY, []).find((t) => t.id === id);
  return delay(trip ? withStops(trip) : null);
}

function normalizeCompanions(companions = []) {
  return companions
    .map((c) => ({
      id: c.id || makeId("cmp"),
      startDate: c.startDate,
      endDate: c.endDate || c.startDate,
      names: [...new Set((c.names ?? []).map((n) => n.trim()).filter(Boolean))],
    }))
    .filter((c) => c.names.length > 0)
    .sort(byStart);
}

const toCoord = (value) => (value === "" || value == null ? null : Number(value));

/**
 * Trims and types the stops, puts them in journey order (date, then the
 * order they were listed in) and renumbers `sequenceOrder` to match.
 * @returns {TripStop[]}
 */
function normalizeStops(stops = []) {
  const cleaned = stops.map((s, i) => ({
    id: s.id || makeId("stop"),
    locationName: (s.locationName ?? "").trim(),
    country: (s.country ?? "").trim(),
    countryCode: (s.countryCode ?? "").trim().toUpperCase(),
    continent: (s.continent ?? "").trim(),
    lat: toCoord(s.lat),
    lng: toCoord(s.lng),
    startDate: s.startDate,
    endDate: s.endDate || s.startDate,
    sequenceOrder: i,
  }));
  return sortStops(cleaned).map((s, i) => ({ ...s, sequenceOrder: i }));
}

/**
 * Creates or updates a trip together with its companion intervals and stops
 * (both replaced wholesale). Throws with a readable message when the dates
 * don't line up.
 * @param {Partial<Trip> & { locationId: string, title: string, startDate: string, endDate: string }} input
 * @returns {Promise<Trip>}
 */
export async function saveTrip(input) {
  const now = new Date().toISOString();
  // Picked field by field: callers may pass a trip with posts/photos joined on.
  const trip = {
    id: input.id || makeId("trip"),
    locationId: input.locationId,
    title: (input.title ?? "").trim(),
    coverImage: input.coverImage ?? "",
    startDate: input.startDate,
    endDate: input.endDate || input.startDate,
    note: input.note ?? "",
    companions: normalizeCompanions(input.companions),
    stops: normalizeStops(input.stops),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
  const error = validateTrip(trip);
  if (error) throw new Error(error);

  if (supabase) {
    const { companions, stops, ...data } = trip;
    unwrap(await supabase.rpc("save_trip", { trip: data, companions, stops }));
    notifyDataChanged("trips");
    return trip;
  }
  const trips = readJSON(TRIPS_KEY, []);
  const idx = trips.findIndex((t) => t.id === trip.id);
  if (idx === -1) trips.push(trip);
  else trips[idx] = { ...trips[idx], ...trip, createdAt: trips[idx].createdAt };
  writeJSON(TRIPS_KEY, trips);
  await delay();
  notifyDataChanged("trips");
  return trip;
}

/**
 * Deletes a trip. Its posts and photos stay, unfiled from it (blogs.trip_id /
 * gallery_items.trip_id are ON DELETE SET NULL; the mock mirrors that).
 */
export async function deleteTrip(id) {
  if (supabase) {
    const deleted = unwrap(await supabase.from("trips").delete().eq("id", id).select("data"));
    if (deleted.length === 0) throw new Error("This trip may already be gone, or you don't have permission to delete it.");
    // Its cover upload; the trip is gone either way, leftover files are only logged.
    await deleteOrphanedMedia(deleted[0].data, `trip ${id}`);
  } else {
    writeJSON(TRIPS_KEY, readJSON(TRIPS_KEY, []).filter((t) => t.id !== id));
    for (const key of ["skywalker.blogs.v1", "skywalker.photos.v1"]) {
      writeJSON(key, readJSON(key, []).map((item) => (item.tripId === id ? { ...item, tripId: null } : item)));
    }
    await delay();
  }
  notifyDataChanged("trips");
  return true;
}
