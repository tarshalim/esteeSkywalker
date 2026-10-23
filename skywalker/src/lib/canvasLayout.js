// The scrapbook canvas as it is stored with a post (blog.canvas) and in
// templates: plain JSON with a schema version, every node carrying its full
// transform, and zIndex rewritten to its absolute stacking position so the
// stored order reads bottom-to-top exactly as the page paints.
//
// {
//   version: 2,
//   size: { width, height },
//   theme: { paper, palette },
//   elements: [{ id, kind, x, y, width, height, rotation, zIndex, attachedTo, ...kind fields }]
// }
//
// Kind fields hold the content: `html` for text, `src`/`url`/`mediaSrc`/
// `imageSrc` for media (uploaded media are storage URLs, see lib/files.js).

import { DEFAULT_CANVAS_SIZE, DEFAULT_THEME } from "./canvasElements";
import { paintOrder } from "./canvasGroups";

export const CANVAS_LAYOUT_VERSION = 2;

const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);

/** One node with every transform field present and numeric, and a parent that exists (or null). */
function normalizeNode(el, ids) {
  return {
    ...el,
    x: num(el.x, 0),
    y: num(el.y, 0),
    width: Math.max(1, num(el.width, 100)),
    height: Math.max(1, num(el.height, 100)),
    rotation: num(el.rotation, 0),
    zIndex: num(el.zIndex, 0),
    attachedTo: el.attachedTo && el.attachedTo !== el.id && ids.has(el.attachedTo) ? el.attachedTo : null,
  };
}

function normalizeElements(elements) {
  const valid = (Array.isArray(elements) ? elements : []).filter((el) => el && typeof el === "object" && el.id && el.kind);
  const ids = new Set(valid.map((el) => el.id));
  return paintOrder(valid.map((el) => normalizeNode(el, ids))).map((el, i) => ({ ...el, zIndex: i + 1 }));
}

/** Serializable snapshot of a canvas doc for the post payload. */
export function exportCanvasLayout(doc) {
  return {
    version: CANVAS_LAYOUT_VERSION,
    size: { ...DEFAULT_CANVAS_SIZE, ...doc.size },
    theme: { ...DEFAULT_THEME, ...doc.theme },
    elements: normalizeElements(doc.elements),
  };
}

/**
 * Canvas doc from stored JSON (an object or a JSON string), tolerating
 * layouts saved before versioning; null when there's no usable layout.
 */
export function importCanvasLayout(raw) {
  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.elements)) return null;
  return {
    ...data,
    version: CANVAS_LAYOUT_VERSION,
    size: { ...DEFAULT_CANVAS_SIZE, ...data.size },
    theme: { ...DEFAULT_THEME, ...data.theme, paper: { ...DEFAULT_THEME.paper, ...data.theme?.paper } },
    elements: normalizeElements(data.elements),
  };
}
