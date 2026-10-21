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

const MARGIN_X = 64;
const TEXT_VARIANT_STYLE = {
  h1: { fontSize: 36, fontFamily: "serif", fontWeight: 700 },
  h2: { fontSize: 26, fontFamily: "serif", fontWeight: 700 },
  quote: { fontSize: 22, fontFamily: "serif", fontStyle: "italic" },
  paragraph: { fontSize: 18, fontFamily: "sans" },
};

function plainLength(html) {
  return (html ?? "").replace(/<[^>]*>/g, "").length;
}

/** Stacks legacy blocks top-to-bottom as canvas elements. */
export function blocksToCanvas(blocks = []) {
  const doc = createEmptyCanvasDoc();
  const width = doc.size.width - MARGIN_X * 2;
  let y = 56;
  let z = 1;

  for (const block of blocks) {
    let el = null;
    if ((block.kind === BLOCK_KIND.TEXT || block.kind === BLOCK_KIND.TEXTBOX) && plainLength(block.html) > 0) {
      const style = TEXT_VARIANT_STYLE[block.variant] ?? TEXT_VARIANT_STYLE.paragraph;
      const charsPerLine = Math.max(10, Math.floor(width / (style.fontSize * 0.52)));
      const lines = Math.ceil(plainLength(block.html) / charsPerLine);
      el = createTextElement({ html: block.html, width, height: Math.ceil(lines * style.fontSize * 1.4 + 12), ...style });
    } else if (block.kind === BLOCK_KIND.IMAGE && block.src) {
      el = createImageElement({ src: block.src, width, height: Math.round(width * 0.6) });
    } else if (block.kind === BLOCK_KIND.VIDEO && block.url) {
      el = createVideoElement({ url: block.url, width, height: Math.round((width * 9) / 16) });
    }
    if (!el) continue;
    el.x = MARGIN_X;
    el.y = y;
    el.zIndex = z++;
    doc.elements.push(el);
    y += el.height + 28;
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
    elements: (doc.elements ?? []).map((el) => ({ ...structuredClone(el), id: makeElementId() })),
  };
}
