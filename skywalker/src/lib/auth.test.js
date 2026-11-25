import { describe, expect, it } from "vitest";
import { accountDisplayName } from "./auth";

// Must match `stamp_blog_author`: coalesce(nullif(btrim(display_name), ''), username).
describe("accountDisplayName", () => {
  it("prefers the trimmed display name", () => {
    expect(accountDisplayName({ user_metadata: { display_name: "  Estee  " } }, "estee_w")).toBe("Estee");
  });

  it("falls back to the username when the display name is blank or missing", () => {
    expect(accountDisplayName({ user_metadata: { display_name: "   " } }, "estee_w")).toBe("estee_w");
    expect(accountDisplayName({ user_metadata: {} }, "estee_w")).toBe("estee_w");
    expect(accountDisplayName({}, "estee_w")).toBe("estee_w");
  });

  it("is null with no account (mock mode, signed out)", () => {
    expect(accountDisplayName(null, null)).toBeNull();
    expect(accountDisplayName({ user_metadata: { display_name: "" } }, null)).toBeNull();
  });
});
