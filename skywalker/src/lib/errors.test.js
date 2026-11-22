import { describe, expect, it } from "vitest";
import { commentErrorMessage } from "./commentStore";
import { errorMessage, infraErrorMessage } from "./errors";

describe("errorMessage", () => {
  it("maps network failures from fetch and PostgREST", () => {
    for (const message of ["Failed to fetch", "TypeError: Failed to fetch", "NetworkError when attempting to fetch resource.", "Load failed", "FetchError: The user aborted a request."]) {
      expect(errorMessage({ message, code: "" })).toMatch(/can’t reach the server/i);
    }
  });

  it("maps an expired JWT", () => {
    expect(errorMessage({ code: "PGRST301", message: "JWT expired" })).toMatch(/session has expired/);
    expect(errorMessage({ code: "PGRST303", message: "JWT expired" })).toMatch(/session has expired/);
  });

  it("maps RLS denials from PostgREST and Storage", () => {
    expect(errorMessage({ code: "42501", message: 'new row violates row-level security policy for table "blogs"' })).toMatch(/permission/);
    expect(errorMessage({ statusCode: "403", message: "new row violates row-level security policy" })).toMatch(/permission/);
  });

  it("maps Storage size and MIME rejections", () => {
    expect(errorMessage({ statusCode: "413", message: "The object exceeded the maximum allowed size" })).toBe("That file is too large.");
    expect(errorMessage({ statusCode: "415", message: "mime type image/tiff is not supported" })).toBe("That file type isn’t supported.");
  });

  it("maps unique violations", () => {
    expect(errorMessage({ code: "23505", message: 'duplicate key value violates unique constraint "pins_pkey"' })).toBe("That already exists.");
  });

  it("passes trigger and app messages through unchanged", () => {
    const msg = "Stop dates (2026-01-01 – 2026-01-05) must fall within the trip (2026-02-01 – 2026-02-10)";
    expect(errorMessage({ code: "23514", message: msg })).toBe(msg);
    expect(errorMessage(new Error("Pick a trip first."))).toBe("Pick a trip first.");
  });

  it("falls back when there's nothing to show", () => {
    expect(errorMessage(null)).toBe("Something went wrong. Please try again.");
    expect(errorMessage({}, "Couldn't load your gallery.")).toBe("Couldn't load your gallery.");
    expect(errorMessage("")).toBe("Something went wrong. Please try again.");
    expect(errorMessage("Plain string")).toBe("Plain string");
  });

  it("infraErrorMessage returns null for unknown errors", () => {
    expect(infraErrorMessage(new Error("boom"))).toBeNull();
    expect(infraErrorMessage(undefined)).toBeNull();
  });
});

describe("commentErrorMessage", () => {
  it("keeps the trigger hints first", () => {
    expect(commentErrorMessage({ hint: "rate_limited", message: "x" })).toMatch(/commenting a little fast/);
  });

  it("explains network failures instead of the generic line", () => {
    expect(commentErrorMessage({ message: "TypeError: Failed to fetch" })).toMatch(/can’t reach the server/i);
  });

  it("still hides unknown errors", () => {
    expect(commentErrorMessage(new Error("relation does not exist"))).toBe("Couldn’t post your comment. Please try again.");
  });
});
