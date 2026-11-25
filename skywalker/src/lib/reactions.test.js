import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock mode, whatever .env says. The Supabase path goes through the
// section_reaction_counts / toggle_section_reaction RPCs, which apply the same
// rule per reactor: one row per (section, emoji, reader).
vi.mock(import("./supabase"), async (importOriginal) => ({ ...(await importOriginal()), supabase: null }));

const { flipReaction, getSectionReactions, guestKey, toggleSectionReaction } = await import("./commentStore");

const GUEST_KEY = "skywalker.guestKey.v1";
let store;

beforeEach(() => {
  store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Acts as another browser: a different guest key, same localStorage data. */
const asReader = (key) => store.set(GUEST_KEY, JSON.stringify(key));

describe("toggleSectionReaction / getSectionReactions (mock mode)", () => {
  it("turns a reaction on, then off, and the counts survive a reload", async () => {
    expect(await toggleSectionReaction("p1", "s1", "❤️")).toBe(true);
    expect(await getSectionReactions("p1")).toEqual({ s1: { "❤️": { count: 1, mine: true } } });
    // A reload reads the stored rows again.
    expect(await getSectionReactions("p1")).toEqual({ s1: { "❤️": { count: 1, mine: true } } });

    expect(await toggleSectionReaction("p1", "s1", "❤️")).toBe(false);
    expect(await getSectionReactions("p1")).toEqual({});
  });

  it("counts each reader once and tells each one which reactions are theirs", async () => {
    asReader("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    await toggleSectionReaction("p1", "s1", "❤️");
    await toggleSectionReaction("p1", "s1", "👏");
    asReader("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    await toggleSectionReaction("p1", "s1", "❤️");
    await toggleSectionReaction("p1", "s2", "😂");

    expect(await getSectionReactions("p1")).toEqual({
      s1: { "❤️": { count: 2, mine: true }, "👏": { count: 1, mine: false } },
      s2: { "😂": { count: 1, mine: true } },
    });

    // The second reader taking theirs back leaves the first reader's.
    await toggleSectionReaction("p1", "s1", "❤️");
    asReader("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect((await getSectionReactions("p1")).s1["❤️"]).toEqual({ count: 1, mine: true });
  });

  it("keeps posts apart", async () => {
    await toggleSectionReaction("p1", "s1", "❤️");
    expect(await getSectionReactions("p2")).toEqual({});
  });
});

describe("guestKey", () => {
  it("is created once and reused", () => {
    const key = guestKey();
    expect(key).toMatch(/^[A-Za-z0-9-]{16,64}$/);
    expect(guestKey()).toBe(key);
  });

  it("replaces a stored key the server would refuse", () => {
    store.set(GUEST_KEY, JSON.stringify("bad key!"));
    const key = guestKey();
    expect(key).not.toBe("bad key!");
    expect(key).toMatch(/^[A-Za-z0-9-]{16,64}$/);
  });

  it("works without crypto.randomUUID (plain-HTTP pages)", () => {
    vi.stubGlobal("crypto", { getRandomValues: (a) => a.fill(171) });
    expect(guestKey()).toBe("ab".repeat(16));
  });
});

describe("flipReaction", () => {
  it("turns a reaction on or off and adjusts the count", () => {
    const on = flipReaction({}, "s1", "❤️");
    expect(on).toEqual({ s1: { "❤️": { count: 1, mine: true } } });
    expect(flipReaction(on, "s1", "❤️")).toEqual({ s1: { "❤️": { count: 0, mine: false } } });
    expect(flipReaction({ s1: { "❤️": { count: 3, mine: false } } }, "s1", "❤️").s1["❤️"]).toEqual({
      count: 4,
      mine: true,
    });
  });

  it("never goes below 0 and leaves the input alone", () => {
    const map = { s1: { "👏": { count: 0, mine: true } }, s2: {} };
    const next = flipReaction(map, "s1", "👏");
    expect(next.s1["👏"]).toEqual({ count: 0, mine: false });
    expect(map.s1["👏"]).toEqual({ count: 0, mine: true });
    expect(next.s2).toBe(map.s2);
  });
});
