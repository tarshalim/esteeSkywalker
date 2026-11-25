import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALL_STEPS, MARGIN, PAD, placePopover, stepLabels, tourStepsFor } from "./tourSteps";

const SRC = fileURLToPath(new URL("../../", import.meta.url));

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.jsx?$/.test(name) && !/\.test\.js$|tourSteps\.js$/.test(name) ? [path] : [];
  });
}

// Every `data-tour="x"` in the app, plus TopNav's `<NavPill tour="x">`.
const tourIds = new Set(
  sourceFiles(SRC).flatMap((f) => [...readFileSync(f, "utf8").matchAll(/\b(?:data-tour|tour)="([\w-]+)"/g)].map((m) => m[1]))
);
const idOf = (selector) => selector.match(/^\[data-tour="([\w-]+)"\]$/)?.[1];

describe("tour steps", () => {
  it("each step has at least one target that exists in the app", () => {
    for (const step of ALL_STEPS) {
      const ids = step.targets.map(idOf);
      expect(ids.every(Boolean), step.title).toBe(true);
      expect(ids.some((id) => tourIds.has(id)), step.title).toBe(true);
      if (step.scrollTo) expect(tourIds.has(idOf(step.scrollTo)), step.title).toBe(true);
    }
  });

  it("each step's route is a real route", () => {
    const app = readFileSync(join(SRC, "App.jsx"), "utf8");
    const paths = new Set([...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]));
    for (const step of ALL_STEPS) expect(paths.has(step.route), step.title).toBe(true);
  });

  it("pin preview steps show and hide the naming dialog", () => {
    for (const step of ALL_STEPS.filter((s) => s.onEnter && s.group === "pin")) expect(step.onExit).toBeTypeOf("function");
  });

  it("viewers get only the read-only steps, ending on the globe", () => {
    const steps = tourStepsFor(false);
    expect(steps.some((s) => s.requiresEdit)).toBe(false);
    expect(steps.map((s) => s.title)).toEqual([
      "Welcome to Your Journey",
      "Explore Your Journey",
      "Search Anywhere",
      "Browse Your Gallery",
      "Your Trips",
      "Explore the Globe",
    ]);
    expect(stepLabels(steps)).toEqual({ total: 6, labels: ["1", "2", "3", "4", "5", "6"] });
  });

  it("editors get every step, with the editor and pin steps lettered", () => {
    const steps = tourStepsFor(true);
    expect(steps).toEqual(ALL_STEPS);
    const { total, labels } = stepLabels(steps);
    expect(total).toBe(12);
    expect(labels).toEqual(["1", "2", "3a", "3b", "3c", "3d", "3e", "4", "5", "6", "7", "8", "9", "10", "11", "12a", "12b"]);
  });

  it("a group of one keeps its plain number", () => {
    expect(stepLabels([{}, { group: "g" }, {}]).labels).toEqual(["1", "2", "3"]);
  });
});

describe("placePopover", () => {
  const vw = 1000;
  const vh = 800;
  const w = 280;
  const h = 200;

  it("centres the card with no target", () => {
    expect(placePopover(null, w, h, vw, vh)).toEqual({ left: 360, top: 300 });
  });

  it("goes below the target when it fits", () => {
    const rect = { top: 100, left: 400, width: 200, height: 50 };
    expect(placePopover(rect, w, h, vw, vh)).toEqual({ left: 360, top: 100 + 50 + PAD + 14 });
  });

  it("goes above when there's no room below", () => {
    const rect = { top: 500, left: 400, width: 200, height: 200 };
    expect(placePopover(rect, w, h, vw, vh).top).toBe(500 - PAD - 14 - h);
  });

  it("goes beside a tall target", () => {
    const rect = { top: 50, left: 600, width: 200, height: 700 };
    expect(placePopover(rect, w, h, vw, vh).left).toBe(600 - PAD - 14 - w);
  });

  it("floats inside a target that fills the screen, on screen", () => {
    const rect = { top: 0, left: 0, width: vw, height: vh };
    const pos = placePopover(rect, w, h, vw, vh);
    expect(pos.top).toBeGreaterThanOrEqual(MARGIN);
    expect(pos.top + h).toBeLessThanOrEqual(vh - MARGIN);
    expect(pos.left).toBeGreaterThanOrEqual(MARGIN);
    expect(pos.left + w).toBeLessThanOrEqual(vw - MARGIN);
  });

  it("keeps the card inside the margins near an edge", () => {
    const rect = { top: 100, left: 0, width: 20, height: 20 };
    expect(placePopover(rect, w, h, vw, vh).left).toBe(MARGIN);
  });
});
