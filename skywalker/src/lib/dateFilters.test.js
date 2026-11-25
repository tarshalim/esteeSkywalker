import { describe, expect, it } from "vitest";
import { dateFilterBounds, dateTime, dateYear, matchesDateFilter } from "./dateFilters";

describe("dateFilterBounds", () => {
  it("returns null for no filter or an empty one", () => {
    expect(dateFilterBounds(null)).toBeNull();
    expect(dateFilterBounds({ mode: "day", start: "", end: "" })).toBeNull();
    expect(dateFilterBounds({ mode: "range", start: "", end: "" })).toBeNull();
  });

  it("covers a whole month", () => {
    expect(dateFilterBounds({ mode: "month", start: "2025-02", end: "" })).toEqual(["2025-02-01", "2025-02-31"]);
  });
});

describe("matchesDateFilter", () => {
  const day = { mode: "day", start: "2025-03-09", end: "" };
  const month = { mode: "month", start: "2025-03", end: "" };

  it("matches everything without a complete filter", () => {
    expect(matchesDateFilter("2025-03-09", null, null)).toBe(true);
    expect(matchesDateFilter(undefined, null, { mode: "range", start: "", end: "" })).toBe(true);
  });

  it("never matches an undated item once a filter is set", () => {
    expect(matchesDateFilter(undefined, null, day)).toBe(false);
    expect(matchesDateFilter("", null, day)).toBe(false);
  });

  it("compares only the date part of ISO timestamps (gallery items)", () => {
    expect(matchesDateFilter("2025-03-09T00:00:00.000Z", null, day)).toBe(true);
    expect(matchesDateFilter("2025-03-09T23:30:00.000Z", null, day)).toBe(true);
    expect(matchesDateFilter("2025-03-10T00:00:00.000Z", null, day)).toBe(false);
  });

  it("includes both ends of a range, and the last day of a month", () => {
    const range = { mode: "range", start: "2025-03-01", end: "2025-03-09" };
    expect(matchesDateFilter("2025-03-01", null, range)).toBe(true);
    expect(matchesDateFilter("2025-03-09T18:00:00.000Z", null, range)).toBe(true);
    expect(matchesDateFilter("2025-03-10", null, range)).toBe(false);
    expect(matchesDateFilter("2025-03-31", null, month)).toBe(true);
    expect(matchesDateFilter("2025-04-01", null, month)).toBe(false);
  });

  it("supports open-ended ranges", () => {
    expect(matchesDateFilter("2030-01-01", null, { mode: "range", start: "2025-03-01", end: "" })).toBe(true);
    expect(matchesDateFilter("2020-01-01", null, { mode: "range", start: "", end: "2025-03-01" })).toBe(true);
    expect(matchesDateFilter("2025-03-02", null, { mode: "range", start: "", end: "2025-03-01" })).toBe(false);
  });

  it("matches a multi-day span that overlaps the filter (blog trips)", () => {
    expect(matchesDateFilter("2025-02-25", "2025-03-02", month)).toBe(true);
    expect(matchesDateFilter("2025-03-30", "2025-04-04", month)).toBe(true);
    expect(matchesDateFilter("2025-02-01", "2025-02-28", month)).toBe(false);
  });
});

describe("dateYear", () => {
  it("reads the year from the date part, never shifted by the time zone", () => {
    // UTC midnight on Jan 1 is still Dec 31 in the Americas; the tag says 2025.
    expect(dateYear("2025-01-01")).toBe(2025);
    expect(dateYear("2025-01-01T00:00:00.000Z")).toBe(2025);
    expect(dateYear("2025-01-01T00:00:00+00:00")).toBe(2025);
    expect(dateYear("2024-12-31")).toBe(2024);
  });

  it("is NaN when there's no date", () => {
    expect(dateYear(null)).toBeNaN();
    expect(dateYear(undefined)).toBeNaN();
    expect(dateYear("")).toBeNaN();
    expect(dateYear("not a date")).toBeNaN();
  });
});

describe("dateTime", () => {
  it("orders dates and timestamps", () => {
    expect(dateTime("2025-03-02")).toBeGreaterThan(dateTime("2025-03-01"));
    expect(dateTime("2025-03-01T12:00:00Z")).toBeGreaterThan(dateTime("2025-03-01"));
  });

  it("gives 0, not NaN, for a missing or invalid date, so sorts stay defined", () => {
    expect(dateTime(null)).toBe(0);
    expect(dateTime(undefined)).toBe(0);
    expect(dateTime("garbage")).toBe(0);
    const sorted = [{ d: "2025-01-02" }, { d: null }, { d: "2024-05-05" }].sort((a, b) => dateTime(b.d) - dateTime(a.d));
    expect(sorted.map((x) => x.d)).toEqual(["2025-01-02", "2024-05-05", null]);
  });
});
