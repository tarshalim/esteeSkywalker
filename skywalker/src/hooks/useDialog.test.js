import { describe, expect, it } from "vitest";
import { trapTarget } from "./useDialog";

describe("trapTarget", () => {
  const items = ["first", "middle", "last"];

  it("wraps Tab from the last control to the first", () => {
    expect(trapTarget(items, 2, false)).toBe("first");
  });

  it("wraps Shift+Tab from the first control to the last", () => {
    expect(trapTarget(items, 0, true)).toBe("last");
  });

  it("lets the browser move focus between inner controls", () => {
    expect(trapTarget(items, 0, false)).toBeNull();
    expect(trapTarget(items, 1, false)).toBeNull();
    expect(trapTarget(items, 1, true)).toBeNull();
    expect(trapTarget(items, 2, true)).toBeNull();
  });

  it("pulls focus back in from outside the dialog", () => {
    expect(trapTarget(items, -1, false)).toBe("first");
    expect(trapTarget(items, -1, true)).toBe("last");
  });

  it("keeps a single control focused both ways", () => {
    expect(trapTarget(["only"], 0, false)).toBe("only");
    expect(trapTarget(["only"], 0, true)).toBe("only");
  });

  it("returns null when nothing can take focus", () => {
    expect(trapTarget([], -1, false)).toBeNull();
  });
});
