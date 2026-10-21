// Post templates: the built-in starter set plus helpers shared by the editor's
// gallery. Saved templates live in blogStore's `templates` collection; both
// kinds go through normalizeTemplate so older or partial rows (no canvas, no
// vibes, a null `blocks`) can't break the gallery or the editor.

import { blocksToCanvas } from "./canvasConvert";
import {
  createDecorElement,
  createEmptyCanvasDoc,
  createImageElement,
  createNoteElement,
  createPolaroidElement,
  createTextElement,
  createViewfinderElement,
} from "./canvasElements";

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   category: string,
 *   description: string,
 *   builtIn: boolean,
 *   title: string,
 *   excerpt: string,
 *   coverImage: string,
 *   vibes: string[],
 *   weather: ?import("./weather").Weather,
 *   canvas: object,
 *   blocks?: object[],
 *   createdAt?: string,
 * }} PostTemplate
 */

const H1 = { fontFamily: "serif", fontSize: 36, fontWeight: 700 };
const H2 = { fontFamily: "serif", fontSize: 24, fontWeight: 700 };
const BODY = { fontFamily: "sans", fontSize: 17, color: "#334155" };

// Stacks elements in the order given, so later ones sit on top.
function page(paper, elements) {
  const doc = createEmptyCanvasDoc();
  doc.theme.paper = paper;
  doc.elements = elements.map((el, i) => ({ ...el, zIndex: i + 1 }));
  return doc;
}

const text = (html, x, y, width, height, style = BODY) => createTextElement({ html, x, y, width, height, ...style });

const weekendGetaway = {
  id: "builtin-weekend-getaway",
  name: "Weekend Getaway",
  category: "Short break",
  description: "A two-day itinerary with snapshots, a must-do list and a day-by-day write-up.",
  title: "48 Hours in ",
  excerpt: "Two days, one bag, and a list of everything worth squeezing in.",
  vibes: ["relaxing", "city-walk"],
  weather: { condition: "sunny", tempC: null, label: "Sunny", source: "manual" },
  canvas: page({ style: "linen", color: "#f3efe6" }, [
    text("48 Hours in …", 64, 56, 666, 60, H1),
    text("Why I went, who I went with, and what I hoped to find.", 64, 124, 666, 60),
    createDecorElement("washi-stripe", { x: 120, y: 196 }),
    createPolaroidElement({ x: 72, y: 214, rotation: -4, html: "Arrival" }),
    createPolaroidElement({ x: 330, y: 230, rotation: 3, html: "Golden hour" }),
    createNoteElement("sticky", { x: 572, y: 230, rotation: 4, html: "Must-dos:<br>☐ Sunrise spot<br>☐ Local market<br>☐ Best coffee" }),
    text("Day 1", 64, 540, 320, 40, H2),
    text("Morning, afternoon, evening — the highlights and the detours.", 64, 584, 320, 120),
    text("Day 2", 410, 540, 320, 40, H2),
    text("The slow morning, the last meal, the trip home.", 410, 584, 320, 120),
    createDecorElement("stamp-seal", { x: 620, y: 740 }),
  ]),
};

const backpackingAdventure = {
  id: "builtin-backpacking-adventure",
  name: "Backpacking Adventure",
  category: "Adventure",
  description: "Route, budget and gear notes for a multi-stop trip on a shoestring.",
  title: "Backpacking Through ",
  excerpt: "Hostels, night buses and the kindness of strangers along the way.",
  vibes: ["nature", "culture"],
  weather: null,
  canvas: page({ style: "kraft", color: "#c9a87c" }, [
    createDecorElement("badge-location", { x: 64, y: 48, html: "Stop 1 of …" }),
    text("Backpacking Through …", 64, 116, 520, 60, { ...H1, color: "#3f2d1c" }),
    createDecorElement("stamp-postage", { x: 600, y: 48, rotation: 6 }),
    createImageElement({ x: 64, y: 200, width: 420, height: 280, radius: 6 }),
    createNoteElement("lined", { x: 470, y: 230, rotation: 3, html: "Budget<br>Beds: <br>Transport: <br>Food: " }),
    text("The route", 64, 510, 320, 40, { ...H2, color: "#3f2d1c" }),
    text("Where I started, where I ended up, and every stop in between.", 64, 554, 320, 120, { ...BODY, color: "#3f2d1c" }),
    createNoteElement("spiral", { x: 430, y: 500, rotation: -2, html: "Gear that saved me:<br>• <br>• <br>• " }),
    createDecorElement("washi-plain", { x: 470, y: 486, rotation: -8 }),
  ]),
};

const luxuryFoodTour = {
  id: "builtin-luxury-food-tour",
  name: "Luxury Food Tour",
  category: "Food & dining",
  description: "An elegant tasting journal: hero dish, course-by-course menu and the best bite.",
  title: "A Taste of ",
  excerpt: "Course by course through the tables worth crossing an ocean for.",
  vibes: ["foodie", "culture"],
  weather: null,
  canvas: page({ style: "parchment", color: "#f1e3c3" }, [
    text("A Taste of …", 64, 56, 666, 60, { ...H1, align: "center", color: "#5b3a1e" }),
    text("<i>Reservations, recommendations and the meal I still think about.</i>", 64, 122, 666, 40, {
      ...BODY,
      align: "center",
      fontFamily: "serif",
      color: "#7c5a3a",
    }),
    createImageElement({ x: 64, y: 190, width: 666, height: 300, radius: 16 }),
    createImageElement({ x: 64, y: 512, width: 210, height: 170, radius: 12 }),
    createImageElement({ x: 292, y: 512, width: 210, height: 170, radius: 12 }),
    createNoteElement("heart", { x: 520, y: 490, rotation: 4, html: "Best bite:<br>…" }),
    createNoteElement("spiral", { x: 64, y: 710, html: "Tasting menu<br>1. <br>2. <br>3. <br>4. " }),
    text("The verdict", 340, 720, 390, 40, { ...H2, color: "#5b3a1e" }),
    text("Service, setting, price — and whether I'd book again.", 340, 764, 390, 120, { ...BODY, color: "#5b3a1e" }),
  ]),
};

const scenicRoadTrip = {
  id: "builtin-scenic-road-trip",
  name: "Scenic Road Trip",
  category: "Road trip",
  description: "Mile markers, a dash-cam video, roadside polaroids and the trip playlist.",
  title: "On the Road: ",
  excerpt: "Windows down, playlist on, and every scenic pull-out along the way.",
  vibes: ["nature", "relaxing"],
  weather: { condition: "sunny", tempC: null, label: "Clear Skies", source: "manual" },
  canvas: page({ style: "dotted", color: "#fffefb" }, [
    createDecorElement("badge-location", { x: 64, y: 48, html: "Mile 0 · Start" }),
    text("On the Road: …", 64, 116, 666, 60, H1),
    createViewfinderElement("viewfinder", { x: 64, y: 196, html: "REC ● Day 1" }),
    createNoteElement("sticky", { x: 470, y: 200, rotation: 3, paperColor: "#bfdbfe", html: "Playlist:<br>♪ <br>♪ <br>♪ " }),
    createPolaroidElement({ x: 72, y: 480, rotation: -3, html: "Viewpoint" }),
    createPolaroidElement({ x: 300, y: 496, rotation: 2, html: "Pit stop" }),
    createDecorElement("washi-dots", { x: 520, y: 470, rotation: 6 }),
    text("The route", 540, 520, 200, 40, H2),
    text("Distance, days, and the stretch of road that stole the show.", 540, 564, 200, 160),
    createDecorElement("badge-location", { x: 480, y: 800, html: "Final stop" }),
  ]),
};

/** @type {PostTemplate[]} */
export const BUILT_IN_TEMPLATES = [weekendGetaway, backpackingAdventure, luxuryFoodTour, scenicRoadTrip].map((t) => ({
  ...t,
  builtIn: true,
  coverImage: "",
}));

/** Fills in every field the gallery and editor read, whatever the template's age. */
export function normalizeTemplate(raw) {
  if (!raw) return null;
  const canvas = raw.canvas && Array.isArray(raw.canvas.elements) ? raw.canvas : blocksToCanvas(raw.blocks ?? []);
  return {
    ...raw,
    name: raw.name?.trim() || raw.title?.trim() || "Untitled template",
    category: raw.category || "My template",
    description: raw.description ?? "",
    builtIn: Boolean(raw.builtIn),
    title: raw.title ?? "",
    excerpt: raw.excerpt ?? "",
    coverImage: raw.coverImage ?? "",
    vibes: Array.isArray(raw.vibes) ? raw.vibes : [],
    weather: raw.weather?.condition ? raw.weather : null,
    canvas,
  };
}

export const findBuiltInTemplate = (id) => BUILT_IN_TEMPLATES.find((t) => t.id === id) ?? null;
