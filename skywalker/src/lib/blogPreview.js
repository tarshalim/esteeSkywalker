import { BLOCK_KIND } from "./blocks";
import { canvasToBlocks } from "./canvasConvert";
import { ELEMENT_KIND } from "./canvasElements";
import { realCover, videoPoster } from "./media";

// What a small card can show of a post without opening it: a few words of its
// story and one thumbnail.

/** Snippets are cut here; the card's own line clamp usually cuts sooner. */
const MAX_SNIPPET = 160;

const NAMED_ENTITIES = { nbsp: " ", lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" };
// Tags that start or end a line; any other tag sits inside one, so dropping it mustn't split a word.
const LINE_TAG = /<\/?(?:address|article|blockquote|br|div|dd|dl|dt|figcaption|figure|h[1-6]|hr|li|ol|p|pre|section|table|td|th|tr|ul)\b[^>]*>/gi;

function decodeEntity(match, body) {
  if (body[0] !== "#") return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  const code = /^#x/i.test(body) ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
  return code <= 0x10ffff ? String.fromCodePoint(code) : match;
}

/** Plain, single-line text of a rich-text fragment. */
export function htmlToText(html) {
  return (html ?? "")
    .replace(/<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(LINE_TAG, " ")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, decodeEntity)
    .replace(/[\s\u200b\ufeff]+/g, " ")
    .trim();
}

/** `text` cut at a word boundary to at most `max` characters, ellipsis included. */
export function truncateText(text, max = MAX_SNIPPET) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  // A single very long word (a URL, unspaced scripts) is cut mid-word instead, but never mid-emoji.
  const kept = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut.replace(/[\ud800-\udbff]$/, "");
  return `${kept.replace(/[\s,;:.!?–—-]+$/, "")}…`;
}

/** The post's content in reading order, minus decorations' lettering ("Par avion" stamps, wax seals). */
function contentBlocks(blog) {
  const elements = blog.canvas?.elements ?? [];
  if (elements.length === 0) return blog.blocks ?? [];
  return canvasToBlocks({ elements: elements.filter((el) => el.kind !== ELEMENT_KIND.DECOR) });
}

function fallbackText(blog, hasMedia) {
  const place = blog.location?.name || blog.countryName;
  const kind = hasMedia ? "Photo & canvas journal entry" : "Canvas journal entry";
  return place ? `${kind} from ${place}` : kind;
}

/**
 * @param {object} blog
 * @returns {{ text: string, isFallback: boolean, thumb: string }} `text` is the
 *   opening of the story, else its summary, else (`isFallback`) a note about
 *   the post. `thumb` is its cover, else its first photo or video poster, else "".
 */
export function blogPreview(blog) {
  const blocks = contentBlocks(blog);
  const title = (blog.title ?? "").trim().toLowerCase();
  const story = blocks
    .map((b) => htmlToText(b.html))
    // A heading that just repeats the title would waste the snippet's first line.
    .filter((t) => /[\p{L}\p{N}]/u.test(t) && t.toLowerCase() !== title)
    .join(" ");
  const text = story || htmlToText(blog.excerpt);

  const media = blocks
    .map((b) => (b.kind === BLOCK_KIND.IMAGE ? b.src : b.kind === BLOCK_KIND.VIDEO ? videoPoster(b.url) : ""))
    .find(Boolean);
  const thumb = realCover(blog.coverImage) || media || "";
  const hasMedia = Boolean(thumb) || blocks.some((b) => b.kind === BLOCK_KIND.VIDEO && b.url);

  return text
    ? { text: truncateText(text), isFallback: false, thumb }
    : { text: fallbackText(blog, hasMedia), isFallback: true, thumb };
}
