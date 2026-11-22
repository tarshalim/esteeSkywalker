import { describe, expect, it } from "vitest";
import {
  coordinateStatus,
  editMediaMeta,
  mediaSourceOf,
  mediaTypeOf,
  metaFromExtraction,
  parseCoordinate,
  readMediaMeta,
  withMediaMeta,
} from "./mediaMeta";
import { createImageElement, createPolaroidElement, createVideoElement, createTextElement, dockPatch, dockPayload } from "./canvasElements";

const EXTRACTED = {
  dateTaken: "2023-06-12",
  timeTaken: "23:41",
  dateSource: "exif",
  lat: 35.0116,
  lng: 135.7681,
  camera: "FUJIFILM X100V",
  width: 4032,
  height: 3024,
  fileSize: 3_200_000,
};

describe("mediaSourceOf / mediaTypeOf", () => {
  it("finds the media field of each kind", () => {
    expect(mediaSourceOf(createImageElement({ src: "a.jpg" }))).toBe("a.jpg");
    expect(mediaSourceOf(createVideoElement({ url: "b.mp4" }))).toBe("b.mp4");
    expect(mediaSourceOf(createPolaroidElement({ mediaSrc: "c.mov", mediaType: "video" }))).toBe("c.mov");
    expect(mediaTypeOf(createPolaroidElement({ mediaSrc: "c.mov", mediaType: "video" }))).toBe("video");
    expect(mediaSourceOf(createTextElement())).toBe("");
    expect(mediaTypeOf(createImageElement())).toBeNull();
  });
});

describe("metaFromExtraction", () => {
  it("keeps GPS, date and camera, marking the location as read from the file", () => {
    expect(metaFromExtraction(EXTRACTED, "image")).toEqual({
      mediaType: "image",
      lat: 35.0116,
      lng: 135.7681,
      locationSource: "exif",
      locationTitle: "",
      dateTaken: "2023-06-12",
      timeTaken: "23:41",
      dateSource: "exif",
      camera: "FUJIFILM X100V",
      width: 4032,
      height: 3024,
      fileSize: 3_200_000,
    });
  });

  it("has no location without both coordinates", () => {
    const meta = metaFromExtraction({ ...EXTRACTED, lng: null }, "video");
    expect(meta).toMatchObject({ lat: null, lng: null, locationSource: null });
    expect(coordinateStatus(meta)).toBe("missing");
  });
});

describe("withMediaMeta / readMediaMeta", () => {
  const meta = metaFromExtraction(EXTRACTED, "image");
  const metas = new Map([["https://cdn/x.jpg", meta]]);

  it("attaches metadata to the field that got the uploaded URL", () => {
    expect(withMediaMeta({ src: "https://cdn/x.jpg" }, metas)).toEqual({ src: "https://cdn/x.jpg", mediaMeta: { ...meta, src: "https://cdn/x.jpg" } });
    expect(withMediaMeta({ mediaSrc: "https://cdn/x.jpg", mediaType: "image" }, metas).mediaMeta.src).toBe("https://cdn/x.jpg");
  });

  it("wraps function patches and leaves unrelated patches alone", () => {
    const fn = withMediaMeta(() => ({ imageSrc: "https://cdn/x.jpg" }), metas);
    expect(fn({}).mediaMeta.lat).toBe(35.0116);
    expect(withMediaMeta({ collage: {} }, metas)).toEqual({ collage: {} });
    const same = { src: "y" };
    expect(withMediaMeta(same, new Map())).toBe(same);
  });

  it("only reads metadata that describes the media shown now", () => {
    const el = createImageElement({ src: "https://cdn/x.jpg", mediaMeta: { ...meta, src: "https://cdn/x.jpg" } });
    expect(readMediaMeta(el)).toMatchObject({ lat: 35.0116 });
    expect(readMediaMeta({ ...el, src: "https://cdn/other.jpg" })).toBeNull();
    expect(readMediaMeta({ ...el, src: "" })).toBeNull();
  });

  it("travels with a photo docked into a polaroid", () => {
    const photo = createImageElement({ src: "https://cdn/x.jpg", mediaMeta: { ...meta, src: "https://cdn/x.jpg" } });
    const polaroid = createPolaroidElement();
    const patch = dockPatch(polaroid, dockPayload(photo));
    expect(readMediaMeta({ ...polaroid, ...patch })).toMatchObject({ lat: 35.0116 });
    // Stale metadata (for an earlier photo) is left behind.
    const stale = { ...photo, mediaMeta: { ...meta, src: "https://cdn/old.jpg" } };
    expect(dockPatch(polaroid, dockPayload(stale)).mediaMeta).toBeUndefined();
  });
});

describe("parseCoordinate", () => {
  it("parses signed and hemisphere forms", () => {
    expect(parseCoordinate("35.6895", "lat")).toEqual({ value: 35.6895 });
    expect(parseCoordinate(" -139.7 ", "lng")).toEqual({ value: -139.7 });
    expect(parseCoordinate("33.86 S", "lat")).toEqual({ value: -33.86 });
    expect(parseCoordinate("74.006°W", "lng")).toEqual({ value: -74.006 });
    expect(parseCoordinate("", "lat")).toEqual({ value: null });
  });

  it("rejects bad input with a message", () => {
    expect(parseCoordinate("91", "lat").error).toMatch(/between -90 and 90/);
    expect(parseCoordinate("181", "lng").error).toMatch(/between -180 and 180/);
    expect(parseCoordinate("12 E", "lat").error).toMatch(/N or S/);
    expect(parseCoordinate("Kyoto", "lng").error).toMatch(/must be a number/);
  });
});

describe("editMediaMeta", () => {
  const media = { src: "https://cdn/x.jpg", mediaType: "image" };
  const meta = { ...metaFromExtraction(EXTRACTED, "image"), src: media.src };
  const form = (over = {}) => ({ locationTitle: "", lat: "35.0116", lng: "135.7681", dateTaken: "2023-06-12", timeTaken: "23:41", ...over });

  it("keeps sources for untouched fields and only updates the title", () => {
    const { meta: next } = editMediaMeta(meta, media, form({ locationTitle: "  Fushimi Inari " }));
    expect(next).toMatchObject({ locationTitle: "Fushimi Inari", locationSource: "exif", dateSource: "exif", camera: "FUJIFILM X100V" });
  });

  it("marks moved coordinates and a changed date as manual", () => {
    const { meta: next } = editMediaMeta(meta, media, form({ lat: "34.9671", lng: "135.7727", timeTaken: "09:00" }));
    expect(next).toMatchObject({ lat: 34.9671, lng: 135.7727, locationSource: "manual", timeTaken: "09:00", dateSource: "manual" });
    expect(coordinateStatus(next)).toBe("manual");
  });

  it("clears the location", () => {
    const { meta: next } = editMediaMeta(meta, media, form({ lat: "", lng: "" }));
    expect(next).toMatchObject({ lat: null, lng: null, locationSource: null });
    expect(coordinateStatus(next)).toBe("missing");
  });

  it("adds metadata to media that had none", () => {
    const { meta: next } = editMediaMeta(null, media, form({ dateTaken: "2024-01-02", timeTaken: "" }));
    expect(next).toMatchObject({ src: media.src, mediaType: "image", locationSource: "manual", dateTaken: "2024-01-02", timeTaken: null, dateSource: "manual" });
  });

  it("refuses half a coordinate, bad numbers, or a time without a date", () => {
    expect(editMediaMeta(meta, media, form({ lng: "" })).error).toMatch(/both latitude and longitude/);
    expect(editMediaMeta(meta, media, form({ lat: "100" })).error).toMatch(/Latitude/);
    expect(editMediaMeta(meta, media, form({ dateTaken: "" })).error).toMatch(/date/);
  });
});
