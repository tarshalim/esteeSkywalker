import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildGlobeSearchIndex, searchGlobeIndex } from "./useGlobeSearch";

const square = (lat, lng, size) => [
  [lng, lat],
  [lng + size, lat],
  [lng + size, lat + size],
  [lng, lat + size],
  [lng, lat],
];
const country = (props, lat, lng) => ({ properties: props, geometry: { type: "Polygon", coordinates: [square(lat, lng, 4)] } });

const FRANCE = country({ ISO_A2: "-99", WB_A2: "FR", NAME: "France" }, 44, 0);
const NORWAY = country({ ISO_A2: "-99", WB_A2: "-99", NAME: "Norway" }, 60, 8);
const N_CYPRUS = country({ ISO_A2: "-99", WB_A2: "-99", NAME: "N. Cyprus" }, 35, 33);
const FINLAND = country({ ISO_A2: "FI", NAME: "Finland" }, 62, 24);

const PIN = { id: "p1", locationName: "Paris", photos: [{}, {}], lat: 48.8, lng: 2.3 };
const CUSTOM = { id: "c1", title: "Fjord camp", placeName: "", note: "", lat: 61, lng: 7 };
const BLOG = { id: "b1", title: "Lapland in winter", location: { name: "Rovaniemi, Finland", lat: 66.5, lng: 25.7 } };
const TRIP = {
  id: "t1",
  title: "Nordic loop",
  startDate: "",
  endDate: "",
  companions: [],
  pin: { id: "c1", title: "Fjord camp", lat: 61, lng: 7 },
};

const build = (data = {}) => buildGlobeSearchIndex([FRANCE, NORWAY, N_CYPRUS, FINLAND], data);

describe("buildGlobeSearchIndex", () => {
  it("keys countries by featureCountryCode, so -99 features get their real code", () => {
    const countries = build().filter((r) => r.kind === "country");
    expect(countries.map((r) => [r.label, r.code, r.id])).toEqual([
      ["Finland", "FI", "FI"],
      ["France", "FR", "FR"],
      ["Norway", "NO", "NO"],
    ]);
    expect(countries.every((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))).toBe(true);
  });

  it("drops countries with no ISO code instead of sharing a -99 id", () => {
    expect(build().some((r) => r.label === "N. Cyprus")).toBe(false);
  });

  it("orders trips, posts, photo pins, your pins, then countries", () => {
    const kinds = build({ pins: [PIN], customPins: [CUSTOM], blogs: [BLOG], trips: [TRIP] }).map((r) => r.kind);
    expect([...new Set(kinds)]).toEqual(["trip", "blog", "pin", "customPin", "country"]);
  });

  it("builds each result's label, sublabel and target", () => {
    const index = build({ pins: [PIN], customPins: [CUSTOM], blogs: [BLOG], trips: [TRIP] });
    const byKind = Object.fromEntries(index.filter((r) => r.kind !== "country").map((r) => [r.kind, r]));
    expect(byKind.pin).toMatchObject({ label: "Paris", sublabel: "2 photos", id: "p1", lat: 48.8, lng: 2.3 });
    expect(byKind.customPin).toMatchObject({ label: "Fjord camp", sublabel: "Your pin", id: "c1" });
    expect(byKind.blog).toMatchObject({ label: "Lapland in winter", sublabel: "Rovaniemi, Finland", blogId: "b1", lat: 66.5 });
    expect(byKind.trip).toMatchObject({ label: "Nordic loop", sublabel: "Fjord camp", pinId: "c1", lat: 61, lng: 7 });
  });

  it("works before the geojson has loaded", () => {
    expect(buildGlobeSearchIndex([], { pins: [PIN] }).map((r) => r.kind)).toEqual(["pin"]);
  });
});

describe("searchGlobeIndex", () => {
  const index = build({ pins: [PIN], customPins: [CUSTOM], blogs: [BLOG], trips: [TRIP] });

  it("returns nothing for a blank query", () => {
    expect(searchGlobeIndex(index, "")).toEqual([]);
    expect(searchGlobeIndex(index, "   ")).toEqual([]);
  });

  it("matches label or sublabel, case-insensitively and trimmed", () => {
    expect(searchGlobeIndex(index, "  FRANCE ").map((r) => r.code)).toEqual(["FR"]);
    // "Finland" hits the post through its sublabel and the country through its label.
    expect(searchGlobeIndex(index, "finland").map((r) => r.kind)).toEqual(["blog", "country"]);
    expect(searchGlobeIndex(index, "fjord").map((r) => r.kind)).toEqual(["trip", "customPin"]);
  });

  it("caps the results at 8", () => {
    const many = buildGlobeSearchIndex([], { pins: Array.from({ length: 12 }, (_, i) => ({ ...PIN, id: `p${i}` })) });
    expect(searchGlobeIndex(many, "paris")).toHaveLength(8);
  });

  it("finds France and Norway in the shipped geojson with real, unique codes", () => {
    const { features } = JSON.parse(readFileSync(new URL("../../public/data/countries.geojson", import.meta.url), "utf8"));
    const index = buildGlobeSearchIndex(features, {});
    expect(searchGlobeIndex(index, "france").find((r) => r.kind === "country")?.code).toBe("FR");
    expect(searchGlobeIndex(index, "norway").find((r) => r.kind === "country")?.code).toBe("NO");
    const ids = index.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("-99");
  });
});
