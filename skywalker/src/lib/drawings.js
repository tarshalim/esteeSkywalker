import { supabase } from "./supabase";
import { fileToDataUrl } from "./files";

// Hand-drawn stickers. The drawing pad records strokes in a fixed PAD_SIZE
// space (so they replay identically at any screen size); on save they're
// rendered, cropped to the ink, into a transparent PNG in the blog-drawings
// bucket. The strokes are kept on the canvas element so it can be re-edited.
//
// A stroke is { tool, color, size, points: [x0, y0, x1, y1, …] }.

export const DRAWINGS_BUCKET = "blog-drawings";
export const PAD_SIZE = { width: 800, height: 560 };
const EXPORT_SCALE = 2; // stays sharp on retina screens at the sticker's natural size
const CROP_PADDING = 12; // px of transparent margin kept around the ink
const MIN_INK_ALPHA = 8; // alpha below this counts as empty when cropping

export const DRAWING_TOOLS = {
  pen: { label: "Pen", alpha: 1, widthScale: 1, composite: "source-over" },
  highlighter: { label: "Highlighter", alpha: 0.35, widthScale: 3, composite: "source-over" },
  eraser: { label: "Eraser", alpha: 1, widthScale: 2.5, composite: "destination-out" },
};

export const DRAW_COLORS = ["#1e293b", "#b91c1c", "#ea580c", "#facc15", "#15803d", "#0891b2", "#1d4ed8", "#7c3aed", "#db2777", "#ffffff"];

/** Draws one stroke as a single smoothed path, so translucent strokes don't darken where segments overlap. */
export function drawStroke(ctx, { tool, color, size, points }) {
  const t = DRAWING_TOOLS[tool] ?? DRAWING_TOOLS.pen;
  ctx.save();
  ctx.globalCompositeOperation = t.composite;
  ctx.globalAlpha = t.alpha;
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = size * t.widthScale;
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.beginPath();
  if (points.length <= 2) {
    ctx.arc(points[0], points[1], ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Quadratic curves through the midpoints between samples smooth out jitter.
    const n = points.length / 2;
    ctx.moveTo(points[0], points[1]);
    for (let k = 1; k < n - 1; k++) {
      const x = points[k * 2];
      const y = points[k * 2 + 1];
      ctx.quadraticCurveTo(x, y, (x + points[k * 2 + 2]) / 2, (y + points[k * 2 + 3]) / 2);
    }
    ctx.lineTo(points[n * 2 - 2], points[n * 2 - 1]);
    ctx.stroke();
  }
  ctx.restore();
}

export function renderStrokes(ctx, strokes) {
  for (const stroke of strokes) drawStroke(ctx, stroke);
}

/** Pixel bounds of the visible ink (erasers included), or null when the pad is blank. */
function inkBounds(strokes) {
  const probe = document.createElement("canvas");
  probe.width = PAD_SIZE.width;
  probe.height = PAD_SIZE.height;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  renderStrokes(ctx, strokes);
  const { data, width, height } = ctx.getImageData(0, 0, probe.width, probe.height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < MIN_INK_ALPHA) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

/**
 * Renders the strokes, cropped to their ink, to a transparent PNG.
 * Returns { blob, width, height } in pad px, or null if nothing is drawn.
 */
export async function exportDrawing(strokes) {
  const bounds = inkBounds(strokes);
  if (!bounds) return null;
  const x0 = Math.max(0, bounds.minX - CROP_PADDING);
  const y0 = Math.max(0, bounds.minY - CROP_PADDING);
  const width = Math.min(PAD_SIZE.width, bounds.maxX + 1 + CROP_PADDING) - x0;
  const height = Math.min(PAD_SIZE.height, bounds.maxY + 1 + CROP_PADDING) - y0;

  const out = document.createElement("canvas");
  out.width = width * EXPORT_SCALE;
  out.height = height * EXPORT_SCALE;
  const ctx = out.getContext("2d");
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
  ctx.translate(-x0, -y0);
  renderStrokes(ctx, strokes);
  const blob = await new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't export the drawing"))), "image/png"));
  return { blob, width, height };
}

/** Uploads a drawing PNG and returns its public URL (a data URL when Supabase isn't configured). */
export async function uploadDrawing(blob) {
  if (!supabase) return fileToDataUrl(blob);
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage.from(DRAWINGS_BUCKET).upload(path, blob, { contentType: "image/png", upsert: false });
  if (error) throw error;
  return supabase.storage.from(DRAWINGS_BUCKET).getPublicUrl(path).data.publicUrl;
}
