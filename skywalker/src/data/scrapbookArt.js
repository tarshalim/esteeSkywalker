// Illustrated scrapbook pieces cut from the sticker sheets in public/assets by
// `npm run scrapbook-art`. The generated manifest holds each piece's file and
// pixel size; this file names the pieces and groups them into sections.

import manifest from "./scrapbookArt.json";

// Display order of the sections, with a label for every piece id the script printed.
const SECTIONS = [
  {
    id: "journals",
    label: "Vintage journals",
    labels: {
      "cinematic-01": "Spiral notebook",
      "cinematic-02": "Memories album",
      "cinematic-03": "Leather wallet",
      "cinematic-04": "Photo-corner card",
      "cinematic-05": "Polaroid stack",
      "cinematic-06": "Paper sheets",
      "cinematic-07": "Film strip",
      "cinematic-08": "Memories journal",
      "cinematic-09": "Airmail envelope",
      "cinematic-10": "Spiral album",
      "cinematic-11": "Open journal",
      "cinematic-12": "Album spread",
      "cinematic-13": "Letter & photo",
      "cinematic-14": "Twine folio",
      "cinematic-15": "Corner album",
      "cinematic-16": "Diary",
    },
  },
  {
    id: "oldschool",
    label: "Old-school paper",
    labels: {
      "oldschool-01": "Torn notebook strip",
      "oldschool-02": "Starburst label",
      "oldschool-03": "Ornate label",
      "oldschool-04": "Scalloped frame",
      "oldschool-05": "Kraft tag",
      "oldschool-06": "Oval frame",
      "oldschool-07": "Postage frame",
      "oldschool-08": "Taped note",
      "oldschool-09": "Lined seal",
      "oldschool-10": "Torn lined page",
      "oldschool-11": "Torn kraft corner",
      "oldschool-12": "Torn label",
      "oldschool-13": "Striped torn corner",
    },
  },
  {
    id: "washi",
    label: "Neutral washi",
    labels: {
      "washi-01": "Chalk tape",
      "washi-02": "Plum tape",
      "washi-03": "Tan tape",
      "washi-04": "Cream tape",
      "washi-05": "Cocoa tape",
      "washi-06": "Smoke tape",
      "washi-07": "Mulberry tape",
      "washi-08": "Linen tape",
      "washi-09": "Sand tape",
      "washi-10": "Charcoal tape",
    },
  },
  {
    id: "paper",
    label: "Taped notes",
    labels: {
      "paper-01": "Taped kraft square",
      "paper-02": "Lined mauve note",
      "paper-03": "Dotted note",
      "paper-04": "Crumpled note",
    },
  },
  {
    id: "cute",
    label: "Cute planner",
    labels: {
      "cute-01": "Crown",
      "cute-02": "Flower",
      "cute-03": "Leafy washi",
      "cute-04": "“Don't forget” banner",
      "cute-05": "Striped washi",
      "cute-06": "Scalloped heart",
      "cute-07": "“Today!” banner",
      "cute-08": "“Yay!” bubble",
      "cute-09": "Wavy washi",
      "cute-10": "“Awesome!” banner",
      "cute-11": "Polka washi",
      "cute-12": "Star",
      "cute-13": "Moon",
      "cute-14": "Heart",
      "cute-15": "Heart washi",
      "cute-16": "“Important” banner",
      "cute-17": "Arrow",
      "cute-18": "This-week list",
      "cute-19": "To-do list",
      "cute-20": "Daily list",
    },
  },
  {
    id: "planner",
    label: "Retro planner",
    labels: {
      "planner-01": "Flower washi",
      "planner-02": "Lined memo",
      "planner-03": "To-do card",
      "planner-04": "Memories card",
      "planner-05": "Diagonal washi",
      "planner-06": "Dotty washi",
      "planner-07": "Pastel stripe washi",
      "planner-08": "Heart flag",
      "planner-09": "“Today” flag",
      "planner-10": "Polka flag",
      "planner-11": "Happy cloud",
      "planner-12": "Orange stripe washi",
      "planner-13": "“I love you” heart",
      "planner-14": "“Ok” badge",
      "planner-15": "“Yes!” badge",
      "planner-16": "“Done” badge",
      "planner-17": "Navy dot washi",
    },
  },
  {
    id: "party",
    label: "Party",
    labels: {
      "party-01": "Birthday banner",
      "party-02": "Bunting",
      "party-03": "Big star",
      "party-04": "Diamond paper",
      "party-05": "Party ribbon",
      "party-06": "Zigzag ribbon",
      "party-07": "Invitation ribbon",
      "party-08": "Rosette",
      "party-09": "Gift box",
      "party-10": "Sky star",
      "party-11": "Star-dot paper",
      "party-12": "Coral star",
      "party-13": "Gift tag",
      "party-14": "Striped ribbon",
      "party-15": "Mint tag",
      "party-16": "Zigzag paper",
      "party-17": "“Surprise!” label",
      "party-18": "Chevrons",
    },
  },
  {
    id: "backdrops",
    label: "Backdrops",
    labels: {
      "rustic-kraft": "Kraft board",
      "rustic-stone": "Stone notes board",
      "rustic-board": "Botanical mood board",
      "notepad-coral": "Coral goals page",
    },
  },
];

const BY_ID = new Map([...manifest.pieces, ...manifest.backdrops].map((p) => [p.id, p]));

/** @typedef {{ id: string, label: string, src: string, width: number, height: number }} ScrapbookArt */

/** @type {{ id: string, label: string, items: ScrapbookArt[] }[]} */
export const ART_SECTIONS = SECTIONS.map(({ id, label, labels }) => ({
  id,
  label,
  items: Object.entries(labels)
    .filter(([pieceId]) => BY_ID.has(pieceId))
    .map(([pieceId, pieceLabel]) => ({ ...BY_ID.get(pieceId), label: pieceLabel })),
}));

const ART = new Map(ART_SECTIONS.flatMap((s) => s.items).map((a) => [a.id, a]));

/** @returns {ScrapbookArt | undefined} */
export const findArt = (artId) => ART.get(artId);

// Recolor presets for art stickers. Raster art can't take a new `fill`, so
// recoloring is a CSS filter: a tone preset plus an optional hue shift.
export const ART_TONES = [
  { id: "original", label: "Original", filter: "" },
  { id: "warm", label: "Warm", filter: "sepia(0.55) saturate(1.2)" },
  { id: "faded", label: "Faded", filter: "saturate(0.5) brightness(1.08) contrast(0.92)" },
  { id: "vivid", label: "Vivid", filter: "saturate(1.7) contrast(1.05)" },
  { id: "mono", label: "Mono", filter: "grayscale(1) contrast(1.05)" },
  { id: "noir", label: "Noir", filter: "grayscale(1) brightness(0.55) contrast(1.4)" },
];

/** CSS `filter` for an art sticker's tone, hue shift and optional drop shadow. */
export function artFilter({ tone, hue }, shadow = "") {
  const parts = [ART_TONES.find((t) => t.id === tone)?.filter, hue ? `hue-rotate(${hue}deg)` : "", shadow];
  return parts.filter(Boolean).join(" ") || "none";
}
