// Section boxes (ELEMENT_KIND.SECTION): a colored, textured backdrop whose
// attached pieces (lib/canvasGroups.js) are its content. Width presets snap
// the box to the page's columns; padding is the breathing room kept between
// the box's edge and the text, photos and clips inside it.

import { ELEMENT_KIND, nextZIndex, placeOn } from "./canvasElements";
import { updateWithGroups } from "./canvasGroups";

const PAGE_MARGIN = 40;
const COLUMN_GAP = 24; // between two half-width boxes side by side
const STACK_GAP = 16; // between pieces added one under another

export const SECTION_WIDTHS = [
  { id: "full", label: "Full width" },
  { id: "half", label: "Half width" },
  { id: "compact", label: "Compact card" },
];

export const SECTION_PADDINGS = [
  { id: "sm", label: "Small", px: 16 },
  { id: "md", label: "Medium", px: 24 },
  { id: "lg", label: "Large", px: 32 },
];

export const sectionPadding = (section) => (SECTION_PADDINGS.find((p) => p.id === section.padding) ?? SECTION_PADDINGS[1]).px;

/** Box width for a width preset on a page `pageWidth` wide. */
export function sectionWidth(preset, pageWidth) {
  const full = pageWidth - PAGE_MARGIN * 2;
  if (preset === "half") return Math.round((full - COLUMN_GAP) / 2);
  if (preset === "compact") return Math.min(320, full);
  return full;
}

/** The preset a box's current width matches, or null once it's been resized by hand. */
export function activeSectionWidth(section, pageWidth) {
  return SECTION_WIDTHS.find((w) => sectionWidth(w.id, pageWidth) === section.width)?.id ?? null;
}

const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));

/** `el` narrowed to `maxWidth`: media keeps its proportions, text just rewraps. */
function fitWidth(el, maxWidth) {
  if (el.width <= maxWidth) return { width: el.width, height: el.height };
  const height = el.kind === ELEMENT_KIND.TEXT ? el.height : Math.round((el.height * maxWidth) / el.width);
  return { width: Math.round(maxWidth), height };
}

/**
 * Tucks a section's direct children inside its padding (narrowing any that
 * are too wide) and grows the box to fit the lowest of them. It never shrinks,
 * so room an author left on purpose stays. Rotated boxes are left alone.
 */
export function fitSection(doc, id) {
  const box = doc.elements.find((el) => el.id === id);
  if (box?.kind !== ELEMENT_KIND.SECTION || box.rotation) return doc;
  const pad = sectionPadding(box);
  const innerWidth = Math.max(24, box.width - pad * 2);

  const moves = [];
  let bottom = box.y + box.height - pad;
  for (const child of doc.elements.filter((el) => el.attachedTo === id)) {
    const { width, height } = fitWidth(child, innerWidth);
    const x = Math.round(clamp(child.x, box.x + pad, box.x + box.width - pad - width));
    const y = Math.round(Math.max(child.y, box.y + pad));
    if (x !== child.x || y !== child.y || width !== child.width || height !== child.height) moves.push([child.id, { x, y, width, height }]);
    bottom = Math.max(bottom, y + height);
  }

  // Grow first (without carrying the children, which keep their spots) so a
  // child moved inside still lands on the box and stays attached to it.
  const height = Math.ceil(bottom + pad - box.y);
  let next = height === box.height ? doc : { ...doc, elements: doc.elements.map((el) => (el.id === id ? { ...el, height } : el)) };
  for (const [childId, patch] of moves) next = updateWithGroups(next, childId, patch);
  return next;
}

/**
 * Adds `element` inside section `id`, centred under whatever it already
 * holds (text spans the full inner width), and grows the box to fit.
 */
export function placeInSection(doc, id, element) {
  const box = doc.elements.find((el) => el.id === id);
  const zIndex = nextZIndex(doc.elements);
  if (!box) return { ...doc, elements: [...doc.elements, { ...element, zIndex }] };
  if (box.rotation) return { ...doc, elements: [...doc.elements, { ...placeOn(box, element, 0.8), zIndex }] };

  const pad = sectionPadding(box);
  const innerWidth = Math.max(24, box.width - pad * 2);
  const kids = doc.elements.filter((el) => el.attachedTo === id);
  const top = kids.length ? Math.max(...kids.map((k) => k.y + k.height)) + STACK_GAP : box.y + pad;
  const size = element.kind === ELEMENT_KIND.TEXT ? { width: innerWidth, height: element.height } : fitWidth(element, innerWidth);
  const placed = {
    ...element,
    ...size,
    x: Math.round(box.x + (box.width - size.width) / 2),
    y: Math.round(top),
    rotation: 0,
    attachedTo: id,
    zIndex,
  };
  return fitSection({ ...doc, elements: [...doc.elements, placed] }, id);
}

/**
 * Applies a style patch (color, texture, widthPreset, padding) to a section.
 * A width preset resizes the box (its children come along) and then
 * everything is tucked back inside the padding.
 */
export function restyleSection(doc, id, patch) {
  const box = doc.elements.find((el) => el.id === id);
  if (!box) return doc;
  const geometry = {};
  if (patch.widthPreset) {
    const pageWidth = doc.size.width;
    geometry.width = sectionWidth(patch.widthPreset, pageWidth);
    geometry.x = patch.widthPreset === "full" ? PAGE_MARGIN : Math.round(clamp(box.x, 0, pageWidth - geometry.width));
  }
  const styled = updateWithGroups(doc, id, { ...patch, ...geometry });
  return "widthPreset" in patch || "padding" in patch ? fitSection(styled, id) : styled;
}
