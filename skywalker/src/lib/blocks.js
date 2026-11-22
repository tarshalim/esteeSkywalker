// Block schema of legacy (pre-canvas) posts: still rendered read-only by
// BlockView and converted by canvasConvert, plus the embed-URL helpers the
// canvas media elements share.

import { parseYouTubeId, youTubeEmbedUrl } from "./mediaUrl";

export const BLOCK_KIND = {
  TEXT: "text", // paragraph | h1 | h2 | quote share the same shape, differ by `variant`
  IMAGE: "image",
  VIDEO: "video",
  TEXTBOX: "textbox",
};

/** Normalizes any YouTube/Vimeo/Loom/mp4 link into an embeddable src. */
export function toEmbedUrl(url) {
  if (!url) return "";
  const yt = parseYouTubeId(url, { allowBareId: false });
  if (yt) return youTubeEmbedUrl(yt);
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
