import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake Supabase client: `tables` holds each table's `data` values, and
// `removed` records what storage was asked to delete.
const fake = vi.hoisted(() => ({ tables: {}, removed: [] }));
vi.mock(import("./supabase"), async (importOriginal) => ({
  ...(await importOriginal()),
  supabase: {
    from: (table) => ({ select: async () => ({ data: (fake.tables[table] ?? []).map((data) => ({ data })), error: null }) }),
    storage: { from: () => ({ remove: async (paths) => (fake.removed.push(...paths), { error: null }) }) },
  },
}));

const { deleteOrphanedMedia } = await import("./files");

const url = (path) => `https://x.supabase.co/storage/v1/object/public/media/${path}`;

beforeEach(() => {
  fake.tables = {};
  fake.removed = [];
});

describe("deleteOrphanedMedia", () => {
  const template = { coverImage: url("a.jpg"), canvas: { elements: [{ src: url("b.jpg") }, { src: url("c%20d.jpg") }] } };

  it("deletes only the files no table still references", async () => {
    fake.tables.blogs = [{ canvas: { elements: [{ src: url("b.jpg") }] } }];
    await deleteOrphanedMedia(template, "template t");
    expect(fake.removed.sort()).toEqual(["a.jpg", "c d.jpg"]);
  });

  it("spares the files unsaved work still uses", async () => {
    await deleteOrphanedMedia(template, "template t", { canvas: { elements: [{ src: url("a.jpg") }] }, coverImage: "" });
    expect(fake.removed.sort()).toEqual(["b.jpg", "c d.jpg"]);
  });

  it("does nothing when the record had no uploads", async () => {
    await deleteOrphanedMedia({ coverImage: "https://example.com/x.jpg" }, "template t", null);
    expect(fake.removed).toEqual([]);
  });
});
