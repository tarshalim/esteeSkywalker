import { delay, readJSON, writeJSON, makeId } from "./storage";
import { supabase, unwrap } from "./supabase";
import { notifyDataChanged } from "./liveSync";
import { validateTrip } from "./hierarchy";

// Trips API: Supabase `trips` + `trip_companions` when configured, otherwise
// a localStorage mock (companions embedded in the trip). Every function
// returns a Promise so callers don't care which backend is active.
//
// A trip belongs to one Location (`locationId`, the globe pin) and holds the
// posts and gallery items written/taken on it.

/** @typedef {import("../types/hierarchy").Trip} Trip */
/** @typedef {import("../types/hierarchy").TripCompanionInterval} TripCompanionInterval */

const TRIPS_KEY = "skywalker.trips.v1";

const COMPANION_COLUMNS = "id, start_date, end_date, companion_names";

/** @returns {TripCompanionInterval} */
const fromCompanionRow = (row) => ({ id: row.id, startDate: row.start_date, endDate: row.end_date, names: row.companion_names ?? [] });

const byStart = (a, b) => a.startDate.localeCompare(b.startDate);

/** @returns {Trip} */
function fromTripRow(row) {
  return { ...row.data, companions: (row.trip_companions ?? []).map(fromCompanionRow).sort(byStart) };
}

/** @returns {Promise<Trip[]>} newest first */
export async function getTrips() {
  if (supabase) {
    const rows = unwrap(
      await supabase.from("trips").select(`data, trip_companions(${COMPANION_COLUMNS})`).order("start_date", { ascending: false })
    );
    return rows.map(fromTripRow);
  }
  return delay([...readJSON(TRIPS_KEY, [])].sort((a, b) => b.startDate.localeCompare(a.startDate)));
}

/** @returns {Promise<?Trip>} */
export async function getTripById(id) {
  if (supabase) {
    const row = unwrap(
      await supabase.from("trips").select(`data, trip_companions(${COMPANION_COLUMNS})`).eq("id", id).maybeSingle()
    );
    return row ? fromTripRow(row) : null;
  }
  return delay(readJSON(TRIPS_KEY, []).find((t) => t.id === id) ?? null);
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

/**
 * Creates or updates a trip together with its companion intervals (replaced
 * wholesale). Throws with a readable message when the dates don't line up.
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
    startDate: input.startDate,
    endDate: input.endDate || input.startDate,
    note: input.note ?? "",
    companions: normalizeCompanions(input.companions),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
  const error = validateTrip(trip);
  if (error) throw new Error(error);

  if (supabase) {
    const { companions, ...data } = trip;
    unwrap(await supabase.rpc("save_trip", { trip: data, companions }));
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
    const deleted = unwrap(await supabase.from("trips").delete().eq("id", id).select("id"));
    if (deleted.length === 0) throw new Error("This trip may already be gone, or you don't have permission to delete it.");
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
