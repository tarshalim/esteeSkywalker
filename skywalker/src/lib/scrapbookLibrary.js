// Catalog behind the "Add scrapbook element" menu. Each item's `create`
// returns a fresh canvas element; the menu renders it as its own preview.

import {
  DECOR_VARIANTS,
  NOTE_VARIANTS,
  VIEWFINDER_VARIANTS,
  createArtStickerElement,
  createAudioElement,
  createDecorElement,
  createFrameStickerElement,
  createNoteElement,
  createPolaroidElement,
  createStickerElement,
  createViewfinderElement,
} from "./canvasElements";
import { EMOJI_STICKERS, FRAME_STICKERS, NATURE_STICKERS } from "../data/stickers";
import { ART_SECTIONS } from "../data/scrapbookArt";

// Illustrated art sections, marked so the menu can offer them as their own filter.
const ART_LIBRARY = ART_SECTIONS.map((section) => ({
  id: `art-${section.id}`,
  label: section.label,
  art: true,
  items: section.items.map((art) => ({
    id: `art-${art.id}`,
    label: art.label,
    create: () => createArtStickerElement(art),
  })),
}));

/** dataTransfer type carrying a library item id while it's dragged onto the page. */
export const LIBRARY_DRAG_TYPE = "application/x-scrapbook-item";

export const SCRAPBOOK_LIBRARY = [
  ...ART_LIBRARY,
  {
    id: "notes",
    label: "Notes & memos",
    items: Object.entries(NOTE_VARIANTS).map(([variant, v]) => ({
      id: `note-${variant}`,
      label: v.label,
      create: () => createNoteElement(variant),
    })),
  },
  {
    id: "frames",
    label: "Photo & video frames",
    items: [
      { id: "polaroid", label: "Polaroid print", create: () => createPolaroidElement() },
      ...Object.entries(VIEWFINDER_VARIANTS).map(([variant, v]) => ({
        id: `viewfinder-${variant}`,
        label: v.label,
        create: () => createViewfinderElement(variant),
      })),
      ...FRAME_STICKERS.filter((f) => f.id !== "polaroid").map((f) => ({
        id: `frame-${f.id}`,
        label: `${f.label} frame`,
        create: () => createFrameStickerElement(f.id),
      })),
    ],
  },
  {
    id: "music",
    label: "Music",
    items: [
      { id: "audio-card", label: "Music card", create: () => createAudioElement("card") },
      { id: "audio-cassette", label: "Cassette player", create: () => createAudioElement("cassette") },
      { id: "audio-vinyl", label: "Vinyl player", create: () => createAudioElement("vinyl") },
    ],
  },
  {
    id: "accents",
    label: "Tape, stamps & pins",
    items: Object.entries(DECOR_VARIANTS).map(([decorId, v]) => ({
      id: `decor-${decorId}`,
      label: v.label,
      create: () => createDecorElement(decorId),
    })),
  },
  {
    id: "stickers",
    label: "Stickers",
    items: [
      ...EMOJI_STICKERS.slice(0, 12).map((s) => ({
        id: `sticker-${s.id}`,
        label: s.label,
        create: () => createStickerElement(s.id, "emoji", { char: s.char }),
      })),
      ...NATURE_STICKERS.map((s) => ({
        id: `sticker-${s.id}`,
        label: s.label,
        create: () => createStickerElement(s.id, "nature"),
      })),
    ],
  },
];

const ITEMS = new Map(SCRAPBOOK_LIBRARY.flatMap((section) => section.items.map((item) => [item.id, item])));

export const findLibraryItem = (id) => ITEMS.get(id) ?? null;

// Pieces offered in the collage's elements drawer: the illustrated sheets
// (minus page-sized backdrops), tape/stamps/pins and small stickers.
const DRAWER_SECTIONS = new Set(["accents", "stickers"]);
export const DECORATION_LIBRARY = SCRAPBOOK_LIBRARY.filter(
  (section) => (section.art && section.id !== "art-backdrops") || DRAWER_SECTIONS.has(section.id)
);
