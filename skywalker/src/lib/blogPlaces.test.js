import { describe, expect, it } from "vitest";
import {
  EMPTY_PLACE_FILTER,
  blogPlaces,
  buildGazetteer,
  cityKey,
  matchesPlaceFilter,
  placeFilterCrumbs,
  placeFilterOptions,
  resolvePlaceFilter,
  selectContinent,
  selectCountry,
  stopsForPost,
  toggleCity,
} from "./blogPlaces";
import { createImageElement } from "./canvasElements";

const china = { continent: "Asia", countryCode: "CN", countryName: "China" };
const blog = (over = {}) => ({ id: "b", status: "published", startDate: "2026-05-02", location: { name: "" }, ...china, ...over });

const stop = (id, locationName, startDate, endDate, over = {}) => ({
  id,
  locationName,
  country: "China",
  countryCode: "CN",
  continent: "Asia",
  lat: null,
  lng: null,
  startDate,
  endDate,
  sequenceOrder: 0,
  ...over,
});

const sichuanTrip = {
  id: "t1",
  stops: [
    stop("s1", "Chengdu", "2026-05-01", "2026-05-03", { lat: 30.66, lng: 104.06 }),
    stop("s2", "Jiuzhaigou", "2026-05-03", "2026-05-06", { lat: 33.26, lng: 103.92 }),
    stop("s3", "Xi'an", "2026-05-07", "2026-05-09", { lat: 34.34, lng: 108.94 }),
  ],
};

const photoAt = (lat, lng) =>
  createImageElement({ src: `https://cdn/${lat}.jpg`, mediaMeta: { src: `https://cdn/${lat}.jpg`, lat, lng } });

describe("cityKey", () => {
  it("ignores case, accents, curly quotes and spacing", () => {
    expect(cityKey("  Xi’an ")).toBe("xi'an");
    expect(cityKey("São  Paulo")).toBe("sao paulo");
  });
});

describe("stopsForPost", () => {
  it("uses the stop a post names", () => {
    expect(stopsForPost(blog({ stopId: "s3" }), sichuanTrip).map((s) => s.id)).toEqual(["s3"]);
  });

  it("spreads an un-stopped post over every stop its dates overlap", () => {
    const recap = blog({ startDate: "2026-05-02", endDate: "2026-05-04" });
    expect(stopsForPost(recap, sichuanTrip).map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("finds nothing without a trip or for a stale stop id", () => {
    expect(stopsForPost(blog(), null)).toEqual([]);
    expect(stopsForPost(blog({ stopId: "gone" }), sichuanTrip)).toEqual([]);
  });
});

describe("blogPlaces", () => {
  it("collects the post's own city, its trip stops, and where its photos were taken", () => {
    const post = blog({
      city: "Chengdu",
      startDate: "2026-05-02",
      endDate: "2026-05-04",
      canvas: { elements: [photoAt(34.3, 108.9)] }, // ~6 km from Xi'an
    });
    const gazetteer = buildGazetteer([], [sichuanTrip]);
    const places = blogPlaces(post, { trip: sichuanTrip, gazetteer });
    expect(places.map((p) => p.city)).toEqual(["Chengdu", "Jiuzhaigou", "Xi'an"]);
    expect(places.every((p) => p.countryCode === "CN" && p.continent === "Asia")).toBe(true);
  });

  it("ignores photo GPS far from any known city when country outlines aren't loaded", () => {
    const post = blog({ city: "Chengdu", canvas: { elements: [photoAt(-33.86, 151.2)] } });
    expect(blogPlaces(post, { gazetteer: buildGazetteer([], [sichuanTrip]) }).map((p) => p.city)).toEqual(["Chengdu"]);
  });

  it("ignores stale media metadata describing a replaced photo", () => {
    const el = { ...photoAt(34.3, 108.9), src: "https://cdn/new.jpg" };
    expect(blogPlaces(blog({ canvas: { elements: [el] } }), { gazetteer: buildGazetteer([], [sichuanTrip]) })).toEqual([
      { continent: "Asia", countryCode: "CN", country: "China", city: "" },
    ]);
  });

  it("keeps a bare country only when none of its cities are known", () => {
    const post = blog({ city: "", location: { name: "China" }, stopId: "s1" });
    expect(blogPlaces(post, { trip: sichuanTrip })).toEqual([{ continent: "Asia", countryCode: "CN", country: "China", city: "Chengdu" }]);
  });

  it("never gives a city-state a city, nor repeats the country as one", () => {
    expect(blogPlaces({ continent: "Asia", countryCode: "SG", countryName: "Singapore", city: "Marina Bay", location: { name: "" } })[0].city).toBe("");
    expect(blogPlaces(blog({ city: "china" }))[0].city).toBe("");
  });

  it("spans continents for a multi-country post", () => {
    const trip = { id: "t2", stops: [stop("x", "Tokyo", "2026-01-01", "2026-01-01", { country: "Japan", countryCode: "JP" })] };
    const places = blogPlaces(blog({ city: "Paris", continent: "Europe", countryCode: "FR", countryName: "France" }), { trip });
    expect(places.map((p) => `${p.continent}/${p.countryCode}/${p.city}`)).toEqual(["Europe/FR/Paris", "Asia/JP/Tokyo"]);
  });
});

describe("buildGazetteer", () => {
  it("only trusts post coordinates filed under a pin", () => {
    const pinned = blog({ pinId: "p", city: "Chengdu", location: { name: "Chengdu", lat: 30.6, lng: 104 } });
    const centroid = blog({ city: "Chengdu", location: { name: "Chengdu", lat: 35, lng: 103 } });
    expect(buildGazetteer([pinned, centroid])).toHaveLength(1);
  });
});

describe("matching and options", () => {
  const chengduXian = [
    { continent: "Asia", countryCode: "CN", country: "China", city: "Chengdu" },
    { continent: "Asia", countryCode: "CN", country: "China", city: "Xi'an" },
  ];
  const tokyoParis = [
    { continent: "Asia", countryCode: "JP", country: "Japan", city: "Tokyo" },
    { continent: "Europe", countryCode: "FR", country: "France", city: "Paris" },
  ];
  const entries = [{ places: chengduXian }, { places: tokyoParis }, { places: [{ continent: "Asia", countryCode: "CN", country: "China", city: "Chengdu" }] }];
  const options = placeFilterOptions(entries);

  it("matches a post under every place it belongs to", () => {
    expect(matchesPlaceFilter(chengduXian, { continent: "Asia", country: "CN", cities: ["xi'an"] })).toBe(true);
    expect(matchesPlaceFilter(tokyoParis, { continent: "Europe", country: "", cities: [] })).toBe(true);
    expect(matchesPlaceFilter(tokyoParis, { continent: "Asia", country: "JP", cities: [] })).toBe(true);
  });

  it("needs one place to satisfy every tier at once", () => {
    expect(matchesPlaceFilter(tokyoParis, { continent: "Europe", country: "JP", cities: [] })).toBe(false);
    expect(matchesPlaceFilter(chengduXian, { continent: "Asia", country: "CN", cities: ["jiuzhaigou"] })).toBe(false);
  });

  it("treats several cities as any-of", () => {
    expect(matchesPlaceFilter(chengduXian, { continent: "Asia", country: "CN", cities: ["jiuzhaigou", "chengdu"] })).toBe(true);
  });

  it("counts each post once per continent, country and city", () => {
    expect(options.continents).toEqual([
      { name: "Asia", count: 3 },
      { name: "Europe", count: 1 },
    ]);
    expect(options.countries.find((c) => c.code === "CN")).toEqual({ code: "CN", name: "China", continent: "Asia", count: 2 });
    expect(options.cities.filter((c) => c.countryCode === "CN").map((c) => [c.name, c.count])).toEqual([
      ["Chengdu", 2],
      ["Xi'an", 1],
    ]);
  });

  it("cascades: a country picks its continent; a continent or country resets what's below", () => {
    const picked = toggleCity(selectCountry(EMPTY_PLACE_FILTER, "CN", options), "chengdu");
    expect(picked).toEqual({ continent: "Asia", country: "CN", cities: ["chengdu"] });
    expect(toggleCity(picked, "chengdu").cities).toEqual([]);
    expect(selectCountry(picked, "", options)).toEqual({ continent: "Asia", country: "", cities: [] });
    expect(selectContinent("Europe")).toEqual({ continent: "Europe", country: "", cities: [] });
  });

  it("drops picks that are no longer offered", () => {
    const f = { continent: "Asia", country: "CN", cities: ["chengdu", "lhasa"] };
    expect(resolvePlaceFilter(f, options)).toEqual({ continent: "Asia", country: "CN", cities: ["chengdu"] });
    expect(resolvePlaceFilter({ continent: "Europe", country: "CN", cities: ["chengdu"] }, options)).toEqual({ continent: "Europe", country: "", cities: [] });
    const unchanged = { continent: "Asia", country: "", cities: [] };
    expect(resolvePlaceFilter(unchanged, options)).toBe(unchanged);
  });

  it("labels the active filter as breadcrumbs", () => {
    expect(placeFilterCrumbs({ continent: "Asia", country: "CN", cities: ["chengdu", "xi'an"] }, options)).toEqual([
      "Asia",
      "🇨🇳 China",
      "Chengdu, Xi'an",
    ]);
  });
});
