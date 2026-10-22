// Shared block schema used by both the editor (editable) and the blog detail
// view (read-only), so formatting logic never has to be written twice.

let counter = 0;
export function makeBlockId() {
  counter += 1;
  return `blk_${Date.now().toString(36)}_${counter}`;
}

export const BLOCK_KIND = {
  TEXT: "text", // paragraph | h1 | h2 | quote share the same shape, differ by `variant`
  IMAGE: "image",
  VIDEO: "video",
  TEXTBOX: "textbox",
};

const TEXT_PLACEHOLDERS = {
  paragraph: "Start writing…",
  h1: "Heading",
  h2: "Subheading",
  quote: "Type a memorable quote…",
};

// `html` is left genuinely empty when omitted (rendered via a CSS
// :empty::before placeholder) rather than seeded with literal text — otherwise
// clicking in and typing appends after the seed instead of replacing it.
export function createTextBlock(variant = "paragraph", html = "") {
  return {
    id: makeBlockId(),
    kind: BLOCK_KIND.TEXT,
    variant, // "paragraph" | "h1" | "h2" | "quote"
    html,
    placeholder: TEXT_PLACEHOLDERS[variant] || "Start writing…",
  };
}

export function createImageBlock(src = "", caption = "") {
  return {
    id: makeBlockId(),
    kind: BLOCK_KIND.IMAGE,
    src,
    caption,
    width: 100, // percent of canvas width
  };
}

export function createVideoBlock(url = "") {
  return {
    id: makeBlockId(),
    kind: BLOCK_KIND.VIDEO,
    url,
    width: 100,
  };
}

export function createTextboxBlock(columns = 2, html = "") {
  return {
    id: makeBlockId(),
    kind: BLOCK_KIND.TEXTBOX,
    columns,
    html: html || "Double column text box — great for side-by-side notes.",
    width: 100,
  };
}

/** Normalizes any YouTube/Vimeo/Loom/mp4 link into an embeddable src. */
export function toEmbedUrl(url) {
  if (!url) return "";
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtube\.com\/embed\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const loom = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;
  return url;
}

/** True for player URLs that need an <iframe> rather than a <video>. */
export function isEmbedUrl(url) {
  return /youtube\.com\/embed\/|player\.vimeo\.com\/video\/|loom\.com\/embed\//.test(url ?? "");
}
