import { describe, expect, it } from "vitest";
import { extractVideoMetadata, parseIso6709, parseVideoContainer, parseVideoDate } from "./videoMeta";

// --- tiny MP4 box builder -------------------------------------------------

const enc = new TextEncoder();
const bytes = (...parts) => {
  const arrays = parts.map((p) => (typeof p === "string" ? enc.encode(p) : p instanceof Uint8Array ? p : new Uint8Array(p)));
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
};
const u32 = (n) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
};
const u16 = (n) => [n >> 8, n & 0xff];
const fourcc = (type) => (type.startsWith("©") ? bytes([0xa9], type.slice(1)) : enc.encode(type));
const box = (type, ...payload) => {
  const body = bytes(...payload);
  return bytes(u32(body.length + 8), fourcc(type), body);
};
const indexedBox = (index, ...payload) => {
  const body = bytes(...payload);
  return bytes(u32(body.length + 8), u32(index), body);
};
const udtaString = (type, value) => box(type, u16(enc.encode(value).length), u16(0x15c7), value);
const mvhd = (secsSince1904) => box("mvhd", [0, 0, 0, 0], u32(secsSince1904), u32(secsSince1904), new Uint8Array(88));
const appleMeta = (entries) =>
  box(
    "meta",
    box("hdlr", new Uint8Array(24)),
    box("keys", [0, 0, 0, 0], u32(entries.length), ...entries.map(([key]) => bytes(u32(enc.encode(key).length + 8), "mdta", key))),
    box("ilst", ...entries.map(([, value], i) => indexedBox(i + 1, box("data", u32(1), u32(0), value))))
  );

const reader = (file) => async (offset, length) => {
  const slice = file.slice(offset, offset + length);
  return new DataView(slice.buffer, slice.byteOffset, slice.byteLength);
};
const parse = (file) => parseVideoContainer(reader(file), file.length);

const ftyp = box("ftyp", "qt  ", u32(0), "qt  ");
const mdat = box("mdat", new Uint8Array(4096));
const secsFor = (iso) => Math.round((Date.parse(iso) - Date.UTC(1904, 0, 1)) / 1000);

// --------------------------------------------------------------------------

describe("parseIso6709", () => {
  it("reads decimal degrees, with or without altitude", () => {
    expect(parseIso6709("+35.6895+139.6917+040.123/")).toEqual({ lat: 35.6895, lng: 139.6917 });
    expect(parseIso6709("-33.8688+151.2093/")).toEqual({ lat: -33.8688, lng: 151.2093 });
    expect(parseIso6709("+47.3769+008.5417/")).toEqual({ lat: 47.3769, lng: 8.5417 });
    expect(parseIso6709("+40.7128-074.0060/")).toEqual({ lat: 40.7128, lng: -74.006 });
  });

  it("reads degrees-minutes and degrees-minutes-seconds forms", () => {
    const dm = parseIso6709("+3541.37+13941.50/");
    expect(dm.lat).toBeCloseTo(35 + 41.37 / 60, 6);
    expect(dm.lng).toBeCloseTo(139 + 41.5 / 60, 6);
    const dms = parseIso6709("-334212+1511233/");
    expect(dms.lat).toBeCloseTo(-(33 + 42 / 60 + 12 / 3600), 6);
    expect(dms.lng).toBeCloseTo(151 + 12 / 60 + 33 / 3600, 6);
  });

  it("rejects no-fix, out-of-range and junk values", () => {
    expect(parseIso6709("+00.0000+000.0000/")).toBeNull();
    expect(parseIso6709("+95.0+010.0/")).toBeNull();
    expect(parseIso6709("Tokyo")).toBeNull();
    expect(parseIso6709("")).toBeNull();
    expect(parseIso6709(null)).toBeNull();
  });
});

describe("parseVideoDate", () => {
  it("keeps the wall-clock time of a date with an offset", () => {
    expect(parseVideoDate("2023-06-12T23:41:05+0900")).toEqual({ dateTaken: "2023-06-12", timeTaken: "23:41" });
    expect(parseVideoDate("2023-06-12T08:03:22-07:00")).toEqual({ dateTaken: "2023-06-12", timeTaken: "08:03" });
  });

  it("returns a date-only value without a time", () => {
    expect(parseVideoDate("2021-03-04")).toEqual({ dateTaken: "2021-03-04", timeTaken: null });
  });

  it("ignores junk", () => {
    expect(parseVideoDate("not a date")).toBeNull();
    expect(parseVideoDate("")).toBeNull();
  });
});

describe("parseVideoContainer", () => {
  it("reads an iPhone clip's location, local capture time and camera from moov/meta", async () => {
    const file = bytes(
      ftyp,
      mdat, // iPhones write moov after the media data
      box(
        "moov",
        mvhd(secsFor("2023-06-12T14:41:05Z")),
        appleMeta([
          ["com.apple.quicktime.location.ISO6709", "+35.0116+135.7681+045.000/"],
          ["com.apple.quicktime.creationdate", "2023-06-12T23:41:05+0900"],
          ["com.apple.quicktime.make", "Apple"],
          ["com.apple.quicktime.model", "iPhone 15 Pro"],
        ])
      )
    );
    expect(await parse(file)).toEqual({
      dateTaken: "2023-06-12",
      timeTaken: "23:41",
      lat: 35.0116,
      lng: 135.7681,
      camera: "Apple iPhone 15 Pro",
    });
  });

  it("reads an Android clip's ©xyz location and falls back to mvhd's UTC creation time", async () => {
    const created = "2022-08-01T10:15:00Z";
    const file = bytes(ftyp, box("moov", mvhd(secsFor(created)), box("udta", udtaString("©xyz", "+48.8584+002.2945/"))), mdat);
    const result = await parse(file);
    expect(result).toMatchObject({ lat: 48.8584, lng: 2.2945, camera: null });
    const local = new Date(created);
    const pad = (n) => String(n).padStart(2, "0");
    expect(result.dateTaken).toBe(`${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`);
    expect(result.timeTaken).toBe(`${pad(local.getHours())}:${pad(local.getMinutes())}`);
  });

  it("reads make/model from udta strings", async () => {
    const file = bytes(ftyp, box("moov", mvhd(0), box("udta", udtaString("©mak", "samsung"), udtaString("©mod", "SM-S918B"))));
    expect(await parse(file)).toMatchObject({ camera: "samsung SM-S918B", dateTaken: null, lat: null });
  });

  it("handles 64-bit box sizes before moov", async () => {
    const big = bytes(u32(1), "mdat", [0, 0, 0, 0], u32(16 + 32), new Uint8Array(32));
    const file = bytes(ftyp, big, box("moov", box("udta", udtaString("©xyz", "-22.9519-043.2105/"))));
    expect(await parse(file)).toMatchObject({ lat: -22.9519, lng: -43.2105 });
  });

  it("comes back empty for a file without moov or with broken boxes", async () => {
    const empty = { dateTaken: null, timeTaken: null, lat: null, lng: null, camera: null };
    expect(await parse(bytes(ftyp, mdat))).toEqual(empty);
    expect(await parse(bytes(u32(3), "junk", new Uint8Array(20)))).toEqual(empty);
    expect(await parse(new Uint8Array(0))).toEqual(empty);
  });
});

describe("extractVideoMetadata", () => {
  it("reads a Blob", async () => {
    const file = new Blob([bytes(ftyp, box("moov", box("udta", udtaString("©xyz", "+51.5007-000.1246/"))))]);
    expect(await extractVideoMetadata(file)).toMatchObject({ lat: 51.5007, lng: -0.1246 });
  });

  it("never throws", async () => {
    expect(await extractVideoMetadata({ size: 100, slice: () => ({ arrayBuffer: () => Promise.reject(new Error("nope")) }) })).toMatchObject({
      lat: null,
    });
  });
});
