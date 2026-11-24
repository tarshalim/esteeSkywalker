import { readJSON, writeJSON } from "./storage";

// Mock mode's stand-in for what the database does on its own when a row
// changes: the FK actions (ON DELETE CASCADE / SET NULL) and the
// cascade_blog_trip / cascade_trip_location triggers. Supabase mode doesn't
// call any of this. Each function returns the tables it changed, so the
// caller can notifyDataChanged() them.

/** localStorage keys, one per Supabase table. */
export const MOCK_KEYS = {
  blogs: "skywalker.blogs.v1",
  photos: "skywalker.photos.v1",
  pins: "skywalker.pins.v1",
  trips: "skywalker.trips.v1",
  comments: "skywalker.sectionComments.v1",
  reactions: "skywalker.sectionReactions.v1",
};

/** Patches every item that matches; true if any did. */
function patchWhere(key, match, patch) {
  let changed = false;
  const next = readJSON(key, []).map((item) => {
    if (!match(item)) return item;
    changed = true;
    return { ...item, ...(typeof patch === "function" ? patch(item) : patch) };
  });
  if (changed) writeJSON(key, next);
  return changed;
}

/** Removes every item that matches; true if any did. */
function removeWhere(key, match) {
  const items = readJSON(key, []);
  const next = items.filter((item) => !match(item));
  if (next.length === items.length) return false;
  writeJSON(key, next);
  return true;
}

const tablesFrom = (changes) => Object.keys(changes).filter((table) => changes[table]);

/**
 * A post was deleted: its section comments and reactions go with it
 * (ON DELETE CASCADE), and photos attached to it stay, unattached
 * (gallery_items.blog_id ON DELETE SET NULL; their trip and location stay).
 * @returns {string[]} changed tables
 */
export function cascadeBlogDelete(blogId) {
  const forBlog = (item) => item.blogId === blogId;
  return tablesFrom({
    gallery_items: patchWhere(MOCK_KEYS.photos, forBlog, { blogId: null }),
    section_comments: removeWhere(MOCK_KEYS.comments, forBlog),
    section_reactions: removeWhere(MOCK_KEYS.reactions, forBlog),
  });
}

/**
 * A post moved to another trip (or out of one): photos attached to it follow
 * (cascade_blog_trip), and sync_gallery_item_hierarchy then places them at
 * the new trip's location, or at the post's own location when there's no trip.
 * @returns {string[]} changed tables
 */
export function cascadeBlogTrip(prev, next) {
  const tripId = next.tripId ?? null;
  if ((prev.tripId ?? null) === tripId) return [];
  const trip = tripId ? readJSON(MOCK_KEYS.trips, []).find((t) => t.id === tripId) : null;
  const pinId = trip?.locationId ?? next.pinId ?? null;
  return tablesFrom({
    gallery_items: patchWhere(MOCK_KEYS.photos, (p) => p.blogId === next.id, { tripId, pinId }),
  });
}

/**
 * A trip moved to another location: its posts and photos move with it
 * (cascade_trip_location).
 * @returns {string[]} changed tables
 */
export function cascadeTripLocation(tripId, locationId) {
  const inTrip = (item) => item.tripId === tripId;
  return tablesFrom({
    blogs: patchWhere(MOCK_KEYS.blogs, inTrip, { pinId: locationId }),
    gallery_items: patchWhere(MOCK_KEYS.photos, inTrip, { pinId: locationId }),
  });
}

/**
 * A trip was deleted: its posts and photos stay, unfiled from it
 * (blogs.trip_id / gallery_items.trip_id ON DELETE SET NULL; their location stays).
 * @returns {string[]} changed tables
 */
export function cascadeTripDelete(tripId) {
  const inTrip = (item) => item.tripId === tripId;
  return tablesFrom({
    blogs: patchWhere(MOCK_KEYS.blogs, inTrip, { tripId: null }),
    gallery_items: patchWhere(MOCK_KEYS.photos, inTrip, { tripId: null }),
  });
}

/**
 * A location was deleted: its trips go with it (trips.location_id ON DELETE
 * CASCADE, which unfiles their posts and photos), and posts and photos filed
 * there lose their location (location_id ON DELETE SET NULL).
 * @returns {string[]} changed tables
 */
export function cascadePinDelete(pinId) {
  const trips = readJSON(MOCK_KEYS.trips, []);
  const doomed = new Set(trips.filter((t) => t.locationId === pinId).map((t) => t.id));
  const atPin = (item) => item.pinId === pinId || doomed.has(item.tripId);
  const unfile = (item) => ({
    ...(item.pinId === pinId && { pinId: null }),
    ...(doomed.has(item.tripId) && { tripId: null }),
  });
  return tablesFrom({
    trips: removeWhere(MOCK_KEYS.trips, (t) => doomed.has(t.id)),
    blogs: patchWhere(MOCK_KEYS.blogs, atPin, unfile),
    gallery_items: patchWhere(MOCK_KEYS.photos, atPin, unfile),
  });
}
