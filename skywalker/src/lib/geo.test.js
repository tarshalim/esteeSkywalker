import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  angularDistanceDeg,
  centroidForCountryCode,
  clusterPhotosByLocation,
  continentForCountryCode,
  countryContainingPoint,
  countryList,
  distanceKm,
  escapeHtml,
  featureCountryCode,
  findCountryForPoint,
  formatCoords,
  hasCoords,
  isPointInFeature,
  isWaterName,
  oceanForPoint,
  slerpLatLng,
} from "./geo";

const LONDON = { lat: 51.5074, lng: -0.1278 };
const PARIS = { lat: 48.8566, lng: 2.3522 };

// A 10°×10° square with a 2°×2° hole in the middle (an enclave, Lesotho-style).
const square = (x0, y0, size) => [
  [x0, y0],
  [x0 + size, y0],
  [x0 + size, y0 + size],
  [x0, y0 + size],
  [x0, y0],
];
const DONUT = {
  properties: { ISO_A2: "-99", WB_A2: "FR", NAME: "Donutland", CONTINENT: "Europe" },
  geometry: { type: "Polygon", coordinates: [square(0, 0, 10), square(4, 4, 2)] },
};
const ISLAND = {
  properties: { ISO_A2: "IS", NAME: "Island", CONTINENT: "Oceania" },
  geometry: { type: "MultiPolygon", coordinates: [[square(50, 50, 1)]] },
};

describe("hasCoords", () => {
  it("accepts 0 as a real coordinate", () => {
    expect(hasCoords({ lat: 0, lng: 0 })).toBe(true);
  });

  it("rejects missing, null and non-finite coords", () => {
    expect(hasCoords(null)).toBe(false);
    expect(hasCoords({ lat: null, lng: 3 })).toBe(false);
    expect(hasCoords({ lat: NaN, lng: 3 })).toBe(false);
  });
});

describe("distances", () => {
  it("measures London → Paris at ~344 km", () => {
    expect(distanceKm(LONDON, PARIS)).toBeGreaterThan(340);
    expect(distanceKm(LONDON, PARIS)).toBeLessThan(347);
  });

  it("is symmetric and zero for the same point", () => {
    expect(distanceKm(LONDON, PARIS)).toBeCloseTo(distanceKm(PARIS, LONDON), 9);
    expect(distanceKm(LONDON, LONDON)).toBe(0);
  });

  it("takes the short way across the antimeridian", () => {
    expect(angularDistanceDeg(0, 179, 0, -179)).toBeCloseTo(2, 9);
  });
});

describe("slerpLatLng", () => {
  it("returns the endpoints at t = 0 and t = 1", () => {
    const start = slerpLatLng(LONDON, PARIS, 0);
    const end = slerpLatLng(LONDON, PARIS, 1);
    expect(start.lat).toBeCloseTo(LONDON.lat, 9);
    expect(start.lng).toBeCloseTo(LONDON.lng, 9);
    expect(end.lat).toBeCloseTo(PARIS.lat, 9);
    expect(end.lng).toBeCloseTo(PARIS.lng, 9);
  });

  it("crosses the antimeridian instead of going the long way round", () => {
    const mid = slerpLatLng({ lat: 0, lng: 170 }, { lat: 0, lng: -170 }, 0.5);
    expect(Math.abs(mid.lng)).toBeCloseTo(180, 6);
  });

  it("falls back to a lerp for identical points", () => {
    expect(slerpLatLng(PARIS, PARIS, 0.5)).toEqual(PARIS);
  });
});

describe("point-in-polygon", () => {
  it("excludes points inside a hole", () => {
    expect(isPointInFeature(2, 2, DONUT)).toBe(true);
    expect(isPointInFeature(5, 5, DONUT)).toBe(false);
    expect(isPointInFeature(20, 20, DONUT)).toBe(false);
  });

  it("handles MultiPolygon features and missing geometry", () => {
    expect(isPointInFeature(50.5, 50.5, ISLAND)).toBe(true);
    expect(isPointInFeature(0, 0, { geometry: null })).toBe(false);
  });
});

describe("country lookup", () => {
  it("falls back to WB_A2 when ISO_A2 is the -99 placeholder", () => {
    expect(countryContainingPoint(2, 2, [DONUT, ISLAND])).toEqual({
      code: "FR",
      name: "Donutland",
      continent: "Europe",
    });
  });

  it("strict lookup returns null offshore; loose lookup picks the nearest centroid", () => {
    expect(countryContainingPoint(48, 48, [DONUT, ISLAND])).toBeNull();
    expect(findCountryForPoint(48, 48, [DONUT, ISLAND])?.code).toBe("IS");
  });
});

const NORWAY = {
  properties: { ISO_A2: "-99", WB_A2: "-99", NAME: "Norway", CONTINENT: "Europe" },
  geometry: { type: "Polygon", coordinates: [square(60, 8, 4)] },
};
const NO_CODE = {
  properties: { ISO_A2: "-99", WB_A2: "-99", NAME: "Nocodeland", CONTINENT: "Asia" },
  geometry: { type: "Polygon", coordinates: [square(30, 30, 2)] },
};

describe("country codes", () => {
  it("falls back ISO_A2 -> WB_A2 -> known name, else null", () => {
    expect(featureCountryCode(ISLAND)).toBe("IS");
    expect(featureCountryCode(DONUT)).toBe("FR");
    expect(featureCountryCode(NORWAY)).toBe("NO");
    expect(featureCountryCode(NO_CODE)).toBeNull();
  });

  it("countryList keeps every coded country once, A-Z, and drops codeless ones", () => {
    const list = countryList([NORWAY, NO_CODE, ISLAND, DONUT, ISLAND]);
    expect(list.map((c) => c.code)).toEqual(["FR", "IS", "NO"]);
  });

  it("code lookups use the same fallback", () => {
    expect(centroidForCountryCode("NO", [NORWAY])).not.toBeNull();
    expect(continentForCountryCode("NO", [NORWAY])).toBe("Europe");
    expect(centroidForCountryCode("", [NO_CODE])).toBeNull();
  });

  it("nearest-centroid lookup never returns a codeless feature", () => {
    expect(findCountryForPoint(31, 33, [NO_CODE, ISLAND])?.code).toBe("IS");
    expect(countryContainingPoint(31, 31, [NO_CODE])?.code).toBeNull();
  });

  it("the shipped geojson lists France and Norway, with no placeholder codes", () => {
    const { features } = JSON.parse(readFileSync(new URL("../../public/data/countries.geojson", import.meta.url), "utf8"));
    const codes = countryList(features).map((c) => c.code);
    expect(codes).toEqual(expect.arrayContaining(["FR", "NO"]));
    expect(codes.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("labels", () => {
  it("formats coords with hemisphere letters", () => {
    expect(formatCoords(35.0116, 135.7681)).toBe("35.01°N, 135.77°E");
    expect(formatCoords(-33.8688, -70.6693)).toBe("33.87°S, 70.67°W");
  });

  it("names ocean basins for offshore points", () => {
    expect(oceanForPoint(80, 0)).toBe("Arctic Ocean");
    expect(oceanForPoint(-70, 0)).toBe("Southern Ocean");
    expect(oceanForPoint(-20, 80)).toBe("Indian Ocean");
    expect(oceanForPoint(30, -40)).toBe("North Atlantic Ocean");
    expect(oceanForPoint(-10, -120)).toBe("South Pacific Ocean");
  });

  it("detects water names", () => {
    expect(isWaterName("North Atlantic Ocean")).toBe(true);
    expect(isWaterName("Coral Sea")).toBe(true);
    expect(isWaterName("Seattle")).toBe(false);
    expect(isWaterName(undefined)).toBe(false);
  });

  it("escapes HTML for globe tooltips", () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe("&#60;b&#62;&#34;Tom&#34; &#38; &#39;Jerry&#39;&#60;/b&#62;");
    expect(escapeHtml(null)).toBe("");
  });
});

describe("clusterPhotosByLocation", () => {
  it("groups nearby photos and drops photos without GPS", () => {
    const photos = [
      { id: 1, lat: 35.01, lng: 135.77 },
      { id: 2, lat: 35.011, lng: 135.771 },
      { id: 3, lat: 48.85, lng: 2.35 },
      { id: 4, lat: null, lng: null },
    ];
    const clusters = clusterPhotosByLocation(photos);
    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.photos.map((p) => p.id))).toEqual([[1, 2], [3]]);
  });
});
