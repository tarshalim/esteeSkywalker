import { describe, expect, it } from "vitest";
import {
  THEME_STORAGE_KEY,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
} from "./themePref";

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

describe("readStoredTheme", () => {
  it("returns a saved light or dark choice", () => {
    expect(readStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: "dark" }))).toBe("dark");
    expect(readStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: "light" }))).toBe("light");
  });

  it("ignores missing or unknown values", () => {
    expect(readStoredTheme(memoryStorage())).toBeNull();
    expect(readStoredTheme(memoryStorage({ [THEME_STORAGE_KEY]: "sepia" }))).toBeNull();
  });

  it("returns null when storage is blocked or absent", () => {
    expect(readStoredTheme(blocked)).toBeNull();
    expect(readStoredTheme(null)).toBeNull();
  });
});

describe("writeStoredTheme", () => {
  it("saves a valid theme", () => {
    const s = memoryStorage();
    expect(writeStoredTheme(s, "dark")).toBe(true);
    expect(s.map.get(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("refuses unknown values and survives blocked or absent storage", () => {
    const s = memoryStorage();
    expect(writeStoredTheme(s, "sepia")).toBe(false);
    expect(s.map.size).toBe(0);
    expect(writeStoredTheme(blocked, "dark")).toBe(false);
    expect(writeStoredTheme(null, "dark")).toBe(false);
  });
});

describe("resolveTheme", () => {
  it("lets a stored choice beat the OS", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the OS without a choice", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });
});
