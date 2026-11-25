import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock mode, whatever .env says. The Supabase path's delete rules are in
// commentStore.test.js; this file covers what both modes share: the guest and
// body rules, which must match the stamp_section_comment trigger and the
// section_comments column checks.
vi.mock(import("./supabase"), async (importOriginal) => ({ ...(await importOriginal()), supabase: null }));

const {
  COMMENT_MAX,
  NAME_MAX,
  addSectionComment,
  cleanCommentBody,
  cleanGuestName,
  commentErrorMessage,
  getSectionComments,
  validateCommentBody,
  validateGuest,
} = await import("./commentStore");

beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

const guest = { name: "Ana", email: "ana@example.com" };

describe("validateGuest", () => {
  it("accepts a name and a valid email, ignoring surrounding spaces", () => {
    expect(validateGuest({ name: "  Ana  ", email: " ana@example.com " })).toBeNull();
  });

  it("rejects a blank, control-character-only or too-long name", () => {
    expect(validateGuest({ ...guest, name: "   " })).toMatch(/your name/);
    expect(validateGuest({ ...guest, name: "\u0001\u0002" })).toMatch(/your name/);
    expect(validateGuest({ ...guest, name: "a".repeat(NAME_MAX) })).toBeNull();
    expect(validateGuest({ ...guest, name: "a".repeat(NAME_MAX + 1) })).toMatch(/up to 60/);
  });

  it("counts characters like Postgres does (code points, not UTF-16 units)", () => {
    // 60 emoji = 120 UTF-16 units, but 60 characters to char_length.
    expect(validateGuest({ ...guest, name: "😀".repeat(NAME_MAX) })).toBeNull();
    // Inner whitespace collapses before the count, as in the trigger.
    expect(validateGuest({ ...guest, name: `a${" ".repeat(10)}${"b".repeat(58)}` })).toBeNull();
  });

  it("rejects missing or malformed emails with the trigger's pattern", () => {
    for (const email of ["", "   ", "ana", "ana@", "ana@example", "a na@example.com", "ana@@example.com"]) {
      expect(validateGuest({ ...guest, email })).toMatch(/valid email/);
    }
    expect(validateGuest({ ...guest, email: `${"a".repeat(243)}@example.com` })).toMatch(/valid email/); // 255 chars
  });
});

describe("validateCommentBody", () => {
  it("rejects a blank body, or one that's blank once control characters go", () => {
    expect(validateCommentBody("")).toMatch(/write a comment/);
    expect(validateCommentBody(" \n\t ")).toMatch(/write a comment/);
    expect(validateCommentBody("\u0007\u0008")).toMatch(/write a comment/);
  });

  it("allows exactly COMMENT_MAX characters and no more", () => {
    expect(validateCommentBody("x".repeat(COMMENT_MAX))).toBeNull();
    expect(validateCommentBody(`  ${"x".repeat(COMMENT_MAX)}  `)).toBeNull();
    expect(validateCommentBody("x".repeat(COMMENT_MAX + 1))).toMatch(/up to 2000/);
    expect(validateCommentBody("❤️".repeat(COMMENT_MAX / 2))).toBeNull(); // ❤️ is 2 code points
  });
});

describe("cleaning matches the trigger", () => {
  it("keeps newlines and tabs in a body, drops other control characters (and NUL)", () => {
    expect(cleanCommentBody("  hi\u0000\u0007\n\tthere\u007f  ")).toBe("hi\n\tthere");
  });

  it("collapses whitespace in a guest name", () => {
    expect(cleanGuestName("  Ana \n  Lopez\u0001 ")).toBe("Ana Lopez");
  });
});

describe("addSectionComment (mock mode)", () => {
  it("stores a guest comment cleaned the way the trigger would", async () => {
    const c = await addSectionComment({ blogId: "b1", sectionId: "s1", body: " Nice\u0007 shot! ", guest: { name: " Ana   L ", email: "ana@example.com" } });
    expect(c).toMatchObject({ body: "Nice shot!", authorName: "Ana L", isGuest: true, userId: null });
    expect(await getSectionComments("b1")).toEqual([c]);
  });

  it("stores a member comment under their username, no guest fields needed", async () => {
    const c = await addSectionComment({ blogId: "b1", sectionId: "s1", body: "❤️", user: { id: "u1", username: "ana" } });
    expect(c).toMatchObject({ authorName: "ana", isGuest: false, userId: "u1" });
  });

  it("refuses an empty or over-long body, and a guest without a valid name/email", async () => {
    await expect(addSectionComment({ blogId: "b1", sectionId: "s1", body: "  ", guest })).rejects.toMatchObject({ hint: "invalid_body" });
    await expect(
      addSectionComment({ blogId: "b1", sectionId: "s1", body: "x".repeat(COMMENT_MAX + 1), user: { id: "u1", username: "ana" } })
    ).rejects.toMatchObject({ hint: "invalid_body" });
    await expect(addSectionComment({ blogId: "b1", sectionId: "s1", body: "hi" })).rejects.toMatchObject({ hint: "invalid_guest" });
    await expect(addSectionComment({ blogId: "b1", sectionId: "s1", body: "hi", guest: { ...guest, email: "nope" } })).rejects.toThrow(
      "Please enter a valid email address."
    );
    expect(await getSectionComments("b1")).toEqual([]);
  });
});

describe("commentErrorMessage", () => {
  it("passes the client's own validation messages through", () => {
    expect(commentErrorMessage({ hint: "invalid_body", message: "Please write a comment first." })).toBe("Please write a comment first.");
  });

  it("doesn't tell a member to fix name/email fields they can't see", () => {
    const err = { hint: "invalid_email", message: "Please enter a valid email address" };
    expect(commentErrorMessage(err)).toBe("Please enter a valid email address.");
    expect(commentErrorMessage(err, { member: true })).toMatch(/Reload the page/);
    // Other errors read the same for members.
    expect(commentErrorMessage({ hint: "duplicate" }, { member: true })).toMatch(/already posted/);
  });
});
