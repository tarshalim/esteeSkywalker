import { makeId } from "./storage";
import { createCollection } from "./collection";
import { notifyDataChanged } from "./liveSync";
import { distanceKm, hasCoords } from "./geo";
import { supabase } from "./supabase";
import { MOCK_KEYS, cascadePinDelete } from "./mockCascades";

// Locations API: Supabase `locations` table when configured, otherwise a
// localStorage mock. Every function returns a Promise so callers
// (GlobeExplorer) don't care which backend is active.
//
// A location is the top of the hierarchy Location -> Trip -> (posts, gallery
// items); on the globe it's drawn as a pin, hence "pin" throughout the UI code.
// Posts point at it through `pinId` (the `blogs.location_id` column), trips
// through `locationId`. A location with nothing under it is a plain annotation.

/**
 * @typedef {import("../types/hierarchy").Location} Pin
 * @typedef {import("../types/hierarchy").BlogPost & { weather?: ?import("./weather").Weather }} BlogPost
 *
 * What the globe renders: a location with its trips, posts and photos joined
 * on. `virtual` pins stand in for posts that predate locations (no `pinId`)
 * so they stay clickable.
 * @typedef {import("../types/hierarchy").LocationNode} StoryPin
 */

const pins = createCollection({
  table: "locations",
  storageKey: MOCK_KEYS.pins,
  toRow: (pin) => ({
    name: pin.placeName || pin.title,
    lat: pin.lat,
    lng: pin.lng,
    country_code: pin.countryCode || null,
    city: pin.city || null,
  }),
});

/** Posts within this distance of a pin are offered that pin rather than a new one. */
const PIN_MERGE_RADIUS_KM = 25;

export const getPins = pins.list;
export const getPinById = pins.get;

export async function deletePin(id) {
  await pins.remove(id);
  notifyDataChanged("locations");
  // Supabase: FK actions delete its trips and unfile its posts and photos.
  if (!supabase) cascadePinDelete(id).forEach(notifyDataChanged);
  return true;
}

/** @returns {Promise<Pin>} */
export async function createPin({ lat, lng, title, note = "", placeName = null, countryCode = "", countryName = "", city = "" }) {
  const pin = await pins.insert({
    id: makeId("pin"),
    lat,
    lng,
    title,
    note,
    placeName,
    countryCode,
    countryName,
    city,
    createdAt: new Date().toISOString(),
  });
  notifyDataChanged("locations");
  return pin;
}

/**
 * Pins within `radiusKm` of a point, nearest first, each with its `distanceKm`.
 * @template {Pin} P
 * @param {P[]} candidates
 * @returns {(P & { distanceKm: number })[]}
 */
export function pinsNear(candidates, point, radiusKm = PIN_MERGE_RADIUS_KM) {
  if (!hasCoords(point)) return [];
  return candidates
    .filter((pin) => !pin.virtual && hasCoords(pin))
    .map((pin) => ({ ...pin, distanceKm: distanceKm(pin, point) }))
    .filter((pin) => pin.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/** Where "auto" files a post at `point`: the nearest pin in range, else "new". */
export function autoPinFor(candidates, point) {
  return pinsNear(candidates, point)[0]?.id ?? "new";
}

/**
 * Whether a location's own pin is redundant on the globe: one of its trips
 * has a placed stop on (within PIN_MERGE_RADIUS_KM of) that spot, so the stop
 * pin stands for it and opens the same card.
 * @param {StoryPin} storyPin
 */
export function isShownByStop(storyPin) {
  if (storyPin.virtual || !hasCoords(storyPin)) return false;
  return storyPin.trips.some((trip) =>
    (trip.stops ?? []).some((stop) => hasCoords(stop) && distanceKm(stop, storyPin) <= PIN_MERGE_RADIUS_KM)
  );
}

const byNewestTrip = (a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? "");

/**
 * Joins trips, posts and gallery items onto their locations. Posts without a
 * (known) location but with coordinates become single-post virtual pins.
 * A post or photo in a trip is placed by its trip, whatever its own pinId says.
 * @param {Pin[]} pinList
 * @param {BlogPost[]} blogs - already filtered to what the viewer may see
 * @param {function(BlogPost): boolean} [showLoose] - which unpinned posts get a virtual pin
 * @param {{ trips?: import("../types/hierarchy").Trip[], photos?: import("../types/hierarchy").GalleryItem[] }} [extra]
 * @returns {StoryPin[]}
 */
export function buildStoryPins(pinList, blogs, showLoose = () => true, { trips = [], photos = [] } = {}) {
  const nodes = new Map(pinList.map((pin) => [pin.id, { posts: [], photos: [], trips: [] }]));
  const tripNodes = new Map();
  for (const trip of trips) {
    const node = nodes.get(trip.locationId);
    if (!node) continue;
    const tripNode = { ...trip, posts: [], photos: [] };
    tripNodes.set(trip.id, tripNode);
    node.trips.push(tripNode);
  }
  const locationOf = (item) => (item.tripId && tripNodes.get(item.tripId)?.locationId) || item.pinId;

  const loose = [];
  for (const blog of blogs) {
    const node = nodes.get(locationOf(blog));
    if (node) {
      node.posts.push(blog);
      tripNodes.get(blog.tripId)?.posts.push(blog);
    } else if (hasCoords(blog.location) && showLoose(blog)) loose.push(blog);
  }
  for (const photo of photos) {
    const node = nodes.get(locationOf(photo));
    if (!node) continue;
    node.photos.push(photo);
    tripNodes.get(photo.tripId)?.photos.push(photo);
  }

  return [
    ...pinList.map((pin) => {
      const node = nodes.get(pin.id);
      return {
        ...pin,
        posts: node.posts.sort(byNewestTrip),
        photos: node.photos,
        trips: node.trips.sort(byNewestTrip).map((t) => ({ ...t, posts: t.posts.sort(byNewestTrip) })),
      };
    }),
    ...loose.map((blog) => ({
      id: `blog:${blog.id}`,
      blogId: blog.id,
      lat: blog.location.lat,
      lng: blog.location.lng,
      title: blog.location.name,
      placeName: blog.location.name,
      note: "",
      createdAt: blog.createdAt,
      posts: [blog],
      photos: [],
      trips: [],
      virtual: true,
    })),
  ];
}

// blogId -> the pin materializePin created for that post. The virtual pin stays
// on screen until the reload after linking lands, so a second click, or a
// retry after the link failed, must reuse that pin rather than make another.
// Post ids are title slugs, freed when a post is deleted, so an entry can
// outlive its post and come back for a new one elsewhere: it's only reused
// while it's still where the post is.
const materialized = new Map();

/**
 * The real pin behind a story pin, creating it (and filing the post under
 * it) when it's a virtual stand-in for an unpinned post. Calls for the same
 * post share one pin, even when they overlap or the first one's link failed.
 * @param {StoryPin} storyPin
 * @param {function(string[], Pin): Promise} linkPosts - blogStore.setBlogsPin
 * @returns {Promise<Pin>}
 */
export async function materializePin(storyPin, linkPosts) {
  if (!storyPin.virtual) return storyPin;
  const { blogId, lat, lng, title, placeName } = storyPin;
  const previous = materialized.get(blogId);
  const next = (async () => {
    const earlier = previous ? await previous.catch(() => null) : null;
    // Still there, and still where the post is? (It may have been deleted since, which
    // is why the post is virtual again; or the post moved, or a deleted post's id was
    // reused by a new post somewhere else.)
    const current = earlier && (await getPinById(earlier.id));
    if (current && hasCoords(current) && distanceKm(current, { lat, lng }) <= PIN_MERGE_RADIUS_KM) return current;
    return createPin({ lat, lng, title, placeName });
  })();
  materialized.set(blogId, next);
  next.catch(() => {
    if (materialized.get(blogId) === next) materialized.delete(blogId);
  });
  const pin = await next;
  await linkPosts([blogId], pin);
  return pin;
}
