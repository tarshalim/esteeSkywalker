import { makeId } from "./storage";
import { createCollection } from "./collection";
import { notifyDataChanged } from "./liveSync";

// Gallery API (photos and videos): Supabase `gallery_items` table when
// configured, otherwise a localStorage mock. Every function returns a Promise
// so callers (Gallery, GlobeExplorer) don't care which backend is active.
//
// An item can sit standalone in a trip's gallery (`tripId`), be attached to
// one of the trip's posts (`blogId` — the trip follows from the post), or be
// unfiled. On Supabase a trigger derives `pinId` (the location) from the trip.

/** @typedef {import("../types/hierarchy").GalleryItem} GalleryItem */

const photos = createCollection({
  table: "gallery_items",
  storageKey: "skywalker.photos.v1",
  toRow: (item) => ({ trip_id: item.tripId ?? null, blog_id: item.blogId ?? null }),
});

export const getPhotos = photos.list;

/**
 * @param {Partial<GalleryItem> & { url: string, timestamp: string }} input
 *   `pinId` is the trip's location; pass it so the local mock places the item
 *   like the database trigger would.
 * @returns {Promise<GalleryItem>}
 */
export async function createPhoto({
  type = "image",
  url,
  thumbUrl,
  lat = null,
  lng = null,
  countryCode = "",
  countryName = "",
  continent = "",
  locationName = "",
  timestamp,
  timeTaken = null,
  camera = null,
  locationSource = "manual",
  tripId = null,
  blogId = null,
  pinId = null,
  caption = "",
  tags = [],
}) {
  const created = await photos.insert({
    id: makeId("photo"),
    type,
    url,
    thumbUrl: thumbUrl || url,
    lat,
    lng,
    countryCode,
    countryName,
    continent,
    locationName,
    timestamp,
    year: new Date(timestamp).getFullYear(),
    timeTaken,
    camera,
    locationSource,
    tripId,
    blogId,
    pinId,
    caption,
    tags,
  });
  notifyDataChanged("gallery_items");
  return created;
}
