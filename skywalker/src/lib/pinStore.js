import { makeId } from "./storage";
import { createCollection } from "./collection";
import { notifyDataChanged } from "./liveSync";
import { angularDistanceDeg, hasCoords } from "../utils/geo";

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
  storageKey: "skywalker.pins.v1",
  toRow: (pin) => ({
    name: pin.placeName || pin.title,
    lat: pin.lat,
    lng: pin.lng,
    country_code: pin.countryCode || null,
    city: pin.city || null,
  }),
});

/** Posts within this distance of a pin are offered that pin rather than a new one. */
export const PIN_MERGE_RADIUS_KM = 25;
const KM_PER_DEG = 111.195;

export const getPins = pins.list;
export const getPinById = pins.get;

export async function deletePin(id) {
  await pins.remove(id);
  notifyDataChanged("locations");
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

export const distanceKm = (a, b) => angularDistanceDeg(a.lat, a.lng, b.lat, b.lng) * KM_PER_DEG;

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

/**
 * The real pin behind a story pin, creating it (and filing the post under
 * it) when it's a virtual stand-in for an unpinned post.
 * @param {StoryPin} storyPin
 * @param {function(string[], Pin): Promise} linkPosts - blogStore.setBlogsPin
 * @returns {Promise<Pin>}
 */
export async function materializePin(storyPin, linkPosts) {
  if (!storyPin.virtual) return storyPin;
  const { lat, lng, title, placeName } = storyPin;
  const pin = await createPin({ lat, lng, title, placeName });
  await linkPosts([storyPin.blogId], pin);
  return pin;
}
