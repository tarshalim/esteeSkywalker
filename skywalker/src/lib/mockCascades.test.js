import { beforeEach, describe, expect, it } from "vitest";
import {
  MOCK_KEYS,
  cascadeBlogDelete,
  cascadeBlogTrip,
  cascadePinDelete,
  cascadeTripDelete,
  cascadeTripLocation,
} from "./mockCascades";

// Vitest runs in node: a minimal in-memory localStorage.
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

const put = (key, items) => localStorage.setItem(MOCK_KEYS[key], JSON.stringify(items));
const get = (key) => JSON.parse(localStorage.getItem(MOCK_KEYS[key]) ?? "[]");
const byId = (key) => Object.fromEntries(get(key).map((item) => [item.id, item]));

describe("cascadeBlogDelete", () => {
  it("unattaches photos and drops the post's comments and reactions", () => {
    put("photos", [
      { id: "p1", blogId: "b1", tripId: "t1", pinId: "pin1" },
      { id: "p2", blogId: "b2", tripId: null, pinId: null },
    ]);
    put("comments", [{ id: "c1", blogId: "b1" }, { id: "c2", blogId: "b2" }]);
    put("reactions", [{ blogId: "b1", emoji: "❤️" }, { blogId: "b2", emoji: "👏" }]);

    expect(cascadeBlogDelete("b1")).toEqual(["gallery_items", "section_comments", "section_reactions"]);
    // Trip and location stay, like ON DELETE SET NULL on blog_id only.
    expect(byId("photos").p1).toEqual({ id: "p1", blogId: null, tripId: "t1", pinId: "pin1" });
    expect(byId("photos").p2.blogId).toBe("b2");
    expect(get("comments").map((c) => c.id)).toEqual(["c2"]);
    expect(get("reactions")).toEqual([{ blogId: "b2", emoji: "👏" }]);
  });

  it("stops a new post that reuses the slug from inheriting old comments", () => {
    put("comments", [{ id: "c1", blogId: "tokyo" }]);
    cascadeBlogDelete("tokyo");
    expect(get("comments").filter((c) => c.blogId === "tokyo")).toEqual([]);
  });

  it("reports nothing when nothing referenced the post", () => {
    expect(cascadeBlogDelete("b9")).toEqual([]);
  });
});

describe("cascadeBlogTrip", () => {
  beforeEach(() => {
    put("trips", [{ id: "t2", locationId: "pin2" }]);
    put("photos", [
      { id: "p1", blogId: "b1", tripId: "t1", pinId: "pin1" },
      { id: "p2", blogId: "other", tripId: "t1", pinId: "pin1" },
    ]);
  });

  it("moves attached photos to the post's new trip and its location", () => {
    expect(cascadeBlogTrip({ id: "b1", tripId: "t1", pinId: "pin1" }, { id: "b1", tripId: "t2", pinId: "pin1" })).toEqual([
      "gallery_items",
    ]);
    expect(byId("photos").p1).toMatchObject({ tripId: "t2", pinId: "pin2" });
    expect(byId("photos").p2).toMatchObject({ tripId: "t1", pinId: "pin1" });
  });

  it("leaves them at the post's own location when it leaves its trip", () => {
    cascadeBlogTrip({ id: "b1", tripId: "t1" }, { id: "b1", tripId: null, pinId: "pin3" });
    expect(byId("photos").p1).toMatchObject({ tripId: null, pinId: "pin3" });
  });

  it("does nothing when the trip didn't change", () => {
    expect(cascadeBlogTrip({ id: "b1", tripId: "t1" }, { id: "b1", tripId: "t1", pinId: "pin9" })).toEqual([]);
    expect(byId("photos").p1.pinId).toBe("pin1");
  });

  it("treats a missing tripId like null", () => {
    expect(cascadeBlogTrip({ id: "b1" }, { id: "b1", tripId: null })).toEqual([]);
  });
});

describe("cascadeTripLocation", () => {
  it("moves the trip's posts and photos to the new location", () => {
    put("blogs", [
      { id: "b1", tripId: "t1", pinId: "pin1" },
      { id: "b2", tripId: null, pinId: "pin1" },
    ]);
    put("photos", [{ id: "p1", tripId: "t1", pinId: "pin1" }]);
    expect(cascadeTripLocation("t1", "pin2")).toEqual(["blogs", "gallery_items"]);
    expect(byId("blogs").b1.pinId).toBe("pin2");
    expect(byId("blogs").b2.pinId).toBe("pin1");
    expect(byId("photos").p1.pinId).toBe("pin2");
  });
});

describe("cascadeTripDelete", () => {
  it("unfiles posts and photos from the trip but keeps their location", () => {
    put("blogs", [{ id: "b1", tripId: "t1", pinId: "pin1" }]);
    put("photos", [{ id: "p1", tripId: "t1", pinId: "pin1" }]);
    expect(cascadeTripDelete("t1")).toEqual(["blogs", "gallery_items"]);
    expect(byId("blogs").b1).toEqual({ id: "b1", tripId: null, pinId: "pin1" });
    expect(byId("photos").p1).toEqual({ id: "p1", tripId: null, pinId: "pin1" });
  });
});

describe("cascadePinDelete", () => {
  it("deletes the location's trips and unfiles everything under it", () => {
    put("trips", [
      { id: "t1", locationId: "pin1" },
      { id: "t2", locationId: "pin2" },
    ]);
    put("blogs", [
      { id: "b1", tripId: "t1", pinId: "pin1" },
      { id: "b2", tripId: null, pinId: "pin1" },
      { id: "b3", tripId: "t2", pinId: "pin2" },
    ]);
    put("photos", [{ id: "p1", blogId: "b1", tripId: "t1", pinId: "pin1" }]);

    expect(cascadePinDelete("pin1")).toEqual(["trips", "blogs", "gallery_items"]);
    expect(get("trips").map((t) => t.id)).toEqual(["t2"]);
    expect(byId("blogs").b1).toMatchObject({ tripId: null, pinId: null });
    expect(byId("blogs").b2).toMatchObject({ tripId: null, pinId: null });
    expect(byId("blogs").b3).toMatchObject({ tripId: "t2", pinId: "pin2" });
    expect(byId("photos").p1).toEqual({ id: "p1", blogId: "b1", tripId: null, pinId: null });
  });
});
