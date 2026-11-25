import { describe, expect, it } from "vitest";
import { formatBytes, normalizeUsage, quota } from "./storageUsage";

describe("formatBytes", () => {
  it("formats across units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1.5 * 1024 ** 2)).toBe("1.5 MB");
    expect(formatBytes(1024 ** 3)).toBe("1 GB");
    expect(formatBytes(250 * 1024 ** 2)).toBe("250 MB");
  });

  it("treats junk as zero", () => {
    expect(formatBytes(undefined)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
  });
});

describe("quota", () => {
  it("reports remaining and percent, going negative when over", () => {
    expect(quota(250, 1000)).toEqual({ used: 250, limit: 1000, remaining: 750, pct: 25 });
    expect(quota(1200, 1000).remaining).toBe(-200);
    expect(quota(1200, 1000).pct).toBe(120);
  });
});

describe("normalizeUsage", () => {
  it("maps the RPC payload to camelCase with numeric sizes", () => {
    const usage = normalizeUsage({
      computed_at: "2026-11-25T00:00:00Z",
      database_bytes: "1000",
      storage_bytes: 500,
      buckets: [{ bucket: "media", files: 2, bytes: 500 }],
      blogs: [{ id: "a", title: "", status: "draft", files: 1, media_bytes: 300, row_bytes: "20" }],
    });
    expect(usage.databaseBytes).toBe(1000);
    expect(usage.blogs[0]).toMatchObject({ title: "Untitled Blog Post", mediaBytes: 300, rowBytes: 20, totalBytes: 320 });
    expect(normalizeUsage(null).blogs).toEqual([]);
  });
});
