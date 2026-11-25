import { beforeEach, describe, expect, it, vi } from "vitest";
import { distanceKm } from "./geo";

// Mock mode, whatever .env says; the live-sync broadcast isn't under test.
vi.mock(import("./supabase"), async (importOriginal) => ({ ...(await importOriginal()), supabase: null }));
vi.mock(import("./liveSync"), () => ({ notifyDataChanged: () => {} }));

const { autoPinFor, deletePin, getPins, isShownByStop, materializePin, pinsNear } = await import("./pinStore");

// Vitest runs in node: a minimal in-memory localStorage.
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

// 1° of latitude ≈ 111.2 km, so 0.2° ≈ 22.2 km (inside the 25 km merge
// radius) and 0.25° ≈ 27.8 km (outside).
const here = { lat: 35, lng: 135 };
const pin = (id, dLat, extra = {}) => ({ id, title: id, lat: here.lat + dLat, lng: here.lng, ...extra });

describe("pinsNear", () => {
  it("returns pins within 25 km, nearest first, with their distance", () => {
    const result = pinsNear([pin("far", 0.2), pin("out", 0.25), pin("near", 0.1), pin("on", 0)], here);
    expect(result.map((p) => p.id)).toEqual(["on", "near", "far"]);
    expect(result[0].distanceKm).toBe(0);
    expect(result[1].distanceKm).toBeCloseTo(11.12, 1);
    expect(result[2].distanceKm).toBeCloseTo(22.24, 1);
  });

  it("includes a pin exactly on the radius", () => {
    const edge = pin("edge", 0.3);
    expect(pinsNear([edge], here, distanceKm(edge, here)).map((p) => p.id)).toEqual(["edge"]);
  });

  it("honours a custom radius", () => {
    expect(pinsNear([pin("a", 0.1), pin("b", 0.2)], here, 15).map((p) => p.id)).toEqual(["a"]);
  });

  it("measures across the antimeridian", () => {
    const east = { id: "east", lat: 0, lng: 179.9 };
    const result = pinsNear([east], { lat: 0, lng: -179.95 });
    expect(result.map((p) => p.id)).toEqual(["east"]);
    expect(result[0].distanceKm).toBeCloseTo(16.68, 1);
  });

  it("skips virtual story-pins and pins without coordinates", () => {
    const candidates = [
      pin("virtual", 0, { virtual: true }),
      { id: "nolat", title: "x", lat: null, lng: 135 },
      { id: "nan", title: "x", lat: NaN, lng: 135 },
      pin("real", 0.05),
    ];
    expect(pinsNear(candidates, here).map((p) => p.id)).toEqual(["real"]);
  });

  it("keeps lat/lng 0 as real coordinates", () => {
    expect(pinsNear([{ id: "null-island", lat: 0, lng: 0 }], { lat: 0, lng: 0.1 }).map((p) => p.id)).toEqual(["null-island"]);
  });

  it("returns nothing for a point without coordinates", () => {
    const candidates = [pin("a", 0)];
    expect(pinsNear(candidates, null)).toEqual([]);
    expect(pinsNear(candidates, undefined)).toEqual([]);
    expect(pinsNear(candidates, { lat: 35 })).toEqual([]);
  });

  it("doesn't mutate the candidates", () => {
    const candidates = [pin("b", 0.2), pin("a", 0.1)];
    const before = structuredClone(candidates);
    pinsNear(candidates, here);
    expect(candidates).toEqual(before);
  });
});

describe("autoPinFor", () => {
  it("files under the nearest pin in range", () => {
    expect(autoPinFor([pin("far", 0.2), pin("near", 0.1)], here)).toBe("near");
  });

  it('is "new" when no pin is in range', () => {
    expect(autoPinFor([pin("out", 0.25)], here)).toBe("new");
    expect(autoPinFor([], here)).toBe("new");
  });

  it("never picks a virtual story-pin", () => {
    expect(autoPinFor([pin("virtual", 0, { virtual: true })], here)).toBe("new");
  });

  it('is "new" without coordinates (callers gate on coords first)', () => {
    expect(autoPinFor([pin("a", 0)], null)).toBe("new");
  });
});

describe("isShownByStop", () => {
  const storyPin = (stops, extra = {}) => ({ ...pin("loc", 0), trips: [{ id: "t", stops }], ...extra });

  it("is true when a trip stop sits within 25 km of the pin", () => {
    expect(isShownByStop(storyPin([{ lat: 35.1, lng: 135 }]))).toBe(true);
  });

  it("is false when every stop is further away or unplaced", () => {
    expect(isShownByStop(storyPin([{ lat: 35.25, lng: 135 }, { lat: null, lng: null }]))).toBe(false);
  });

  it("is false for a trip with no stops, or no trips", () => {
    expect(isShownByStop({ ...pin("loc", 0), trips: [{ id: "t" }] })).toBe(false);
    expect(isShownByStop({ ...pin("loc", 0), trips: [] })).toBe(false);
  });

  it("is false for a virtual pin", () => {
    expect(isShownByStop(storyPin([{ lat: 35, lng: 135 }], { virtual: true }))).toBe(false);
  });
});

describe("materializePin", () => {
  // Each test uses its own blog id: the shared-pin memo outlives a test.
  let n = 0;
  const virtualPin = () => {
    const blogId = `post-${++n}`;
    return { id: `blog:${blogId}`, blogId, lat: 35, lng: 135, title: "Kyoto", placeName: "Kyoto", virtual: true };
  };

  it("returns a real pin as is, without linking anything", async () => {
    const real = { ...pin("real", 0), trips: [] };
    const link = vi.fn();
    expect(await materializePin(real, link)).toBe(real);
    expect(link).not.toHaveBeenCalled();
    expect(await getPins()).toEqual([]);
  });

  it("creates the pin at the post's spot and files the post under it", async () => {
    const story = virtualPin();
    const link = vi.fn(async () => {});
    const created = await materializePin(story, link);
    expect(created).toMatchObject({ lat: 35, lng: 135, title: "Kyoto", placeName: "Kyoto" });
    expect(created.virtual).toBeUndefined();
    expect(link).toHaveBeenCalledWith([story.blogId], created);
    expect(await getPins()).toEqual([created]);
  });

  it("creates one pin for a double click", async () => {
    const story = virtualPin();
    const link = vi.fn(async () => {});
    const [a, b] = await Promise.all([materializePin(story, link), materializePin(story, link)]);
    expect(a.id).toBe(b.id);
    expect(await getPins()).toHaveLength(1);
  });

  it("reuses the pin when called again before the virtual pin is gone", async () => {
    const story = virtualPin();
    const link = async () => {};
    const first = await materializePin(story, link);
    expect((await materializePin(story, link)).id).toBe(first.id);
    expect(await getPins()).toHaveLength(1);
  });

  it("reuses the pin on a retry after linking the post failed", async () => {
    const story = virtualPin();
    await expect(materializePin(story, async () => Promise.reject(new Error("offline")))).rejects.toThrow("offline");
    const link = vi.fn(async () => {});
    const pinAfterRetry = await materializePin(story, link);
    expect(await getPins()).toEqual([pinAfterRetry]);
    expect(link).toHaveBeenCalledWith([story.blogId], pinAfterRetry);
  });

  it("creates a fresh pin when the earlier one was deleted since", async () => {
    const story = virtualPin();
    const link = async () => {};
    const first = await materializePin(story, link);
    await deletePin(first.id);
    const second = await materializePin(story, link);
    expect(second.id).not.toBe(first.id);
    expect(await getPins()).toEqual([second]);
  });

  it("doesn't reuse the pin of a deleted post for a new post with the same id elsewhere", async () => {
    const link = async () => {};
    const old = virtualPin();
    const first = await materializePin(old, link);
    // The post is deleted (its pin stays) and a new post gets the same slug id, 500 km away.
    const reborn = { ...old, lat: old.lat + 4.5, title: "Sendai", placeName: "Sendai" };
    const second = await materializePin(reborn, link);
    expect(second.id).not.toBe(first.id);
    expect(second).toMatchObject({ lat: reborn.lat, lng: reborn.lng, title: "Sendai" });
    expect(await getPins()).toHaveLength(2);
  });

  it("still reuses the pin when the post is within the merge radius of it", async () => {
    const link = async () => {};
    const story = virtualPin();
    const first = await materializePin(story, link);
    const second = await materializePin({ ...story, lat: story.lat + 0.1 }, link); // ~11 km
    expect(second.id).toBe(first.id);
  });

  it("keeps different posts apart", async () => {
    const link = async () => {};
    const a = await materializePin(virtualPin(), link);
    const b = await materializePin(virtualPin(), link);
    expect(a.id).not.toBe(b.id);
  });
});
