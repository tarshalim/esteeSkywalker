import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock mode, whatever .env says.
vi.mock(import("./supabase"), async (importOriginal) => ({ ...(await importOriginal()), supabase: null }));
// No window in node; the live-sync broadcast isn't under test.
vi.mock(import("./liveSync"), () => ({ notifyDataChanged: () => {} }));

const { createCollection } = await import("./collection");
const { MOCK_KEYS } = await import("./mockCascades");
const { upsertBlog, getBlogs, getBlogById, setBlogVisibility, deleteBlog, setBlogsPin, saveTemplate, getTemplates, getTemplateById, deleteTemplate } =
  await import("./blogStore");
const { postLocationFields, postLocationPayload } = await import("./postLocation");

// Vitest runs in node: a minimal in-memory localStorage.
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

describe("createCollection (mock mode)", () => {
  const things = () => createCollection({ table: "things", storageKey: "test.things", label: "thing" });

  it("inserts, gets, updates and removes", async () => {
    const c = things();
    await c.insert({ id: "a", n: 1 });
    await c.insert({ id: "b", n: 2 });
    expect(await c.update({ id: "a", n: 3 })).toEqual({ id: "a", n: 3 });
    expect(await c.get("a")).toEqual({ id: "a", n: 3 });
    expect(await c.remove("b")).toEqual({ id: "b", n: 2 });
    expect(await c.list()).toEqual([{ id: "a", n: 3 }]);
    expect(await c.get("b")).toBeNull();
  });

  it("throws a readable error for an id that isn't there", async () => {
    const c = things();
    await expect(c.update({ id: "nope" })).rejects.toThrow("This thing may already be gone, or you don't have permission to change it.");
    await expect(c.remove("nope")).rejects.toThrow("This thing may already be gone, or you don't have permission to delete it.");
    // A failed update doesn't create the item.
    expect(await c.list()).toEqual([]);
  });
});

describe("blogStore on the collection (mock mode)", () => {
  it("creates posts with slug ids and trail positions, and sorts by trackX", async () => {
    const first = await upsertBlog({ title: "Tokyo Nights", startDate: "2026-01-02" });
    const second = await upsertBlog({ title: "Tokyo Nights", startDate: "2026-02-03" });
    expect(first).toMatchObject({ id: "tokyo-nights", trackX: 900, status: "draft", startDate: "2026-01-02" });
    expect(second.id).toMatch(/^tokyo-nights-/);
    expect(second.trackX).toBe(1900);
    expect((await getBlogs()).map((b) => b.id)).toEqual([first.id, second.id]);
  });

  it("puts each new story 1000 past the last one, even after deletes, and edits don't move it", async () => {
    const a = await upsertBlog({ title: "A", startDate: "2026-05-01" });
    const b = await upsertBlog({ title: "B", startDate: "2026-01-01" });
    const c = await upsertBlog({ title: "C", startDate: "2026-03-01" });
    expect([a.trackX, b.trackX, c.trackX]).toEqual([900, 1900, 2900]);
    // Creation order, not story date.
    expect((await getBlogs()).map((p) => p.id)).toEqual(["a", "b", "c"]);
    // Deleting a middle post leaves a gap; deleting the last one frees its spot.
    await deleteBlog("b");
    await deleteBlog("c");
    expect((await upsertBlog({ title: "D", startDate: "2026-01-01" })).trackX).toBe(1900);
    expect((await upsertBlog({ id: "a", title: "A2", startDate: "2027-01-01" })).trackX).toBe(900);
    // Last post gone: the next one starts over.
    await deleteBlog("a");
    await deleteBlog("d");
    expect((await upsertBlog({ title: "E", startDate: "2026-01-01" })).trackX).toBe(900);
  });

  it("keeps an explicit trackX, and a stored post without one doesn't break the next", async () => {
    expect((await upsertBlog({ title: "Fixed", trackX: 5000, startDate: "2026-01-01" })).trackX).toBe(5000);
    // Old mock data from before trackX, or a hand-edited row.
    const stored = JSON.parse(localStorage.getItem(MOCK_KEYS.blogs));
    localStorage.setItem(MOCK_KEYS.blogs, JSON.stringify([...stored, { id: "legacy", title: "Legacy", status: "published" }]));
    const next = await upsertBlog({ title: "Next", trackX: null, startDate: "2026-01-01" });
    expect(next.trackX).toBe(6000);
    // The legacy post sorts as 0 (track_x's default), not wherever NaN lands.
    expect((await getBlogs()).map((p) => p.id)).toEqual(["legacy", "fixed", "next"]);
  });

  it("doesn't give a post an id that a /blogs/* route would shadow", async () => {
    expect((await upsertBlog({ title: "New", startDate: "2026-01-02" })).id).toMatch(/^new-.+/);
    expect((await upsertBlog({ title: "Drafts!", startDate: "2026-01-02" })).id).toMatch(/^drafts-.+/);
    expect((await upsertBlog({ title: "New Zealand", startDate: "2026-01-02" })).id).toBe("new-zealand");
  });

  it("merges an update into the stored post and keeps the location's coordinates", async () => {
    await upsertBlog({ title: "Oslo", startDate: "2026-03-01", location: { name: "Oslo", lat: 59.9, lng: 10.7 } });
    const saved = await upsertBlog({ id: "oslo", location: { name: "Oslo harbour" }, favorite: true });
    expect(saved).toMatchObject({ id: "oslo", favorite: true, startDate: "2026-03-01", trackX: 900 });
    expect(saved.location).toEqual({ name: "Oslo harbour", lat: 59.9, lng: 10.7 });
    expect(await getBlogById("oslo")).toEqual(saved);
  });

  it("round-trips dates, vibes, weather and location through save and load", async () => {
    const weather = { condition: "rainy", tempC: 18, label: "Light Rain", source: "manual" };
    const fields = {
      title: "Kyoto",
      startDate: "2026-04-01",
      endDate: "2026-04-05",
      vibes: ["food", "temples"],
      weather,
      city: "Kyoto",
      location: postLocationPayload({ name: "Gion", coords: { lat: 35.01, lng: 135.77 } }),
    };
    await upsertBlog(fields);
    const loaded = await getBlogById("kyoto");
    expect(loaded).toMatchObject({ ...fields, postDate: "2026-04-01", year: 2026 });

    // Back to a single day, no weather, no vibes, location cleared.
    const saved = await upsertBlog({
      id: "kyoto",
      endDate: null,
      vibes: [],
      weather: null,
      location: postLocationPayload({ name: "", coords: null }),
    });
    expect(saved).toMatchObject({ startDate: "2026-04-01", endDate: null, vibes: [], weather: null });
    expect(postLocationFields((await getBlogById("kyoto")).location)).toEqual({ name: "", coords: null });
  });

  it("rejects an end date before the start date", async () => {
    await expect(upsertBlog({ title: "Bad", startDate: "2026-04-05", endDate: "2026-04-01" })).rejects.toThrow("End date can't be before");
  });

  it("files a centroid-only post at the pin's spot", async () => {
    const centroid = { lat: 36.2, lng: 138.25 };
    await upsertBlog({ title: "Japan", startDate: "2026-04-01", location: postLocationPayload({ name: "", coords: null, countryName: "Japan", centroid }) });
    const [saved] = await setBlogsPin(["japan"], { id: "pin-1", lat: 35.01, lng: 135.77, title: "Kyoto" });
    expect(saved.location).toEqual({ name: "Japan", lat: 35.01, lng: 135.77, approx: false });
    expect(postLocationFields(saved.location).coords).toEqual({ lat: 35.01, lng: 135.77 });
  });

  it("toggles visibility and deletes", async () => {
    await upsertBlog({ title: "Lima", startDate: "2026-04-01", countryCode: "PE" });
    expect((await setBlogVisibility("lima", true)).status).toBe("published");
    expect((await getBlogById("lima")).status).toBe("published");
    expect(await deleteBlog("lima")).toBe(true);
    expect(JSON.parse(localStorage.getItem(MOCK_KEYS.blogs))).toEqual([]);
    await expect(deleteBlog("lima")).rejects.toThrow("This post may already be gone");
  });

  it("deleting a post drops its comments and reactions, unattaches its photos and leaves pins, trips and other posts alone", async () => {
    const seed = (key, rows) => localStorage.setItem(key, JSON.stringify(rows));
    seed(MOCK_KEYS.pins, [{ id: "pin-1", lat: 35, lng: 135, title: "Kyoto" }]);
    seed(MOCK_KEYS.trips, [{ id: "trip-1", locationId: "pin-1", title: "Spring" }]);
    await upsertBlog({ title: "Kyoto", startDate: "2026-04-01", pinId: "pin-1", tripId: "trip-1" });
    await upsertBlog({ title: "Nara", startDate: "2026-04-02", pinId: "pin-1", tripId: "trip-1" });
    seed(MOCK_KEYS.photos, [
      { id: "p1", blogId: "kyoto", tripId: "trip-1", pinId: "pin-1" },
      { id: "p2", blogId: "nara", tripId: "trip-1", pinId: "pin-1" },
    ]);
    seed(MOCK_KEYS.comments, [{ id: "c1", blogId: "kyoto" }, { id: "c2", blogId: "nara" }]);
    seed(MOCK_KEYS.reactions, [{ blogId: "kyoto", sectionId: "s", emoji: "❤️", reactor: "g:x" }]);

    await deleteBlog("kyoto");

    const read = (key) => JSON.parse(localStorage.getItem(key));
    expect((await getBlogs()).map((b) => b.id)).toEqual(["nara"]);
    expect(read(MOCK_KEYS.photos)).toEqual([
      { id: "p1", blogId: null, tripId: "trip-1", pinId: "pin-1" },
      { id: "p2", blogId: "nara", tripId: "trip-1", pinId: "pin-1" },
    ]);
    expect(read(MOCK_KEYS.comments)).toEqual([{ id: "c2", blogId: "nara" }]);
    expect(read(MOCK_KEYS.reactions)).toEqual([]);
    expect(read(MOCK_KEYS.pins)).toHaveLength(1);
    expect(read(MOCK_KEYS.trips)).toHaveLength(1);
  });
});

describe("templates (mock mode)", () => {
  const canvas = { version: 1, size: { width: 794 }, theme: { paper: { style: "plain", color: "#2563eb" } }, elements: [{ id: "e1", type: "text", html: "<p>Hi</p>" }] };

  it("saves, lists, loads and deletes a template", async () => {
    const weather = { condition: "sunny", tempC: 21, label: "Sunny", source: "auto" };
    const saved = await saveTemplate({ name: "Blue day", title: "Blue ", excerpt: "x", coverImage: "", vibes: ["nature"], weather, canvas, blocks: [] });
    expect(saved).toMatchObject({ name: "Blue day", category: "My template", builtIn: false, palette: "blue", aesthetic: null, vibes: ["nature"], weather, canvas });
    expect(saved.id).toMatch(/^tpl_/);

    expect(await getTemplates()).toEqual([saved]);
    expect(await getTemplateById(saved.id)).toEqual(saved);

    expect((await deleteTemplate(saved.id)).id).toBe(saved.id);
    expect(await getTemplates()).toEqual([]);
    expect(await getTemplateById(saved.id)).toBeNull();
    await expect(deleteTemplate(saved.id)).rejects.toThrow("This template may already be gone");
  });

  it("loads built-ins by id, including retired ids, without touching storage", async () => {
    expect((await getTemplateById("builtin-after-dark")).builtIn).toBe(true);
    expect((await getTemplateById("builtin-quiet-notes")).id).toBe("builtin-vintage-travelogue-journal");
    expect(await getTemplates()).toEqual([]);
  });

  it("normalizes an old blocks-only row with no name", async () => {
    localStorage.setItem("skywalker.templates.v1", JSON.stringify([{ id: "old", title: "Old trip", blocks: [{ kind: "text", variant: "paragraph", html: "<p>Hello</p>" }], weather: {} }]));
    const [tpl] = await getTemplates();
    expect(tpl).toMatchObject({ id: "old", name: "Old trip", description: "", vibes: [], weather: null, builtIn: false });
    expect(tpl.canvas.elements.length).toBeGreaterThan(0);
  });
});
