import { describe, expect, it } from "vitest";
import { attachTrim, formatTimestamp, hasTrim, parseTimestamp, readTrim, trimError, youTubeTrimParams } from "./mediaTrim";

describe("parseTimestamp", () => {
  it("reads seconds, m:ss and h:mm:ss", () => {
    expect(parseTimestamp("45")).toBe(45);
    expect(parseTimestamp("45.5")).toBe(45.5);
    expect(parseTimestamp("0:45")).toBe(45);
    expect(parseTimestamp(" 2:15 ")).toBe(135);
    expect(parseTimestamp("1:02:03")).toBe(3723);
    expect(parseTimestamp("90")).toBe(90); // bare seconds may pass 59
    expect(parseTimestamp("75:00")).toBe(4500); // so may leading minutes
  });

  it("returns null for blank input", () => {
    expect(parseTimestamp("")).toBeNull();
    expect(parseTimestamp("   ")).toBeNull();
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
  });

  it("returns NaN for anything that isn't a time", () => {
    for (const bad of ["abc", "-5", "1:60", "1:60:00", "1::03", ".5", "1:2:3:4", "1,5"]) {
      expect(parseTimestamp(bad), bad).toBeNaN();
    }
  });
});

describe("formatTimestamp", () => {
  it("formats m:ss and h:mm:ss", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(135)).toBe("2:15");
    expect(formatTimestamp(3725)).toBe("1:02:05");
    expect(formatTimestamp(45.5)).toBe("0:45.5");
  });

  it("returns '' for no time", () => {
    expect(formatTimestamp(null)).toBe("");
    expect(formatTimestamp(NaN)).toBe("");
    expect(formatTimestamp(undefined)).toBe("");
  });

  it("carries a fraction that rounds up instead of printing '.10'", () => {
    expect(formatTimestamp(59.9996)).toBe("1:00");
    expect(formatTimestamp(3599.9999)).toBe("1:00:00");
  });

  it("round-trips what the author typed, so a tidy on blur keeps the value", () => {
    for (const text of ["45.96", "45.25", "0:45.125", "2:15", "1:02:03.5", "0"]) {
      const sec = parseTimestamp(text);
      expect(parseTimestamp(formatTimestamp(sec)), text).toBeCloseTo(sec, 9);
    }
  });
});

describe("trimError", () => {
  it("accepts blank, start-only, end-only and ordered pairs", () => {
    expect(trimError(null, null)).toBeNull();
    expect(trimError(30, null)).toBeNull();
    expect(trimError(null, 30)).toBeNull();
    expect(trimError(0, 0.1)).toBeNull();
    expect(trimError(30, 60)).toBeNull();
  });

  it("rejects unparseable text", () => {
    expect(trimError(NaN, null)).toMatch(/m:ss/);
    expect(trimError(10, NaN)).toMatch(/m:ss/);
  });

  it("rejects an end at or before the start", () => {
    expect(trimError(60, 30)).toMatch(/after the start/);
    expect(trimError(30, 30)).toMatch(/after the start/);
  });

  it("rejects an end of 0:00 with a blank start (it would be silently ignored)", () => {
    expect(trimError(null, 0)).toMatch(/after the start/);
    expect(trimError(0, 0)).toMatch(/after the start/);
  });
});

describe("readTrim / hasTrim / youTubeTrimParams", () => {
  it("normalizes stored values", () => {
    expect(readTrim(null)).toEqual({ start: 0, end: null, loop: false });
    expect(readTrim({}, { loop: true })).toEqual({ start: 0, end: null, loop: true });
    expect(readTrim({ startSec: 10, endSec: 20, loop: false }, { loop: true })).toEqual({ start: 10, end: 20, loop: false });
    expect(readTrim({ startSec: -5, endSec: "20" })).toEqual({ start: 0, end: null, loop: false });
    expect(readTrim({ startSec: 30, endSec: 20 })).toEqual({ start: 30, end: null, loop: false });
  });

  it("detects a trim", () => {
    expect(hasTrim(readTrim({}))).toBe(false);
    expect(hasTrim(readTrim({ startSec: 1 }))).toBe(true);
    expect(hasTrim(readTrim({ endSec: 1 }))).toBe(true);
  });

  it("gives YouTube whole seconds that never cut the segment short", () => {
    expect(youTubeTrimParams(readTrim({}))).toEqual({});
    expect(youTubeTrimParams(readTrim({ startSec: 10.7, endSec: 20.2 }))).toEqual({ start: 10, end: 21 });
  });
});

function fakeMedia({ currentTime = 0, readyState = 0 } = {}) {
  const listeners = {};
  return {
    currentTime,
    readyState,
    loop: true,
    paused: false,
    plays: 0,
    addEventListener(type, fn) {
      (listeners[type] ??= new Set()).add(fn);
    },
    removeEventListener(type, fn) {
      listeners[type]?.delete(fn);
    },
    fire(type) {
      for (const fn of listeners[type] ?? []) fn();
    },
    count() {
      return Object.values(listeners).reduce((n, set) => n + set.size, 0);
    },
    play() {
      this.plays += 1;
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
  };
}

describe("attachTrim", () => {
  it("keeps the native loop for untrimmed media", () => {
    const media = fakeMedia();
    const detach = attachTrim(media, readTrim({}, { loop: false }));
    expect(media.loop).toBe(false);
    expect(media.count()).toBe(0);
    detach();
  });

  it("starts at the start, loops back at the end, and detaches cleanly", () => {
    const media = fakeMedia({ readyState: 1 });
    const detach = attachTrim(media, readTrim({ startSec: 10, endSec: 20, loop: true }));
    expect(media.loop).toBe(false);
    expect(media.currentTime).toBe(10); // already had metadata

    media.currentTime = 20;
    media.fire("timeupdate");
    expect(media.currentTime).toBe(10);
    expect(media.plays).toBe(1);

    media.currentTime = 25; // seeked past the end, then pressed play
    media.fire("play");
    expect(media.currentTime).toBe(10);

    media.currentTime = 9.9; // within the tolerance before the start
    media.fire("play");
    expect(media.currentTime).toBe(9.9);

    detach();
    expect(media.count()).toBe(0);
  });

  it("pauses at the end when not looping, including the natural end", () => {
    const media = fakeMedia();
    attachTrim(media, readTrim({ startSec: 5, loop: false }));
    media.fire("loadedmetadata");
    expect(media.currentTime).toBe(5);
    media.currentTime = 100;
    media.fire("ended");
    expect(media.currentTime).toBe(5);
    expect(media.paused).toBe(true);
    expect(media.plays).toBe(0);
  });
});
