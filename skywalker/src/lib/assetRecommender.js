// Rule-based "suggested for this story" picks: the story's keywords are
// looked up in an inverted index (term -> assets) built once from the code
// catalog, scored, and trimmed to a varied top N. When the text says nothing
// useful, the post's context (vibes, season) and then a default spread fill
// the remaining slots, so the panel is never empty.

import { SCRAPBOOK_LIBRARY } from "./scrapbookLibrary";
import { PAPER_GROUPS } from "./paperStyles";
import { BUILT_IN_TEMPLATES } from "./templates";
import { hasText } from "./canvasElements";
import { KEYWORD_ALIASES, KEYWORD_DICTIONARY } from "../data/keywordDictionary";
import { extractKeywords, keywordOf, tokenize } from "./keywords";

/**
 * @typedef {{
 *   id: string,
 *   kind: "sticker" | "frame" | "texture" | "template",
 *   categoryId: string,
 *   label: string,
 *   order: number,
 *   item?: object,      // scrapbookLibrary item (stickers, frames, backdrops)
 *   paperStyle?: string, // paperStyles id (textures)
 *   template?: import("./templates").PostTemplate,
 * }} Asset
 *
 * @typedef {{ asset: Asset, reason: "keyword" | "context" | "default", matched: string[] }} Suggestion
 */

// A word in the asset's own label is the most precise signal there is, so it
// outranks any dictionary weight (max 3).
const LABEL_WEIGHT = 4;
// A dictionary entry for one asset outranks the same word on its whole sheet.
const ASSET_ENTRY_BONUS = 1;
// One passing mention of a loosely related (weight 1) trigger isn't enough on its own.
const MIN_SCORE = 2;
// Variety caps for the first pass; lifted if there aren't enough candidates.
const MAX_PER_CATEGORY = 2;
const MAX_PER_KIND = 3;
// Plain-color papers aren't worth suggesting.
const SKIPPED_PAPER_GROUPS = new Set(["clean", "colored"]);

const normalize = (word) => KEYWORD_ALIASES[word] ?? word;

// Map.groupBy, which older Safari lacks.
function groupBy(list, keyOf) {
  const groups = new Map();
  for (const item of list) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

/** @returns {Asset[]} every suggestible asset, in catalog order. */
function buildCatalog() {
  const assets = [];
  const add = (asset) => assets.push({ ...asset, order: assets.length });

  for (const section of SCRAPBOOK_LIBRARY) {
    const kind = section.id === "frames" ? "frame" : section.id === "art-backdrops" ? "texture" : "sticker";
    for (const item of section.items) add({ id: item.id, kind, categoryId: section.id, label: item.label, item });
  }
  for (const group of PAPER_GROUPS) {
    if (SKIPPED_PAPER_GROUPS.has(group.id)) continue;
    for (const style of group.styles) {
      add({ id: `paper-${style.id}`, kind: "texture", categoryId: `paper-${group.id}`, label: `${style.label} paper`, paperStyle: style.id });
    }
  }
  for (const template of BUILT_IN_TEMPLATES) {
    add({
      id: `template-${template.id}`,
      kind: "template",
      categoryId: template.aesthetic ? `template-${template.aesthetic}` : "templates",
      // Name, gallery category ("Beach") and vibes all describe the template.
      label: [template.name, template.category, ...(template.vibes ?? [])].join(" "),
      template,
    });
  }
  return assets;
}

function buildIndex() {
  const assets = buildCatalog();
  /** @type {Map<string, Map<string, number>>} term -> assetId -> weight */
  const postings = new Map();
  const post = (term, assetId, weight) => {
    let byAsset = postings.get(term);
    if (!byAsset) postings.set(term, (byAsset = new Map()));
    // A term reaching an asset twice (label + category) counts once, at its strongest.
    byAsset.set(assetId, Math.max(byAsset.get(assetId) ?? 0, weight));
  };

  const byId = new Map(assets.map((a) => [a.id, a]));
  const byCategory = groupBy(assets, (a) => a.categoryId);
  for (const [key, { weight, terms }] of Object.entries(KEYWORD_DICTIONARY)) {
    const single = byId.get(key);
    const targets = single ? [single] : byCategory.get(key);
    if (!targets) {
      // Stale key: the asset or category was renamed or removed from the catalog.
      if (import.meta.env?.DEV) console.warn(`keywordDictionary: no asset or category "${key}"`);
      continue;
    }
    for (const asset of targets) {
      for (const term of terms) post(term, asset.id, single ? weight + ASSET_ENTRY_BONUS : weight);
    }
  }
  for (const asset of assets) {
    for (const raw of tokenize(asset.label)) {
      const word = keywordOf(raw);
      if (word) post(normalize(word), asset.id, LABEL_WEIGHT);
    }
  }

  // Default spread: the first asset of each category, interleaved by kind so
  // a cold start shows a sticker, a frame, a texture, a template, ...
  const firstOfCategory = [...byCategory.values()].map((list) => list[0]);
  const byKind = [...groupBy(firstOfCategory, (a) => a.kind).values()];
  const defaults = [];
  for (let i = 0; defaults.length < firstOfCategory.length; i++) {
    for (const list of byKind) if (list[i]) defaults.push(list[i]);
  }

  return { assets: byId, postings, defaults };
}

let index = null;
const getIndex = () => (index ??= buildIndex());

/** Assets ranked by score, best first, for one keyword map. */
function rank(keywords) {
  const { assets, postings } = getIndex();
  /** @type {Map<string, { score: number, matched: Set<string> }>} */
  const hits = new Map();
  for (const [keyword, keywordWeight] of keywords) {
    const term = normalize(keyword);
    for (const [assetId, weight] of postings.get(term) ?? []) {
      const hit = hits.get(assetId) ?? { score: 0, matched: new Set() };
      hit.score += keywordWeight * weight;
      hit.matched.add(term);
      hits.set(assetId, hit);
    }
  }
  return [...hits]
    .filter(([, hit]) => hit.score >= MIN_SCORE)
    .map(([id, hit]) => ({ asset: assets.get(id), score: hit.score, matched: [...hit.matched] }))
    // Ties go to the asset matching more distinct words, then catalog order (stable output).
    .sort((a, b) => b.score - a.score || b.matched.length - a.matched.length || a.asset.order - b.asset.order);
}

/**
 * Up to `limit` candidates in order, first with variety caps, then without.
 * Candidates arrive tier by tier, so the caps are lifted only once even the
 * default spread can't fill the slots.
 */
function pickDiverse(candidates, limit) {
  const picks = [];
  const taken = new Set();
  const count = (key, value) => picks.filter((p) => p.asset[key] === value).length;
  for (const capped of [true, false]) {
    for (const candidate of candidates) {
      if (picks.length >= limit) return picks;
      const { asset } = candidate;
      if (taken.has(asset.id)) continue;
      if (capped && (count("categoryId", asset.categoryId) >= MAX_PER_CATEGORY || count("kind", asset.kind) >= MAX_PER_KIND)) continue;
      picks.push(candidate);
      taken.add(asset.id);
    }
  }
  return picks;
}

/**
 * Top `limit` suggestions for a story. Each tier only fills the slots the one
 * before it left open:
 *   1. "keyword" — matches on the story's own words (title counts triple)
 *   2. "context" — matches on the post's vibes and season
 *   3. "default" — one piece from each category, mixed across kinds
 * @param {{ title?: string, text?: string, vibes?: string[], date?: string, limit?: number }} story
 *   vibes are vibe labels ("Nature & Hiking"); date is the trip's ISO date.
 * @returns {{ suggestions: Suggestion[], keywords: string[] }} keywords: the story words that matched, strongest first
 */
export function recommendAssets({ title = "", text = "", vibes = [], date, limit = 6 }) {
  const matches = rank(extractKeywords([{ text: title, weight: 3 }, { text }]));
  const context = rank(extractKeywords([{ text: vibes.join(" ") }, { text: seasonOf(date) }]));
  const suggestions = pickDiverse(
    [
      ...matches.map((m) => ({ asset: m.asset, reason: "keyword", matched: m.matched })),
      ...context.map((m) => ({ asset: m.asset, reason: "context", matched: m.matched })),
      ...getIndex().defaults.map((asset) => ({ asset, reason: "default", matched: [] })),
    ],
    limit
  );

  const keywords = [...new Set(matches.flatMap((m) => m.matched))].slice(0, 5);
  return { suggestions, keywords };
}

/** Northern-hemisphere season of an ISO date, or "" if there's no date. */
export function seasonOf(date) {
  const month = date ? new Date(date).getMonth() : NaN;
  if (Number.isNaN(month)) return "";
  return ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"][month];
}

/** The written story on a scrapbook canvas, as one HTML string for extractKeywords. */
export function canvasStoryText(canvas) {
  return (canvas?.elements ?? [])
    .filter((el) => hasText(el) && el.html)
    .map((el) => el.html)
    .join("\n");
}
