import { mockPhotos } from "../data/mockData";
import { delay, readJSON, writeJSON } from "./storage";
import { supabase, unwrap, fromRows } from "./supabase";

// Photos API: Supabase `photos` table when configured, otherwise a localStorage
// mock mirroring blogStore.js/pinStore.js's pattern. Every function returns a
// Promise so callers (Gallery) don't care which backend is active.

const PHOTOS_KEY = "skywalker.photos.v1";

function ensureSeeded() {
  if (localStorage.getItem(PHOTOS_KEY) == null) {
    writeJSON(PHOTOS_KEY, mockPhotos);
  }
}

export async function getPhotos() {
  if (supabase) {
    return fromRows(unwrap(await supabase.from("photos").select("data").order("created_at")));
  }
  ensureSeeded();
  return delay(readJSON(PHOTOS_KEY, []));
}

export async function createPhoto({
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
  const photo = {
    id: `photo_${Date.now().toString(36)}`,
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
  };
  if (supabase) {
    unwrap(await supabase.from("photos").insert({ id: photo.id, data: photo }));
    return photo;
  }
  ensureSeeded();
  const photos = readJSON(PHOTOS_KEY, []);
  photos.push(photo);
  writeJSON(PHOTOS_KEY, photos);
  return delay(photo);
}
