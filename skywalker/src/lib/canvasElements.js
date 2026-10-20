// Schema + factories for the freeform blog canvas. Mirrors the spirit of
// lib/blocks.js (shared shape, single source of truth for defaults) but for
// absolutely-positioned canvas elements instead of document-flow blocks.

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
};

export const DEFAULT_CANVAS_SIZE = { width: 794, height: 1123 }; // A4 @ 96dpi

// Default sizes per kind — shared between the factories below and the
// spawn-at-cursor ghost preview (CanvasStage), so the ghost always matches
// what actually gets placed.
export const DEFAULT_SIZES = {
  [ELEMENT_KIND.TEXT]: { width: 280, height: 90 },
  [ELEMENT_KIND.IMAGE]: { width: 320, height: 220 },
  [ELEMENT_KIND.VIDEO]: { width: 360, height: 202 },
  [ELEMENT_KIND.STICKER]: { width: 96, height: 96 },
  [ELEMENT_KIND.FRAME_STICKER]: { width: 220, height: 260 },
  [ELEMENT_KIND.AUDIO]: { width: 260, height: 96 },
};

export const DEFAULT_THEME = {
  pageBg: "#101a35",
  canvasBg: "#fdfdfd",
  showGrid: false,
  gridSize: 32,
  gridColor: "rgba(15, 23, 42, 0.08)",
  palette: ["#3b82f6", "#facc15", "#3ddc97", "#f472b6", "#1e40af", "#fdfdfd"],
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
    html: "",
    fontSize: 18,
    color: "#1e293b",
    align: "left",
    fontWeight: 400,
    ...pos,
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

export function createAudioElement(pos = {}) {
  return base(ELEMENT_KIND.AUDIO, {
    ...DEFAULT_SIZES[ELEMENT_KIND.AUDIO],
    sourceType: "",
    src: "",
    title: "",
    widgetStyle: "pill",
    volume: 0.8,
    muted: false,
    autoplayOnScroll: false,
    accentColor: "#3b82f6",
    ...pos,
  });
}

export function nextZIndex(elements) {
  return elements.reduce((max, el) => Math.max(max, el.zIndex), 0) + 1;
}

export function createEmptyCanvasDoc() {
  return {
    size: { ...DEFAULT_CANVAS_SIZE },
    theme: { ...DEFAULT_THEME },
    elements: [],
    journeyLines: [],
  };
}
