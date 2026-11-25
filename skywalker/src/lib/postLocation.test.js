import { describe, expect, it } from "vitest";
import { UNNAMED_WAYPOINT, hasExactCoords, postLocationFields, postLocationPayload } from "./postLocation";

const kyoto = { lat: 35.01, lng: 135.77 };
const japanCentroid = { lat: 36.2, lng: 138.25 };

describe("postLocationPayload", () => {
  it("saves a picked spot as exact", () => {
    expect(postLocationPayload({ name: " Gion ", coords: kyoto, countryName: "Japan", centroid: japanCentroid })).toEqual({
      name: "Gion",
      ...kyoto,
      approx: false,
    });
  });

  it("falls back to the country centroid, marked approx", () => {
    expect(postLocationPayload({ name: "", coords: null, countryName: "Japan", centroid: japanCentroid })).toEqual({
      name: "Japan",
      ...japanCentroid,
      approx: true,
    });
  });

  it("writes null coords when there's no point at all, so a merge can't keep an old one", () => {
    expect(postLocationPayload({ name: "  ", coords: null })).toEqual({ name: UNNAMED_WAYPOINT, lat: null, lng: null, approx: false });
    // Country outlines not loaded yet: no centroid.
    expect(postLocationPayload({ name: "", coords: null, countryName: "Japan", centroid: null })).toMatchObject({
      lat: null,
      approx: false,
    });
  });

  it("treats lat/lng 0 as a real spot", () => {
    expect(postLocationPayload({ name: "Null Island", coords: { lat: 0, lng: 0 } })).toMatchObject({ lat: 0, lng: 0, approx: false });
  });
});

describe("postLocationFields", () => {
  it("round-trips every payload back to the fields that made it", () => {
    const cases = [
      { name: "Gion", coords: kyoto, countryName: "Japan", centroid: japanCentroid },
      { name: "", coords: null, countryName: "", centroid: null },
      { name: "Somewhere", coords: null, countryName: "Japan", centroid: japanCentroid },
      { name: "Null Island", coords: { lat: 0, lng: 0 } },
    ];
    for (const input of cases) {
      const fields = postLocationFields(postLocationPayload(input));
      expect(fields.coords).toEqual(input.coords);
      // Saving the read-back fields gives the same location again.
      expect(postLocationPayload({ ...input, ...fields })).toEqual(postLocationPayload(input));
    }
  });

  it("doesn't read the placeholder name back as typed text", () => {
    expect(postLocationFields({ name: UNNAMED_WAYPOINT }).name).toBe("");
  });

  it("keeps legacy locations with coords and no marker as exact", () => {
    expect(postLocationFields({ name: "Oslo", lat: 59.9, lng: 10.7 })).toEqual({ name: "Oslo", coords: { lat: 59.9, lng: 10.7 } });
    expect(postLocationFields(undefined)).toEqual({ name: "", coords: null });
  });

  it("hasExactCoords ignores centroid fallbacks", () => {
    expect(hasExactCoords({ ...kyoto })).toBe(true);
    expect(hasExactCoords({ ...japanCentroid, approx: true })).toBe(false);
    expect(hasExactCoords({ lat: null, lng: null })).toBe(false);
  });
});
