// Cuts the illustrated sticker sheets in art/sheets/*.svg into individual,
// transparent scrapbook pieces. The sheets are Illustrator exports (some 20MB+)
// with many pieces on one background, far too heavy to ship as-is (so they live
// outside public/ and never reach the build), so this:
//   1. drops each sheet's background layer (and any credit line),
//   2. rasterises the rest at high resolution,
//   3. finds the separate pieces (alpha islands, with nearby bits merged),
//   4. writes each one as a trimmed WebP to public/assets/scrapbook/<sheet>/,
//   5. renders a few whole sheets as page backdrops for templates,
// and records everything in src/data/scrapbookArt.json for the editor.
// Re-run with `npm run scrapbook-art` after adding or changing a sheet; labels
// and sections live in src/data/scrapbookArt.js, keyed by the ids printed here.
import sharp from "sharp";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

const SRC = "art/sheets";
const OUT = "public/assets/scrapbook";
const MANIFEST = "src/data/scrapbookArt.json";
const RASTER = 3000; // long side of the working raster
const PIECE_MAX = 640; // long side of each shipped piece
const MERGE = 6; // px gap (at RASTER scale) still counted as one piece
const MIN_AREA = 0.0012; // pieces smaller than this share of the sheet are dropped
// `--contact=<dir>` also writes a numbered contact sheet per sheet there, for naming pieces.
const CONTACT = process.argv.find((a) => a.startsWith("--contact="))?.slice("--contact=".length);

// Sheets to cut into pieces, and the layers to drop from each (background, Freepik credit line).
// `noText` strips live <text> (sheet titles, frame captions) whose fonts aren't installed and
// would otherwise render as stray fallback letters.
const FREEPIK = "DESIGNED_BY_FREEPIK";
const SHEETS = [
  { id: "cinematic", file: "cinematic.svg" },
  { id: "cute", file: "cute.svg", drop: ["BACKGROUND"] },
  { id: "party", file: "cute_02.svg", drop: ["BACKGROUND"] },
  { id: "planner", file: "cute_03.svg", drop: ["BACKGROUND"] },
  { id: "oldschool", file: "old_school.svg", drop: ["BACKGROUND"] },
  { id: "paper", file: "rustic_02.svg", drop: ["Background"] },
  { id: "washi", file: "washi tape_01.svg", drop: ["Background"] },
  { id: "travel", file: "travel-icons.svg", drop: ["Background"], noText: true },
  { id: "travel2", file: "travel-icons-02.svg", drop: ["BACKGROUND_1_"], noText: true },
  { id: "travel3", file: "travel-icons-03.svg", drop: ["BACKGROUND", FREEPIK] },
  { id: "camping", file: "camping-icons.svg", drop: ["BACKGROUND", FREEPIK] },
  { id: "camping2", file: "camping-icons-02.svg", drop: ["Layer_1"] },
  { id: "autumn", file: "autumn-icons.svg", drop: ["BACKGROUND"] },
  { id: "autumn2", file: "autumn-icons-02.svg", drop: ["BACKGROUND", FREEPIK], noText: true },
  { id: "winter", file: "winter-icons.svg", drop: ["BACKGROUND", FREEPIK] },
];

// Whole compositions kept intact as full-page backdrops.
const BACKDROPS = [
  { id: "rustic-kraft", file: "rustic.svg" },
  { id: "rustic-stone", file: "rustic_02.svg" },
  { id: "rustic-board", file: "rustic_03.svg" },
  { id: "notepad-coral", file: "notepad.svg" },
];

/** Removes `<g id="…">…</g>` (nested groups included) from SVG source. */
function dropGroup(svg, id) {
  const start = svg.indexOf(`<g id="${id}"`);
  if (start < 0) throw new Error(`no <g id="${id}">`);
  const tag = /<g[\s>]|<\/g>/g;
  tag.lastIndex = start + 2;
  let depth = 1;
  for (let m; (m = tag.exec(svg)); ) {
    depth += m[0] === "</g>" ? -1 : 1;
    if (depth === 0) return svg.slice(0, start) + svg.slice(tag.lastIndex);
  }
  throw new Error(`unbalanced <g id="${id}">`);
}

function viewBox(svg) {
  const [, , w, h] = svg.match(/viewBox="([^"]+)"/)[1].trim().split(/[\s,]+/).map(Number);
  return { w, h };
}

/** Rasterises SVG source so its long side is `longSide` px. */
function render(svg, longSide) {
  const vb = viewBox(svg);
  const density = (72 * longSide) / Math.max(vb.w, vb.h);
  return sharp(Buffer.from(svg), { density, limitInputPixels: false, unlimited: true });
}

/**
 * The alpha islands in an RGBA raster, merging ones closer than MERGE px.
 * Each comes with `owns(x, y)`, so a crop can drop bits of neighbours that
 * stray into its bounding box.
 */
function findPieces(data, width, height) {
  const cell = MERGE;
  const gw = Math.ceil(width / cell);
  const gh = Math.ceil(height / cell);
  const filled = new Uint8Array(gw * gh);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 16) filled[((y / cell) | 0) * gw + ((x / cell) | 0)] = 1;
    }
  }
  // 8-connected labelling on the coarse grid; neighbouring cells bridge gaps < one cell.
  const label = new Int32Array(gw * gh).fill(-1);
  const boxes = [];
  const stack = [];
  for (let i = 0; i < filled.length; i++) {
    if (!filled[i] || label[i] >= 0) continue;
    const box = { x0: Infinity, y0: Infinity, x1: -1, y1: -1, cells: 0 };
    label[i] = boxes.length;
    stack.push(i);
    while (stack.length) {
      const c = stack.pop();
      const cx = c % gw;
      const cy = (c / gw) | 0;
      box.cells++;
      box.x0 = Math.min(box.x0, cx);
      box.y0 = Math.min(box.y0, cy);
      box.x1 = Math.max(box.x1, cx);
      box.y1 = Math.max(box.y1, cy);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const n = ny * gw + nx;
          if (filled[n] && label[n] < 0) {
            label[n] = boxes.length;
            stack.push(n);
          }
        }
      }
    }
    boxes.push(box);
  }
  const minCells = (MIN_AREA * gw * gh) | 0;
  return boxes
    .map((b, n) => ({ ...b, n }))
    .filter((b) => b.cells >= minCells)
    .map((b) => {
      const left = b.x0 * cell;
      const top = b.y0 * cell;
      return {
        left,
        top,
        width: Math.min(width, (b.x1 + 1) * cell) - left,
        height: Math.min(height, (b.y1 + 1) * cell) - top,
        owns: (x, y) => label[((y / cell) | 0) * gw + ((x / cell) | 0)] === b.n,
      };
    })
    // Reading order: rows top to bottom (a row is anything starting within 4% of the sheet), then left to right.
    .sort((a, b) => Math.round(a.top / (height * 0.04)) - Math.round(b.top / (height * 0.04)) || a.left - b.left);
}

/** Copies one piece out of the sheet, clearing pixels it doesn't own and trimming to its visible pixels. */
function isolate(data, sheetWidth, box) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = box.top; y < box.top + box.height; y++) {
    for (let x = box.left; x < box.left + box.width; x++) {
      if (data[(y * sheetWidth + x) * 4 + 3] > 0 && box.owns(x, y)) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  const width = x1 - x0 + 1;
  const height = y1 - y0 + 1;
  const buffer = Buffer.alloc(width * height * 4);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!box.owns(x, y)) continue;
      const from = (y * sheetWidth + x) * 4;
      data.copy(buffer, ((y - y0) * width + (x - x0)) * 4, from, from + 4);
    }
  }
  return { buffer, width, height };
}

async function cutSheet({ id, file, drop = [], noText = false }) {
  let svg = await readFile(`${SRC}/${file}`, "utf8");
  for (const group of drop) svg = dropGroup(svg, group);
  if (noText) svg = svg.replace(/<text[\s>][\s\S]*?<\/text>/g, "");
  const { data, info } = await render(svg, RASTER).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const boxes = findPieces(data, info.width, info.height);
  await mkdir(`${OUT}/${id}`, { recursive: true });

  const pieces = [];
  for (const [i, box] of boxes.entries()) {
    const pieceId = `${id}-${String(i + 1).padStart(2, "0")}`;
    const file = `${OUT}/${id}/${pieceId}.webp`;
    const { buffer, width, height } = isolate(data, info.width, box);
    const out = await sharp(buffer, { raw: { width, height, channels: 4 } })
      .resize(PIECE_MAX, PIECE_MAX, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84, alphaQuality: 90, effort: 5 })
      .toFile(file);
    pieces.push({ id: pieceId, sheet: id, src: `/${file.replace(/^public\//, "")}`, width: out.width, height: out.height });
  }
  console.log(`${file}: ${pieces.length} pieces`);
  if (CONTACT) await contactSheet(id, pieces);
  return pieces;
}

async function renderBackdrop({ id, file }) {
  const svg = await readFile(`${SRC}/${file}`, "utf8");
  const path = `${OUT}/backdrops/${id}.webp`;
  await mkdir(`${OUT}/backdrops`, { recursive: true });
  const out = await render(svg, 1600).webp({ quality: 80, effort: 5 }).toFile(path);
  console.log(`${file}: backdrop ${out.width}×${out.height}`);
  return { id, src: `/${path.replace(/^public\//, "")}`, width: out.width, height: out.height };
}

/** A numbered grid of a sheet's pieces, for naming them. */
async function contactSheet(id, pieces) {
  const tile = 220;
  const cols = 6;
  const rows = Math.ceil(pieces.length / cols);
  const layers = [];
  for (const [i, p] of pieces.entries()) {
    const img = await sharp(`public${p.src}`).resize(tile - 20, tile - 40, { fit: "inside" }).toBuffer();
    const left = (i % cols) * tile;
    const top = Math.floor(i / cols) * tile;
    layers.push({ input: img, left: left + 10, top: top + 30 });
    layers.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="28"><text x="6" y="20" font-size="18" font-family="sans-serif" fill="#c00">${p.id}</text></svg>`),
      left,
      top,
    });
  }
  await mkdir(CONTACT, { recursive: true });
  await sharp({ create: { width: cols * tile, height: rows * tile, channels: 3, background: "#d8d8d8" } })
    .composite(layers)
    .png()
    .toFile(`${CONTACT}/${id}.png`);
}

await rm(OUT, { recursive: true, force: true });
const pieces = [];
for (const sheet of SHEETS) pieces.push(...(await cutSheet(sheet)));
const backdrops = [];
for (const b of BACKDROPS) backdrops.push(await renderBackdrop(b));
await writeFile(MANIFEST, `${JSON.stringify({ pieces, backdrops }, null, 2)}\n`);
console.log(`\nWrote ${pieces.length} pieces + ${backdrops.length} backdrops; manifest at ${MANIFEST}`);
