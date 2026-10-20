import { mockPhotos } from "../data/mockData";
import { makeId } from "./storage";
import { createCollection } from "./collection";

// Media uploads API (photos and videos): Supabase `photos` table when
// configured, otherwise a localStorage mock. Every function returns a Promise
// so callers (Gallery, GlobeExplorer) don't care which backend is active.

const photos = createCollection({ table: "photos", storageKey: "skywalker.photos.v1", seed: mockPhotos });

export const getPhotos = photos.list;

export function createPhoto({
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
  blogId = null,
}) {
  return photos.insert({
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
    blogId,
  });
}
