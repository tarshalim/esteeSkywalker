import { describe, expect, it } from "vitest";
import { layerPosition, paintOrder, reorderWithinGroup } from "./canvasGroups";

const el = (id, zIndex, attachedTo = null) => ({ id, kind: "text", x: 0, y: 0, width: 10, height: 10, rotation: 0, zIndex, attachedTo });
const order = (elements) => paintOrder(elements).map((e) => e.id);

// a < b < c at the top level; host carries x < y.
const page = () => [el("a", 1), el("b", 2), el("host", 3), el("x", 4, "host"), el("y", 5, "host"), el("c", 6)];

describe("reorderWithinGroup", () => {
  it("brings forward and sends backward one step", () => {
    expect(order(reorderWithinGroup(page(), "a", "up"))).toEqual(["b", "a", "host", "x", "y", "c"]);
    expect(order(reorderWithinGroup(page(), "c", "down"))).toEqual(["a", "b", "c", "host", "x", "y"]);
  });

  it("brings to front and sends to back", () => {
    expect(order(reorderWithinGroup(page(), "a", "front"))).toEqual(["b", "host", "x", "y", "c", "a"]);
    expect(order(reorderWithinGroup(page(), "c", "back"))).toEqual(["c", "a", "b", "host", "x", "y"]);
  });

  it("keeps overlays above their host", () => {
    expect(order(reorderWithinGroup(page(), "y", "back"))).toEqual(["a", "b", "host", "y", "x", "c"]);
    expect(order(reorderWithinGroup(page(), "host", "front"))).toEqual(["a", "b", "c", "host", "x", "y"]);
  });

  it("returns the same array when nothing moves", () => {
    const els = page();
    expect(reorderWithinGroup(els, "c", "front")).toBe(els);
    expect(reorderWithinGroup(els, "a", "down")).toBe(els);
    expect(reorderWithinGroup(els, "missing", "up")).toBe(els);
  });

  it("only rewrites the zIndex of siblings, as integers", () => {
    const els = page();
    const next = reorderWithinGroup(els, "a", "front");
    expect(next.find((e) => e.id === "x")).toBe(els.find((e) => e.id === "x"));
    next.forEach((e) => expect(Number.isInteger(e.zIndex)).toBe(true));
  });

  it("separates siblings that share a zIndex", () => {
    const els = [el("a", 1), el("b", 1), el("c", 1)];
    expect(order(reorderWithinGroup(els, "a", "front")).at(-1)).toBe("a");
  });
});

describe("layerPosition", () => {
  it("reports whether an element can move up or down in its group", () => {
    expect(layerPosition(page(), "a")).toEqual({ canRaise: true, canLower: false });
    expect(layerPosition(page(), "c")).toEqual({ canRaise: false, canLower: true });
    expect(layerPosition(page(), "y")).toEqual({ canRaise: false, canLower: true });
  });
});
