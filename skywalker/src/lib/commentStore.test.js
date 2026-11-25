import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake Supabase client for `section_comments` that applies the "delete own
// comment or moderate" policy the way RLS does: a refused delete matches no
// rows instead of raising.
const fake = vi.hoisted(() => ({ rows: [], viewer: { id: null, admin: false } }));
vi.mock(import("./supabase"), async (importOriginal) => ({
  ...(await importOriginal()),
  supabase: {
    from: () => ({
      delete: () => ({
        eq: (_col, id) => ({
          select: async () => {
            const allowed = (r) => r.id === id && (fake.viewer.admin || (r.user_id && r.user_id === fake.viewer.id));
            const gone = fake.rows.filter(allowed);
            fake.rows = fake.rows.filter((r) => !allowed(r));
            return { data: gone.map((r) => ({ id: r.id })), error: null };
          },
        }),
      }),
      select: () => ({
        eq: async (_col, id) => ({ data: fake.rows.filter((r) => r.id === id).map((r) => ({ id: r.id })), error: null }),
      }),
    }),
  },
}));

const { deleteSectionComment } = await import("./commentStore");

beforeEach(() => {
  fake.rows = [
    { id: "c1", user_id: "alice" },
    { id: "c2", user_id: null }, // a guest's comment
  ];
  fake.viewer = { id: null, admin: false };
});

describe("deleteSectionComment", () => {
  it("lets the author delete their own comment", async () => {
    fake.viewer = { id: "alice", admin: false };
    await expect(deleteSectionComment("c1")).resolves.toBe(true);
    expect(fake.rows.map((r) => r.id)).toEqual(["c2"]);
  });

  it("lets an admin delete anyone's comment, guests' included", async () => {
    fake.viewer = { id: "root", admin: true };
    await deleteSectionComment("c1");
    await deleteSectionComment("c2");
    expect(fake.rows).toEqual([]);
  });

  it("throws when RLS refuses the delete, instead of reporting success", async () => {
    fake.viewer = { id: "bob", admin: false };
    await expect(deleteSectionComment("c1")).rejects.toThrow("You can only delete your own comments.");
    await expect(deleteSectionComment("c2")).rejects.toThrow();
    expect(fake.rows).toHaveLength(2);
  });

  it("treats a comment someone already deleted as done", async () => {
    fake.viewer = { id: "alice", admin: false };
    await expect(deleteSectionComment("missing")).resolves.toBe(true);
  });
});
