// Catalog behind the "Add scrapbook element" menu. Each item's `create`
// returns a fresh canvas element; the menu renders it as its own preview.

import {
  DECOR_VARIANTS,
  NOTE_VARIANTS,
  VIEWFINDER_VARIANTS,
  createAudioElement,
  createDecorElement,
  createFrameStickerElement,
  createNoteElement,
  createPolaroidElement,
  createStickerElement,
  createViewfinderElement,
} from "./canvasElements";
import { EMOJI_STICKERS, FRAME_STICKERS, NATURE_STICKERS } from "../data/stickers";

export const SCRAPBOOK_LIBRARY = [
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
