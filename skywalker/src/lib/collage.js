// Photo collage model: the JSON stored on a canvas `collage` element, the
// layout maths shared by the editor, read-only view and template previews,
// and the built-in templates.
//
// element.collage = {
//   version: 1,
//   template: "hero-left" | ... | null,  // last template applied (null once hand-tuned)
//   layout: { mode: "grid" | "masonry", columns, gap, radius, cellAspect },
//   items: [{ id, src, caption, aspect, span: { col, row } }],
//   background?: { color, color2?, angle? },  // shows between tiles; color2 makes it a gradient
// }
//
// `aspect` is the photo's width / height (drives masonry tile heights);
// `span` is how many grid cells a tile covers (ignored in masonry mode).
// An item with an empty `src` is an open template slot waiting for a photo.

export const MAX_COLUMNS = 5;
const MAX_ROW_SPAN = 6;
export const MAX_ITEMS = 120;

let counter = 0;
function makeItemId() {
  counter += 1;
  return `ci_${Date.now().toString(36)}_${counter}`;
}

export function createCollageItem(src, aspect = 1) {
  return { id: makeItemId(), src, caption: "", aspect, span: { col: 1, row: 1 } };
}

export const DEFAULT_COLLAGE_LAYOUT = { mode: "grid", columns: 2, gap: 8, radius: 6, cellAspect: 0.75 };
export const DEFAULT_TEMPLATE = "balanced";

/** A new collage laid out as `templateId`, with its slots open and waiting for photos. */
export function createCollage(templateId = DEFAULT_TEMPLATE) {
  return applyTemplate({ version: 1, template: null, layout: { ...DEFAULT_COLLAGE_LAYOUT }, items: [] }, templateId);
}

export const isFilled = (item) => Boolean(item.src);

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/** Photo width / height, read from the file itself so masonry can size tiles before the image loads. */
export async function measureAspect(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const aspect = bitmap.width / bitmap.height;
    bitmap.close();
    return clamp(aspect, 0.3, 3);
  } catch {
    return 1;
  }
}

// --- Layout ---------------------------------------------------------------

/**
 * Dense first-fit packing of tiles into `columns` columns, in item order.
 * Tiles are then stretched right and down into any cells left empty, so the
 * collage never shows holes. Returns 0-based cells plus the row count.
 */
export function packGrid(items, columns) {
  const grid = [];
  const free = (r0, r1, c0, c1) => {
    for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) if (grid[r]?.[c] !== undefined) return false;
    return true;
  };
  const mark = (r0, r1, c0, c1, index) => {
    for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) (grid[r] ??= [])[c] = index;
  };

  const cells = items.map((item, index) => {
    const w = clamp(item.span?.col ?? 1, 1, columns);
    const h = clamp(item.span?.row ?? 1, 1, MAX_ROW_SPAN);
    for (let row = 0; ; row++) {
      for (let col = 0; col + w <= columns; col++) {
        if (free(row, row + h, col, col + w)) {
          mark(row, row + h, col, col + w, index);
          return { index, row, col, w, h };
        }
      }
    }
  });

  const rows = grid.length;
  for (const cell of cells) {
    while (cell.col + cell.w < columns && free(cell.row, cell.row + cell.h, cell.col + cell.w, cell.col + cell.w + 1)) {
      mark(cell.row, cell.row + cell.h, cell.col + cell.w, cell.col + cell.w + 1, cell.index);
      cell.w += 1;
    }
  }
  for (const cell of cells) {
    while (cell.row + cell.h < rows && free(cell.row + cell.h, cell.row + cell.h + 1, cell.col, cell.col + cell.w)) {
      mark(cell.row + cell.h, cell.row + cell.h + 1, cell.col, cell.col + cell.w, cell.index);
      cell.h += 1;
    }
  }
  return { cells, rows };
}

/** A tile's height per unit of width in masonry mode. */
const masonryWeight = (item) => 1 / clamp(item.aspect || 1, 0.3, 3);

/** Masonry: each photo drops into the currently shortest column. */
export function masonryColumns(items, columns) {
  const cols = Array.from({ length: columns }, () => ({ tiles: [], height: 0 }));
  items.forEach((item, index) => {
    const col = cols.reduce((best, c) => (c.height < best.height ? c : best));
    const weight = masonryWeight(item);
    col.tiles.push({ item, index, weight });
    col.height += weight;
  });
  return cols;
}

/** Element height at which grid cells keep their `cellAspect` (or masonry photos their own ratio). */
export function naturalHeight(collage, width) {
  const { mode, columns, gap, cellAspect } = collage.layout;
  if (collage.items.length === 0) return Math.round(width * 0.62);
  const colW = (width - gap * 2 - gap * (columns - 1)) / columns;
  let inner;
  if (mode === "masonry") {
    inner = Math.max(...masonryColumns(collage.items, columns).map((c) => c.height * colW + gap * Math.max(0, c.tiles.length - 1)));
  } else {
    const { rows } = packGrid(collage.items, columns);
    inner = rows * colW * cellAspect + gap * (rows - 1);
  }
  return Math.max(120, Math.round(inner + gap * 2));
}

// --- Templates ------------------------------------------------------------

// Each template has a fixed "head" of `slots` tiles that defines its look,
// plus a rule for photos beyond that. Grid templates are drawn on a 6-unit
// grid (`unit` units = one visual column) so the overflow can become a clean
// three-across sub-grid whose last row is widened to stay full-width.

const ONE = { col: 1, row: 1 };
const TAIL_UNITS = 6;
const TAIL_PER_ROW = 3;

/** Span of the `t`-th of `count` overflow tiles: rows of three, leftovers share the last row evenly. */
function tailSpan(t, count, rowSpan = 2) {
  const leftover = count % TAIL_PER_ROW;
  const perRow = t < count - leftover ? TAIL_PER_ROW : leftover;
  return { col: TAIL_UNITS / perRow, row: rowSpan };
}

/** Head tiles take `head[i]`; everything after flows into the tail sub-grid. */
const headThenTail = (head) => (i, n) => (i < head.length ? head[i] : tailSpan(i - head.length, n - head.length));

// 4-Grid Mosaic repeats in blocks of four, mirroring every other block so the tall tile alternates sides.
const MOSAIC_BLOCK = [{ col: 4, row: 2 }, { col: 2, row: 4 }, { col: 2, row: 2 }, { col: 2, row: 2 }];
const MOSAIC_MIRROR = [{ col: 2, row: 4 }, { col: 4, row: 2 }, { col: 2, row: 2 }, { col: 2, row: 2 }];

export const COLLAGE_TEMPLATES = [
  {
    id: "split",
    label: "2-Column Split",
    description: "Two tall portraits side by side",
    slots: 2,
    unit: 3,
    layout: () => ({ mode: "grid", columns: TAIL_UNITS, cellAspect: 1.25 }),
    span: headThenTail([{ col: 3, row: 3 }, { col: 3, row: 3 }]),
  },
  {
    id: "balanced",
    label: "3-Column Balanced",
    description: "Three equal columns, even rhythm",
    slots: 3,
    unit: 2,
    layout: () => ({ mode: "grid", columns: TAIL_UNITS, cellAspect: 1 }),
    span: headThenTail([{ col: 2, row: 3 }, { col: 2, row: 3 }, { col: 2, row: 3 }]),
  },
  {
    id: "hero-left",
    label: "Asymmetric Hero",
    description: "One big feature photo, two supporting shots",
    slots: 3,
    unit: 2,
    layout: () => ({ mode: "grid", columns: TAIL_UNITS, cellAspect: 1 }),
    span: headThenTail([{ col: 4, row: 4 }, { col: 2, row: 2 }, { col: 2, row: 2 }]),
  },
  {
    id: "mosaic",
    label: "4-Grid Mosaic",
    description: "Wide, tall and square tiles interlocked",
    slots: 4,
    unit: 2,
    layout: () => ({ mode: "grid", columns: TAIL_UNITS, cellAspect: 1 }),
    span: (i, n) => {
      const blocked = n - (n % 4);
      if (i >= blocked) return tailSpan(i - blocked, n - blocked);
      return (Math.floor(i / 4) % 2 ? MOSAIC_MIRROR : MOSAIC_BLOCK)[i % 4];
    },
  },
  {
    id: "story",
    label: "Vertical Story",
    description: "Full-width photos stacked like a story",
    slots: 3,
    unit: 1,
    layout: () => ({ mode: "grid", columns: 1, cellAspect: 0.6 }),
    span: () => ONE,
  },
  {
    id: "masonry",
    label: "Masonry Wall",
    description: "Photos keep their shape, columns stay even",
    slots: 6,
    unit: 1,
    layout: () => ({ mode: "masonry", columns: 3 }),
    span: () => ONE,
  },
];

export const findTemplate = (id) => COLLAGE_TEMPLATES.find((t) => t.id === id) ?? null;

/** Lays `items` out in `template`'s structure, spans assigned by position. */
function arrange(collage, template, items) {
  return {
    ...collage,
    template: template.id,
    layout: { ...collage.layout, ...template.layout() },
    items: items.map((item, i) => ({ ...item, span: { ...template.span(i, items.length) } })),
  };
}

/** Keeps at least `slots` tiles (padding with open slots) and drops open slots nobody needs. */
function fitSlots(items, slots) {
  const target = Math.max(slots, items.filter(isFilled).length);
  const next = [...items];
  for (let i = next.length - 1; i >= 0 && next.length > target; i--) if (!isFilled(next[i])) next.splice(i, 1);
  while (next.length < target) next.push(createCollageItem(""));
  return next;
}

/** Re-flows every tile into a template's structure; keeps photos, captions and order. */
export function applyTemplate(collage, templateId) {
  const template = findTemplate(templateId);
  if (!template) return collage;
  return arrange(collage, template, fitSlots(collage.items, template.slots));
}

/** New item order; under a template, spans follow position so the hero slot stays the hero. */
export function withItems(collage, items) {
  const template = findTemplate(collage.template);
  return template ? arrange(collage, template, items) : { ...collage, items };
}

/** What readers see: open slots are left out and the rest re-flows without gaps. */
export function filledView(collage) {
  if (collage.items.every(isFilled)) return collage;
  return withItems(collage, collage.items.filter(isFilled));
}

/**
 * Converts a template's fine unit grid to plain columns before hand-editing,
 * so the column picker and tile-size cycling work in whole columns.
 */
export function detachTemplate(collage) {
  const template = findTemplate(collage.template);
  if (!template) return collage;
  const u = template.unit;
  const coarse = (n) => Math.max(1, Math.round(n / u));
  return {
    ...collage,
    template: null,
    layout: { ...collage.layout, columns: coarse(collage.layout.columns) },
    items: collage.items.map((it) => ({ ...it, span: { col: coarse(it.span?.col ?? 1), row: coarse(it.span?.row ?? 1) } })),
  };
}

/** Column count as the user thinks of it (template unit grids count in whole columns). */
export function displayColumns(collage) {
  return collage.layout.columns / (findTemplate(collage.template)?.unit ?? 1);
}

// --- Background ---------------------------------------------------------

export const DEFAULT_BACKGROUND = { color: "#ffffff" };

// Warm scrapbook tones and soft pastels; the picker also takes any hex.
// Shared by collage backdrops and section boxes.
export const BACKGROUND_SOLIDS = [
  { label: "White", color: "#ffffff" },
  { label: "Soft cream", color: "#fbf5e6" },
  { label: "Craft paper", color: "#e9dcc3" },
  { label: "Kraft", color: "#cdb08a" },
  { label: "Vintage sage", color: "#d5ddc8" },
  { label: "Pastel mint", color: "#d7eee2" },
  { label: "Muted rose", color: "#e8cfcf" },
  { label: "Blush", color: "#f7dfe3" },
  { label: "Powder blue", color: "#dce9f5" },
  { label: "Lavender", color: "#e7e0f3" },
  { label: "Butter", color: "#faf0c8" },
  { label: "Warm slate", color: "#8c8580" },
  { label: "Charcoal", color: "#2f2f33" },
];

export const BACKGROUND_GRADIENTS = [
  { label: "Peach sunrise", color: "#fde2cf", color2: "#f9c5d1", angle: 135 },
  { label: "Mint breeze", color: "#e0f5ec", color2: "#cfe6f7", angle: 135 },
  { label: "Vintage sepia", color: "#f3e7d3", color2: "#d9c3a0", angle: 180 },
  { label: "Lavender dusk", color: "#ece4f7", color2: "#f8d8e4", angle: 135 },
  { label: "Golden hour", color: "#fff4d6", color2: "#f6c9a0", angle: 180 },
  { label: "Seaside", color: "#dff3f1", color2: "#b9d8ec", angle: 90 },
];

/** CSS `background` for a collage's backdrop. */
export function backgroundCss(bg = DEFAULT_BACKGROUND) {
  if (!bg.color2) return bg.color;
  return `linear-gradient(${bg.angle ?? 135}deg, ${bg.color}, ${bg.color2})`;
}

export const sameBackground = (a = DEFAULT_BACKGROUND, b = DEFAULT_BACKGROUND) =>
  a.color === b.color && (a.color2 ?? null) === (b.color2 ?? null) && (a.angle ?? 135) === (b.angle ?? 135);

// --- Item edits (all pure; return a new collage) -----------------------------

/**
 * Drops photos into open slots first (starting with `slotId`, if given), then
 * appends the rest; under a template they flow into its overflow rows.
 */
export function addItems(collage, newItems, { slotId } = {}) {
  const items = [...collage.items];
  const open = items.flatMap((it, i) => (isFilled(it) ? [] : [i]));
  const start = items.findIndex((it) => it.id === slotId);
  if (open.includes(start)) open.sort((a, b) => (b === start) - (a === start));
  const queue = [...newItems];
  for (const i of open) {
    if (!queue.length) break;
    const { src, aspect } = queue.shift();
    items[i] = { ...items[i], src, aspect };
  }
  return withItems(collage, [...items, ...queue].slice(0, MAX_ITEMS));
}

export function updateItem(collage, itemId, patch) {
  return { ...collage, items: collage.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) };
}

/** Removes a photo; while a template is down to its base slots, the slot is just emptied. */
export function removeItem(collage, itemId) {
  const template = findTemplate(collage.template);
  if (template && collage.items.length <= template.slots) return updateItem(collage, itemId, { src: "", caption: "", aspect: 1 });
  return withItems(collage, collage.items.filter((it) => it.id !== itemId));
}

/** Moves `fromId` into `toId`'s slot, shifting the tiles in between. */
export function moveItem(items, fromId, toId) {
  const from = items.findIndex((it) => it.id === fromId);
  const to = items.findIndex((it) => it.id === toId);
  if (from === -1 || to === -1 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function shiftItem(items, itemId, delta) {
  const i = items.findIndex((it) => it.id === itemId);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= items.length) return items;
  return moveItem(items, itemId, items[j].id);
}

const SPAN_CYCLE = [ONE, { col: 2, row: 1 }, { col: 1, row: 2 }, { col: 2, row: 2 }];

/** Next tile size in the 1×1 → 2×1 → 1×2 → 2×2 cycle. Hand-sizing detaches the template. */
export function cycleSpan(collage, itemId) {
  const detached = detachTemplate(collage);
  const item = detached.items.find((it) => it.id === itemId);
  if (!item) return collage;
  const i = SPAN_CYCLE.findIndex((s) => s.col === item.span?.col && s.row === item.span?.row);
  return updateItem(detached, itemId, { span: { ...SPAN_CYCLE[(i + 1) % SPAN_CYCLE.length] } });
}

// --- Element patches --------------------------------------------------------
// Functional patches (el => partial element) for actions.updateElement, so
// async uploads always build on the latest version of the element.

/** Patch that sets a new collage and refits the element height to it. */
export function collagePatch(el, collage, { fit = true } = {}) {
  return fit ? { collage, height: naturalHeight(collage, el.width) } : { collage };
}

/** Upload callback for multi-photo pickers: measures each photo, fills open slots, then appends the rest. */
export async function photosUploadedPatch(results, { slotId } = {}) {
  const items = await Promise.all(results.map(async ({ url, file }) => createCollageItem(url, await measureAspect(file))));
  return (el) => collagePatch(el, addItems(el.collage, items, { slotId }));
}

/** Like photosUploadedPatch, but the first photo lands in the open slot that was clicked. */
export const fillSlotPatch = (slotId) => (results) => photosUploadedPatch(results, { slotId });

/** Upload callback that swaps one tile's photo. */
export function replacePhotoPatch(itemId) {
  return async (url, file) => {
    const aspect = await measureAspect(file);
    return (el) => collagePatch(el, updateItem(el.collage, itemId, { src: url, aspect }), { fit: el.collage.layout.mode === "masonry" });
  };
}
