import { describe, expect, it } from "vitest";
import { CREATE_SLOT_SPAN, createPostPercent, riderProgressAt, riderWorldX, signpostPercent, worldWidthFor } from "./trailLayout";

// The layout MyBlog and TripJourney build: the create post in slot 0, stories after it.
function layout(storyCount, viewportWidth, canCreate = true) {
  const createSpan = canCreate ? CREATE_SLOT_SPAN : 0;
  const slotCount = storyCount + createSpan;
  const worldWidth = worldWidthFor(slotCount, viewportWidth);
  const firstPct = canCreate ? createPostPercent(worldWidth, viewportWidth) : undefined;
  const pct = (slot) => signpostPercent(slot, slotCount, firstPct);
  return {
    worldWidth,
    create: canCreate ? pct(0) : null,
    stories: Array.from({ length: storyCount }, (_, i) => pct(i + createSpan)),
  };
}

describe("signpostPercent", () => {
  it("spreads slots evenly from the first post to 86%", () => {
    expect(signpostPercent(0, 3)).toBe(14);
    expect(signpostPercent(1, 3)).toBe(50);
    expect(signpostPercent(2, 3)).toBe(86);
    expect(signpostPercent(0, 3, 30)).toBe(30);
  });

  it("centres a lone slot at 40%", () => {
    expect(signpostPercent(0, 1)).toBe(40);
    expect(signpostPercent(0, 0.6)).toBe(40);
  });
});

describe("trail layout (2d1e815)", () => {
  for (const viewportWidth of [375, 768, 1440]) {
    it(`puts stories in order after the create post, right of the rider's start (${viewportWidth}px)`, () => {
      for (const count of [1, 2, 5, 20]) {
        const { worldWidth, create, stories } = layout(count, viewportWidth);
        const riderStartPct = (riderWorldX(0, worldWidth, viewportWidth) / worldWidth) * 100;
        expect(create).toBeGreaterThan(riderStartPct);
        expect(stories[0]).toBeGreaterThan(create);
        for (let i = 1; i < count; i++) expect(stories[i]).toBeGreaterThan(stories[i - 1]);
        // The newest story ends the trail, where the rider can still reach it.
        expect(stories.at(-1)).toBeCloseTo(86);
        const p = riderProgressAt((worldWidth * stories.at(-1)) / 100, worldWidth, viewportWidth);
        expect(p).toBeGreaterThan(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    });
  }

  it("without the create post, stories start at the first slot", () => {
    expect(layout(3, 1440, false).stories).toEqual([14, 50, 86]);
  });

  it("gives every story at least 340px of trail, and never less than a screen", () => {
    expect(worldWidthFor(0.6, 1440)).toBe(1440);
    expect(worldWidthFor(10, 375)).toBe(3400);
    expect(worldWidthFor(10, 1440)).toBe(6480);
  });

  it("maps rider progress to world x and back", () => {
    const w = worldWidthFor(8, 1000);
    for (const p of [0, 0.25, 1]) expect(riderProgressAt(riderWorldX(p, w, 1000), w, 1000)).toBeCloseTo(p);
    expect(riderProgressAt(-50, w, 1000)).toBe(0);
    expect(riderProgressAt(w + 50, w, 1000)).toBe(1);
  });
});
