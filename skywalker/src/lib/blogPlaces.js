import { CITY_STATES, cityOf } from "./blogTaxonomy";
import { stopForPost, sortStops, stopHasCoords } from "./hierarchy";
import { continentForCountryCode, countryContainingPoint, distanceKm, hasCoords } from "./geo";
import { COUNTRY_TO_CONTINENT, countryCodeToFlagEmoji } from "./countries";
import { readMediaMeta } from "./mediaMeta";

// Every place a post belongs to, as Continent -> Country -> City/Region, and
// the cascading feed filter built on top. A post can sit in several places at
// once: its own country/city, the trip stop(s) it was written at, and wherever
// the photos and clips on its canvas were taken (their EXIF / hand-set GPS).
// A filter matches when any ONE of those places satisfies every chosen tier,
// so "China › Chengdu" never matches a post that's only in China and Tokyo.

/**
 * @typedef {{ continent: string, countryCode: string, country: string, city: string }} BlogPlace
 * @typedef {BlogPlace & { lat: number, lng: number }} KnownPlace
 * @typedef {{ continent: string, country: string, cities: string[] }} PlaceFilter
 *   `country` is an ISO alpha-2 code; `cities` are cityKey()s within it. "" / [] = any.
 */

/** @type {PlaceFilter} */
export const EMPTY_PLACE_FILTER = { continent: "", country: "", cities: [] };

/** A photo counts as "in" a known city when it was taken within this many km of it. */
export const NEARBY_CITY_KM = 30;

/** Case-, accent- and spacing-insensitive key for a city name ("Xi’an " -> "xi'an"). */
export function cityKey(name) {
  return (name ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** A city name that adds something below its country (not blank, not the country again, not a city-state). */
function cleanCity(name, countryCode, country) {
  const city = (name ?? "").split(",")[0].trim();
  if (!city || CITY_STATES.has(countryCode)) return "";
  return cityKey(city) === cityKey(country) ? "" : city;
}

function makePlace({ continent, countryCode, country, city }, countryFeatures) {
  const code = countryCode || "";
  return {
    continent: continent || (code ? continentForCountryCode(code, countryFeatures, COUNTRY_TO_CONTINENT) : ""),
    countryCode: code,
    country: country || code,
    city: cleanCity(city, code, country),
  };
}

/** The post's own country + city. */
function primaryPlace(blog, countryFeatures) {
  if (!blog.countryCode && !blog.continent) return null;
  return makePlace(
    { continent: blog.continent, countryCode: blog.countryCode, country: blog.countryName, city: cityOf(blog) },
    countryFeatures
  );
}

const overlaps = (aStart, aEnd, bStart, bEnd) => Boolean(aStart && bStart) && aStart <= (bEnd || bStart) && (aEnd || aStart) >= bStart;

/**
 * The trip stops a post was written at: the one it names, else (a post filed
 * "anywhere on the trip") every stop its dates overlap — a recap of a
 * Chengdu -> Jiuzhaigou leg belongs to both.
 */
export function stopsForPost(blog, trip) {
  if (!trip) return [];
  const named = stopForPost(blog, trip);
  if (named) return [named];
  if (blog.stopId) return [];
  const start = blog.startDate ?? blog.postDate ?? blog.date ?? "";
  const end = blog.endDate || start;
  const stops = sortStops(trip.stops ?? []);
  if (stops.length === 1) return stops;
  return stops.filter((s) => overlaps(start, end, s.startDate, s.endDate));
}

/** GPS points of the photos/clips on a post's scrapbook canvas. */
export function mediaPoints(blog) {
  const points = [];
  for (const element of blog.canvas?.elements ?? []) {
    const meta = readMediaMeta(element);
    if (hasCoords(meta)) points.push({ lat: meta.lat, lng: meta.lng });
  }
  return points;
}

/**
 * Places with real coordinates to match photo GPS against: published posts
 * filed under a pin (so their coordinates are a real spot, not a country
 * centroid) and placed trip stops. Only ones that name a city are useful.
 * @returns {KnownPlace[]}
 */
export function buildGazetteer(blogs, trips = [], countryFeatures = []) {
  const known = [];
  for (const blog of blogs) {
    if (!blog.pinId || !hasCoords(blog.location)) continue;
    const place = primaryPlace(blog, countryFeatures);
    if (place?.city) known.push({ ...place, lat: blog.location.lat, lng: blog.location.lng });
  }
  for (const trip of trips) {
    for (const stop of trip.stops ?? []) {
      if (!stopHasCoords(stop)) continue;
      const place = makePlace({ continent: stop.continent, countryCode: stop.countryCode, country: stop.country, city: stop.locationName }, countryFeatures);
      if (place.city) known.push({ ...place, lat: stop.lat, lng: stop.lng });
    }
  }
  return known;
}

/** Where a photo was taken: the nearest known city within NEARBY_CITY_KM, else just the country containing it. */
function placeForPoint(point, gazetteer, countryFeatures) {
  let nearest = null;
  let nearestKm = NEARBY_CITY_KM;
  for (const known of gazetteer) {
    const km = distanceKm(point, known);
    if (km <= nearestKm) {
      nearest = known;
      nearestKm = km;
    }
  }
  if (nearest) return { continent: nearest.continent, countryCode: nearest.countryCode, country: nearest.country, city: nearest.city };
  if (countryFeatures.length === 0) return null;
  const country = countryContainingPoint(point.lat, point.lng, countryFeatures);
  if (!country?.code) return null;
  return makePlace({ continent: country.continent, countryCode: country.code, country: country.name, city: "" }, countryFeatures);
}

/**
 * Every place a post belongs to, unique by country + city. A country-level
 * entry is dropped when the same country also appears with a city.
 * @param {object} blog
 * @param {{ trip?: object, gazetteer?: KnownPlace[], countryFeatures?: object[] }} [context]
 * @returns {BlogPlace[]}
 */
export function blogPlaces(blog, { trip = null, gazetteer = [], countryFeatures = [] } = {}) {
  const candidates = [primaryPlace(blog, countryFeatures)];
  for (const stop of stopsForPost(blog, trip)) {
    candidates.push(makePlace({ continent: stop.continent, countryCode: stop.countryCode, country: stop.country, city: stop.locationName }, countryFeatures));
  }
  for (const point of mediaPoints(blog)) candidates.push(placeForPoint(point, gazetteer, countryFeatures));

  const byKey = new Map();
  for (const place of candidates) {
    if (!place || (!place.countryCode && !place.continent)) continue;
    const key = `${place.countryCode || place.continent}|${cityKey(place.city)}`;
    if (!byKey.has(key)) byKey.set(key, place);
  }
  const places = [...byKey.values()];
  return places.filter((p) => p.city || !places.some((o) => o.city && o.countryCode === p.countryCode && o.continent === p.continent));
}

/**
 * Does one of the post's places satisfy every chosen tier?
 * @param {BlogPlace[]} places
 * @param {PlaceFilter} f
 */
export function matchesPlaceFilter(places, f) {
  if (!f.continent && !f.country && f.cities.length === 0) return true;
  return places.some(
    (p) =>
      (!f.continent || p.continent === f.continent) &&
      (!f.country || p.countryCode === f.country) &&
      (f.cities.length === 0 || f.cities.includes(cityKey(p.city)))
  );
}

const byName = (a, b) => a.name.localeCompare(b.name);

/**
 * Filter options from the posts themselves, so only destinations that have a
 * story are offered. Counts are posts (a post in two Chinese cities counts once
 * for China and once for each city).
 * @param {{ places: BlogPlace[] }[]} entries
 */
export function placeFilterOptions(entries) {
  const continents = new Map();
  const countries = new Map();
  const cities = new Map();
  const bump = (map, key, make, seen) => {
    if (seen.has(key)) return;
    seen.add(key);
    if (!map.has(key)) map.set(key, { ...make(), count: 0 });
    map.get(key).count += 1;
  };
  for (const { places } of entries) {
    const seen = new Set();
    for (const p of places) {
      if (p.continent) bump(continents, `c:${p.continent}`, () => ({ name: p.continent }), seen);
      if (p.countryCode) {
        bump(countries, `n:${p.countryCode}`, () => ({ code: p.countryCode, name: p.country, continent: p.continent }), seen);
        if (p.city) {
          const key = cityKey(p.city);
          bump(cities, `t:${p.countryCode}|${key}`, () => ({ key, name: p.city, countryCode: p.countryCode }), seen);
        }
      }
    }
  }
  return {
    continents: [...continents.values()].sort(byName),
    countries: [...countries.values()].sort(byName),
    cities: [...cities.values()].sort(byName),
  };
}

/**
 * The filter with anything no longer on offer dropped (a post was deleted or
 * edited), so a stale pick can't silently zero out the feed.
 * @param {PlaceFilter} f
 * @param {ReturnType<typeof placeFilterOptions>} options
 * @returns {PlaceFilter}
 */
export function resolvePlaceFilter(f, options) {
  const continent = options.continents.some((c) => c.name === f.continent) ? f.continent : "";
  const country = options.countries.find((c) => c.code === f.country && (!continent || c.continent === continent))?.code ?? "";
  const cities = country ? f.cities.filter((key) => options.cities.some((c) => c.countryCode === country && c.key === key)) : [];
  if (continent === f.continent && country === f.country && cities.length === f.cities.length) return f;
  return { continent, country, cities };
}

/** Picking a continent ("" = all) starts the lower tiers over. */
export const selectContinent = (continent) => ({ continent, country: "", cities: [] });

/** Picking a country ("" = any in the continent) also selects its continent and clears the cities. */
export function selectCountry(f, code, options) {
  if (!code) return { ...f, country: "", cities: [] };
  const continent = options.countries.find((c) => c.code === code)?.continent || f.continent;
  return { continent, country: code, cities: [] };
}

/** Adds or removes one city of the chosen country. */
export function toggleCity(f, key) {
  return { ...f, cities: f.cities.includes(key) ? f.cities.filter((k) => k !== key) : [...f.cities, key] };
}

export const hasPlaceFilter = (f) => Boolean(f.continent || f.country || f.cities.length > 0);

/** Breadcrumb parts for the active filter: ["Asia", "🇨🇳 China", "Chengdu, Xi'an"]. */
export function placeFilterCrumbs(f, options) {
  const country = options.countries.find((c) => c.code === f.country);
  const cityNames = f.cities.map((key) => options.cities.find((c) => c.countryCode === f.country && c.key === key)?.name ?? key);
  return [
    f.continent,
    country && `${countryCodeToFlagEmoji(country.code)} ${country.name}`,
    cityNames.join(", "),
  ].filter(Boolean);
}
