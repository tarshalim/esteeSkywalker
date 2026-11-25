import { describe, expect, it } from "vitest";
import { TOUR_STORAGE_KEY, readTourStatus, shouldOfferTour, writeTourStatus } from "./tourStatus";

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    map,
  };
}

const blocked = {
  getItem() {
    throw new DOMException("blocked", "SecurityError");
  },
  setItem() {
    throw new DOMException("full", "QuotaExceededError");
  },
};

describe("tour status", () => {
  it("offers the tour on a first visit", () => {
    const s = memoryStorage();
    expect(readTourStatus(s)).toBeNull();
    expect(shouldOfferTour(readTourStatus(s), false)).toBe(true);
  });

  it("a dismissal (or skip, or finish) survives a reload", () => {
    for (const answer of ["dismissed", "skipped", "completed"]) {
      const s = memoryStorage();
      expect(writeTourStatus(s, answer)).toBe(true);
      expect(s.map.get(TOUR_STORAGE_KEY)).toBe(answer);
      // A reload reads it back from storage.
      expect(shouldOfferTour(readTourStatus(s), false)).toBe(false);
    }
  });

  it("isn't offered over a running tour", () => {
    expect(shouldOfferTour(null, true)).toBe(false);
  });

  it("survives blocked or absent storage (the offer just comes back next visit)", () => {
    expect(readTourStatus(blocked)).toBeNull();
    expect(readTourStatus(null)).toBeNull();
    expect(writeTourStatus(blocked, "dismissed")).toBe(false);
    expect(writeTourStatus(null, "dismissed")).toBe(false);
  });
});
