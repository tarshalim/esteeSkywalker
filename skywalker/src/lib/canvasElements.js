// Schema + factories for the freeform scrapbook canvas. Mirrors the spirit of
// lib/blocks.js (shared shape, single source of truth for defaults) but for
// absolutely-positioned canvas elements instead of document-flow blocks.

import { createCollage, naturalHeight } from "./collage";

let counter = 0;
export function makeElementId() {
  counter += 1;
  return `el_${Date.now().toString(36)}_${counter}`;
}

export const ELEMENT_KIND = {
  TEXT: "text",
  IMAGE: "image",
  VIDEO: "video",
  STICKER: "sticker",
  FRAME_STICKER: "frameSticker",
  AUDIO: "audio",
  NOTE: "note", // sticky notes, shaped notes, lined strips, notepad sheets — writeable containers
  POLAROID: "polaroid",
  VIEWFINDER: "viewfinder", // retro camcorder frame / play-button card around a video
  DECOR: "decor", // washi tape, stamps, seals, clips, pins, location badges
  COLLAGE: "collage", // multi-photo grid/masonry; layout + items live in `collage` (lib/collage.js)
};

export const DEFAULT_CANVAS_SIZE = { width: 794, height: 1123 }; // A4 @ 96dpi

export const DEFAULT_SIZES = {
  [ELEMENT_KIND.TEXT]: { width: 300, height: 90 },
  [ELEMENT_KIND.IMAGE]: { width: 320, height: 220 },
  [ELEMENT_KIND.VIDEO]: { width: 360, height: 202 },
  [ELEMENT_KIND.STICKER]: { width: 96, height: 96 },
  [ELEMENT_KIND.FRAME_STICKER]: { width: 220, height: 260 },
  [ELEMENT_KIND.AUDIO]: { width: 340, height: 120 },
  [ELEMENT_KIND.POLAROID]: { width: 230, height: 280 },
  [ELEMENT_KIND.COLLAGE]: { width: 520, height: 322 },
};

export const PASTELS = ["#fef08a", "#fbcfe8", "#bfdbfe", "#bbf7d0", "#fed7aa", "#ddd6fe", "#fecaca", "#ffffff"];
export const INK_COLORS = ["#1e293b", "#475569", "#1d4ed8", "#b91c1c", "#15803d", "#7c3aed", "#92400e", "#ffffff"];
// Label pills behind text boxes (text.highlight); null means no pill.
export const HIGHLIGHT_COLORS = ["#ffffff", "#fbf5e6", "#fef08a", "#fbcfe8", "#bfdbfe", "#bbf7d0", "#1e293b", "#b91c1c"];
export const FONT_WEIGHTS = [
  { value: 300, label: "Light" },
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "Black" },
];
export const ACCENT_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#b45309", "#334155"];

export const DEFAULT_THEME = {
  paper: { style: "clean", color: "#ffffff" },
  palette: ["#3b82f6", "#facc15", "#3ddc97", "#f472b6", "#1e40af", "#fdfdfd"],
};

/** Shared typography fields for every element that carries editable text. */
export const DEFAULT_TEXT_STYLE = {
  fontFamily: "sans",
  fontSize: 18,
  color: "#1e293b",
  align: "left",
  fontWeight: 400,
  fontStyle: "normal",
};

function base(kind, overrides) {
  return {
    id: makeElementId(),
    kind,
    x: 80,
    y: 80,
    width: 240,
    height: 120,
    rotation: 0,
    zIndex: 1,
    locked: false,
    ...overrides,
  };
}

export function createTextElement(pos = {}) {
  return base(ELEMENT_KIND.TEXT, {
    ...DEFAULT_SIZES[ELEMENT_KIND.TEXT],
    ...DEFAULT_TEXT_STYLE,
    html: "",
    ...pos,
  });
}

/** A caption overlay for a collage: a bold label pill centred on it and attached to it. */
export function createCollageTextElement(collage) {
  const width = Math.min(320, Math.max(160, collage.width - 40));
  const height = 72;
  return createTextElement({
    width,
    height,
    x: Math.round(collage.x + collage.width / 2 - width / 2),
    y: Math.round(collage.y + collage.height / 2 - height / 2),
    rotation: collage.rotation,
    fontFamily: "hand",
    fontSize: 34,
    fontWeight: 700,
    align: "center",
    color: "#1e293b",
    highlight: "#ffffff",
    attachedTo: collage.id,
  });
}

export function createImageElement(pos = {}) {
  return base(ELEMENT_KIND.IMAGE, {
    ...DEFAULT_SIZES[ELEMENT_KIND.IMAGE],
    src: "",
    fit: "cover",
    radius: 12,
    ...pos,
  });
}

export function createVideoElement(pos = {}) {
  return base(ELEMENT_KIND.VIDEO, {
    ...DEFAULT_SIZES[ELEMENT_KIND.VIDEO],
    url: "",
    ...pos,
  });
}

export function createStickerElement(stickerId, category, extra = {}, pos = {}) {
  return base(ELEMENT_KIND.STICKER, {
    ...DEFAULT_SIZES[ELEMENT_KIND.STICKER],
    stickerId,
    category,
    dropShadow: false,
    ...extra,
    ...pos,
  });
}

/**
 * An illustrated scrapbook piece (data/scrapbookArt.js), sized from its art:
 * tape strips come in wide, backdrops large, everything else sticker-sized.
 * `tone` and `hue` drive its CSS-filter recolor.
 */
export function createArtStickerElement(art, pos = {}) {
  const aspect = art.width / art.height;
  const longSide = art.width >= 1000 || art.height >= 1000 ? 520 : aspect > 2.5 ? 220 : 170;
  const scale = longSide / Math.max(art.width, art.height);
  return createStickerElement(
    art.id,
    "art",
    { tone: "original", hue: 0 },
    { width: Math.round(art.width * scale), height: Math.round(art.height * scale), ...pos }
  );
}

export function createFrameStickerElement(frameId, pos = {}) {
  return base(ELEMENT_KIND.FRAME_STICKER, {
    ...DEFAULT_SIZES[ELEMENT_KIND.FRAME_STICKER],
    frameId,
    imageSrc: "",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    ...pos,
  });
}

export function createAudioElement(widgetStyle = "card", pos = {}) {
  return base(ELEMENT_KIND.AUDIO, {
    ...(widgetStyle === "card" ? DEFAULT_SIZES[ELEMENT_KIND.AUDIO] : { width: 280, height: 96 }),
    sourceType: "",
    src: "",
    title: "",
    artist: "",
    coverSrc: "",
    widgetStyle,
    volume: 0.8,
    muted: false,
    autoplayOnScroll: false,
    // Optional segment (see lib/mediaTrim.js); null plays the whole track.
    startSec: null,
    endSec: null,
    loop: false,
    accentColor: "#3b82f6",
    ...pos,
  });
}

// --- Notes & memos -------------------------------------------------------

export const NOTE_VARIANTS = {
  sticky: { label: "Sticky note", width: 210, height: 210, paperColor: "#fef08a", align: "left", fontSize: 24 },
  heart: { label: "Heart note", width: 240, height: 216, paperColor: "#fbcfe8", align: "center", fontSize: 22 },
  star: { label: "Star note", width: 250, height: 240, paperColor: "#fde68a", align: "center", fontSize: 20 },
  lined: { label: "Torn lined strip", width: 320, height: 150, paperColor: "#fffdf5", align: "left", fontSize: 22 },
  spiral: { label: "Notepad sheet", width: 240, height: 300, paperColor: "#ffffff", align: "left", fontSize: 22 },
};

export function createNoteElement(variant = "sticky", pos = {}) {
  const v = NOTE_VARIANTS[variant] ?? NOTE_VARIANTS.sticky;
  return base(ELEMENT_KIND.NOTE, {
    width: v.width,
    height: v.height,
    variant,
    paperColor: v.paperColor,
    tape: variant === "sticky",
    tapeColor: "#93c5fd",
    mediaSrc: "",
    mediaType: "",
    html: "",
    ...DEFAULT_TEXT_STYLE,
    fontFamily: "hand",
    fontSize: v.fontSize,
    align: v.align,
    color: "#334155",
    ...pos,
  });
}

// --- Media frames --------------------------------------------------------

export function createPolaroidElement(pos = {}) {
  return base(ELEMENT_KIND.POLAROID, {
    ...DEFAULT_SIZES[ELEMENT_KIND.POLAROID],
    mediaSrc: "",
    mediaType: "",
    html: "",
    ...DEFAULT_TEXT_STYLE,
    fontFamily: "hand",
    fontSize: 22,
    align: "center",
    color: "#334155",
    ...pos,
  });
}

export const VIEWFINDER_VARIANTS = {
  viewfinder: { label: "Camcorder viewfinder", width: 360, height: 250 },
  playcard: { label: "Play-button card", width: 300, height: 230 },
};

export function createViewfinderElement(variant = "viewfinder", pos = {}) {
  const v = VIEWFINDER_VARIANTS[variant] ?? VIEWFINDER_VARIANTS.viewfinder;
  return base(ELEMENT_KIND.VIEWFINDER, {
    width: v.width,
    height: v.height,
    variant,
    url: "",
    html: "",
    ...DEFAULT_TEXT_STYLE,
    fontFamily: variant === "viewfinder" ? "mono" : "marker",
    fontSize: variant === "viewfinder" ? 13 : 20,
    color: variant === "viewfinder" ? "#ffffff" : "#334155",
    align: variant === "viewfinder" ? "left" : "center",
    ...pos,
  });
}

/** A collage laid out as `template`, its slots open for photos and its height fitted to them. */
export function createCollageElement(pos = {}, { template } = {}) {
  const collage = createCollage(template);
  const { width } = DEFAULT_SIZES[ELEMENT_KIND.COLLAGE];
  return base(ELEMENT_KIND.COLLAGE, {
    width,
    height: naturalHeight(collage, width),
    collage,
    ...pos,
  });
}

// --- Decorative accents --------------------------------------------------

export const DECOR_VARIANTS = {
  "washi-stripe": { label: "Striped washi", width: 200, height: 38, tint: "#f9a8d4" },
  "washi-dots": { label: "Dotted washi", width: 200, height: 38, tint: "#93c5fd" },
  "washi-grid": { label: "Gingham washi", width: 200, height: 38, tint: "#86efac" },
  "washi-plain": { label: "Kraft tape", width: 180, height: 36, tint: "#d6b98c" },
  "stamp-postage": { label: "Postage stamp", width: 130, height: 160, tint: "#2563eb", text: true, html: "Wish you were here" },
  "stamp-seal": { label: "Wax seal", width: 110, height: 110, tint: "#b91c1c", text: true, html: "S" },
  paperclip: { label: "Paperclip", width: 44, height: 110, tint: "#94a3b8" },
  pushpin: { label: "Push pin", width: 54, height: 60, tint: "#ef4444" },
  "badge-location": { label: "Location badge", width: 230, height: 54, tint: "#2563eb", text: true, html: "Somewhere lovely" },
};

export function createDecorElement(decorId, pos = {}) {
  const v = DECOR_VARIANTS[decorId] ?? DECOR_VARIANTS["washi-stripe"];
  const textDefaults =
    decorId === "stamp-seal"
      ? { fontFamily: "display", fontSize: 40, color: "#fde8e8", align: "center", fontWeight: 700 }
      : decorId === "stamp-postage"
      ? { fontFamily: "serif", fontSize: 15, color: v.tint, align: "center", fontStyle: "italic" }
      : { fontFamily: "sans", fontSize: 16, color: "#ffffff", align: "left", fontWeight: 700 };
  return base(ELEMENT_KIND.DECOR, {
    width: v.width,
    height: v.height,
    rotation: decorId.startsWith("washi") ? -4 : 0,
    decorId,
    tint: v.tint,
    html: v.html ?? "",
    ...DEFAULT_TEXT_STYLE,
    ...textDefaults,
    ...pos,
  });
}

/** Patch for elements with a `mediaSrc` slot (notes, polaroids) after an upload. */
export function mediaPatch(url, file) {
  return { mediaSrc: url, mediaType: file.type.startsWith("video/") ? "video" : "image" };
}

/** Media type of an uploaded file, or null for anything that isn't a photo or clip. */
export function fileMediaType(file) {
  if (file?.type?.startsWith("image/")) return "image";
  if (file?.type?.startsWith("video/")) return "video";
  return null;
}

/**
 * The photo/video slot built into an element: which media it takes, whether
 * it's already filled, and the patch that fills it. Null when it has none.
 */
export function mediaSlot(element) {
  switch (element.kind) {
    case ELEMENT_KIND.IMAGE:
      return { accepts: ["image"], filled: Boolean(element.src), fill: (src) => ({ src }) };
    case ELEMENT_KIND.VIDEO:
    case ELEMENT_KIND.VIEWFINDER:
      return { accepts: ["video"], filled: Boolean(element.url), fill: (src) => ({ url: src }) };
    case ELEMENT_KIND.POLAROID:
    case ELEMENT_KIND.NOTE:
      return { accepts: ["image", "video"], filled: Boolean(element.mediaSrc), fill: (src, type) => ({ mediaSrc: src, mediaType: type }) };
    case ELEMENT_KIND.FRAME_STICKER:
      return { accepts: ["image"], filled: Boolean(element.imageSrc), fill: (src) => ({ imageSrc: src, imageOffsetX: 0, imageOffsetY: 0 }) };
    default:
      return null;
  }
}

const hasWords = (html) => (html ?? "").replace(/<[^>]*>|&nbsp;/g, "").trim().length > 0;

/** What a dragged element would put into a slot it's dropped on: its photo, clip or words. */
export function dockPayload(element) {
  if (element.kind === ELEMENT_KIND.IMAGE && element.src) return { type: "image", src: element.src };
  if (element.kind === ELEMENT_KIND.VIDEO && element.url) return { type: "video", src: element.url };
  if (element.kind === ELEMENT_KIND.TEXT && hasWords(element.html)) return { type: "text", html: element.html };
  return null;
}

/**
 * Patch that docks `payload` into `host`'s empty photo/video slot or blank
 * caption, or null if it doesn't fit there. Filled slots are left alone, so a
 * drop on them overlays instead of replacing what's inside.
 */
export function dockPatch(host, payload) {
  if (!payload) return null;
  if (payload.type === "text") {
    return host.kind !== ELEMENT_KIND.TEXT && hasText(host) && !hasWords(host.html) ? { html: payload.html } : null;
  }
  const slot = mediaSlot(host);
  return slot && !slot.filled && slot.accepts.includes(payload.type) ? slot.fill(payload.src, payload.type) : null;
}

/** `element` shrunk to fit within `fill` of `host`, centred on it, turned with it and attached to it. */
export function placeOn(host, element, fill = 0.7) {
  const scale = Math.min(1, (host.width * fill) / element.width, (host.height * fill) / element.height);
  const width = Math.max(24, Math.round(element.width * scale));
  const height = Math.max(24, Math.round(element.height * scale));
  return {
    ...element,
    width,
    height,
    x: Math.round(host.x + host.width / 2 - width / 2),
    y: Math.round(host.y + host.height / 2 - height / 2),
    rotation: host.rotation,
    attachedTo: host.id,
  };
}

/** Elements whose content includes writeable text (and so get the text controls). */
export function hasText(element) {
  if (element.kind === ELEMENT_KIND.DECOR) return Boolean(DECOR_VARIANTS[element.decorId]?.text);
  return [ELEMENT_KIND.TEXT, ELEMENT_KIND.NOTE, ELEMENT_KIND.POLAROID, ELEMENT_KIND.VIEWFINDER].includes(element.kind);
}

/** Elements with an edit mode (double-tap / Enter): text gets typed into, collages get rearranged. */
export function hasEditMode(element) {
  return hasText(element) || element.kind === ELEMENT_KIND.COLLAGE;
}

export function nextZIndex(elements) {
  return elements.reduce((max, el) => Math.max(max, el.zIndex), 0) + 1;
}

/** Page grows with its content so there's always room below the lowest element. */
export function canvasHeight(doc) {
  return doc.elements.reduce((h, el) => Math.max(h, Math.ceil(el.y + el.height + 200)), doc.size.height);
}

export function createEmptyCanvasDoc() {
  return {
    size: { ...DEFAULT_CANVAS_SIZE },
    theme: { ...DEFAULT_THEME, paper: { ...DEFAULT_THEME.paper } },
    elements: [],
  };
}
