// Bridges between the legacy block list (lib/blocks.js) and the canvas doc.
// Posts keep a derived `blocks` array so features that only understand
// blocks (Gallery media, excerpts) keep working for canvas-authored posts.

import { BLOCK_KIND } from "./blocks";
import {
  ELEMENT_KIND,
  createEmptyCanvasDoc,
  createImageElement,
  createTextElement,
  createVideoElement,
  hasText,
  makeElementId,
} from "./canvasElements";
import { escapeHtml } from "./geo";

const MARGIN_X = 64;
const TEXT_VARIANT_STYLE = {
  h1: { fontSize: 36, fontFamily: "serif", fontWeight: 700 },
  h2: { fontSize: 26, fontFamily: "serif", fontWeight: 700 },
  quote: { fontSize: 22, fontFamily: "serif", fontStyle: "italic" },
  paragraph: { fontSize: 18, fontFamily: "sans" },
};

const CAPTION_STYLE = { fontSize: 13, fontFamily: "sans", color: "#64748b" };
const BLOCK_GAP = 28;
const CAPTION_GAP = 6;

function plainLength(html) {
  return (html ?? "").replace(/<[^>]*>/g, "").length;
}

/** Visible text with line breaks where the HTML breaks lines (br, closing p/div/li/heading/quote). */
function plainText(html) {
  return (html ?? "")
    .replace(/<br\b[^>]*>|<\/(?:p|div|li|h[1-6]|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi, "x");
}

/** Wrapped line count: each hard line takes at least one row. Trailing blank lines don't count. */
function estimateLines(text, charsPerLine) {
  const rows = text.split("\n");
  while (rows.length > 0 && rows[rows.length - 1].trim() === "") rows.pop();
  return rows.reduce((sum, row) => sum + Math.max(1, Math.ceil(row.length / charsPerLine)), 0);
}

function textHeight(text, width, fontSize) {
  const charsPerLine = Math.max(10, Math.floor(width / (fontSize * 0.52)));
  return Math.ceil(estimateLines(text, charsPerLine) * fontSize * 1.4 + 12);
}

/** The block's width (a 25–100 % share of the column, as BlockView resizes it) in canvas pixels. */
function blockWidth(block, columnWidth) {
  const pct = Number.isFinite(block.width) ? Math.min(100, Math.max(25, block.width)) : 100;
  return Math.round((columnWidth * pct) / 100);
}

/**
 * Stacks legacy blocks top-to-bottom as canvas elements, keeping each block's
 * width share and an image's caption (as a small text element under it), so
 * nothing is lost when the converted post is saved back over its blocks.
 */
export function blocksToCanvas(blocks = []) {
  const doc = createEmptyCanvasDoc();
  const columnWidth = doc.size.width - MARGIN_X * 2;
  let y = 56;
  let z = 1;

  const place = (el, gapAfter) => {
    el.x = MARGIN_X;
    el.y = y;
    el.zIndex = z++;
    doc.elements.push(el);
    y += el.height + gapAfter;
  };

  for (const block of blocks ?? []) {
    if (!block) continue;
    if (block.kind === BLOCK_KIND.TEXT || block.kind === BLOCK_KIND.TEXTBOX) {
      const text = plainText(block.html);
      if (text.trim() === "") continue;
      const style = TEXT_VARIANT_STYLE[block.variant] ?? TEXT_VARIANT_STYLE.paragraph;
      const width = block.kind === BLOCK_KIND.TEXTBOX ? blockWidth(block, columnWidth) : columnWidth;
      place(createTextElement({ html: block.html, width, height: textHeight(text, width, style.fontSize), ...style }), BLOCK_GAP);
    } else if (block.kind === BLOCK_KIND.IMAGE && block.src) {
      const width = blockWidth(block, columnWidth);
      const caption = (block.caption ?? "").trim();
      place(createImageElement({ src: block.src, width, height: Math.round(width * 0.6) }), caption ? CAPTION_GAP : BLOCK_GAP);
      if (caption) {
        const html = escapeHtml(caption);
        place(createTextElement({ html, width, height: textHeight(caption, width, CAPTION_STYLE.fontSize), ...CAPTION_STYLE }), BLOCK_GAP);
      }
    } else if (block.kind === BLOCK_KIND.VIDEO && block.url) {
      const width = blockWidth(block, columnWidth);
      place(createVideoElement({ url: block.url, width, height: Math.round((width * 9) / 16) }), BLOCK_GAP);
    }
  }
  return doc;
}

/** Reading-order block list derived from a canvas doc (text, images, videos). */
export function canvasToBlocks(doc) {
  const ordered = [...(doc?.elements ?? [])].sort((a, b) => a.y - b.y || a.x - b.x);
  const blocks = [];
  for (const el of ordered) {
    if (hasText(el) && plainLength(el.html) > 0) {
      blocks.push({ id: el.id, kind: BLOCK_KIND.TEXT, variant: "paragraph", html: el.html, placeholder: "" });
    }
    const imageSrc = el.kind === ELEMENT_KIND.IMAGE ? el.src : el.kind === ELEMENT_KIND.FRAME_STICKER ? el.imageSrc : el.mediaType === "image" ? el.mediaSrc : "";
    const videoUrl = el.kind === ELEMENT_KIND.VIDEO || el.kind === ELEMENT_KIND.VIEWFINDER ? el.url : el.mediaType === "video" ? el.mediaSrc : "";
    if (imageSrc) blocks.push({ id: `${el.id}_img`, kind: BLOCK_KIND.IMAGE, src: imageSrc, caption: "", width: 100 });
    if (el.kind === ELEMENT_KIND.COLLAGE) {
      for (const item of el.collage?.items ?? []) {
        if (item.src) blocks.push({ id: `${el.id}_${item.id}`, kind: BLOCK_KIND.IMAGE, src: item.src, caption: item.caption ?? "", width: 100 });
      }
    }
    if (videoUrl) blocks.push({ id: `${el.id}_vid`, kind: BLOCK_KIND.VIDEO, url: videoUrl, width: 100 });
  }
  return blocks;
}

/** Deep-ish copy with fresh element ids, for stamping out templates. */
export function cloneCanvasDoc(doc) {
  const empty = createEmptyCanvasDoc();
  return {
    ...empty,
    ...doc,
    // Nested objects are copied too, so edits to the stamped-out doc can't
    // reach back into the template it came from.
    size: { ...empty.size, ...doc.size },
    theme: { ...empty.theme, ...doc.theme, paper: { ...empty.theme.paper, ...doc.theme?.paper } },
    // Overlays point at their host's new id, so templates keep their groupings.
    elements: (() => {
      const source = doc.elements ?? [];
      const newIds = new Map(source.map((el) => [el.id, makeElementId()]));
      return source.map((el) => ({ ...structuredClone(el), id: newIds.get(el.id), attachedTo: newIds.get(el.attachedTo) ?? null }));
    })(),
  };
}
