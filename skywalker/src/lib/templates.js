// Post templates: the built-in starter set plus helpers shared by the editor's
// gallery. Saved templates live in blogStore's `templates` collection; both
// kinds go through normalizeTemplate so older or partial rows (no canvas, no
// vibes, a null `blocks`) can't break the gallery or the editor.
//
// Built-ins are classified one of two ways:
// - `aesthetic`: a template with a strong look of its own, grouped in the
//   gallery under that named vibe (TEMPLATE_AESTHETICS);
// - `palette`: a layout-first template with no distinct look, filed under its
//   dominant color (TEMPLATE_PALETTES). Saved templates get a palette derived
//   from their paper color, so the color filter covers them too.
// `aesthetic` is unrelated to `vibes`, which are the post's trip vibe tags.

import { blocksToCanvas } from "./canvasConvert";
import {
  createArtStickerElement,
  createDecorElement,
  createEmptyCanvasDoc,
  createImageElement,
  createNoteElement,
  createPolaroidElement,
  createTextElement,
  createViewfinderElement,
} from "./canvasElements";
import { findArt } from "../data/scrapbookArt";

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   category: string,
 *   description: string,
 *   builtIn: boolean,
 *   aesthetic: ?string,
 *   palette: ?string,
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

/** Named design vibes, in gallery order. */
export const TEMPLATE_AESTHETICS = [
  { id: "vintage-travelogue", label: "Vintage Travelogue", description: "Kraft, airmail and postmarks — a well-travelled journal." },
  { id: "retro-polaroids", label: "Retro Polaroids", description: "Instant prints, film strips and camcorder frames." },
  { id: "minimal-editorial", label: "Minimalist Editorial", description: "Quiet paper, big type and plenty of white space." },
  { id: "pastel-planner", label: "Pastel Planner", description: "Candy-colored lists, banners and washi." },
  { id: "party-pop", label: "Party Pop", description: "Bunting, stars and rosettes for the big occasions." },
];

/** Primary color palettes for the gallery's color-circle filter. */
export const TEMPLATE_PALETTES = [
  { id: "red", label: "Red", color: "#dc2626" },
  { id: "beige", label: "Warm beige", color: "#d6b98c" },
  { id: "green", label: "Emerald green", color: "#059669" },
  { id: "blue", label: "Ocean blue", color: "#2563eb" },
  { id: "mono", label: "Dark monochrome", color: "#1e293b" },
];

export const findAesthetic = (id) => TEMPLATE_AESTHETICS.find((a) => a.id === id) ?? null;
export const findPalette = (id) => TEMPLATE_PALETTES.find((p) => p.id === id) ?? null;

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

/** An illustrated piece whose longer side is `size` px. */
function art(artId, x, y, size, rotation = 0) {
  const piece = findArt(artId);
  const scale = size / Math.max(piece.width, piece.height);
  return createArtStickerElement(piece, {
    x,
    y,
    width: Math.round(piece.width * scale),
    height: Math.round(piece.height * scale),
    rotation,
  });
}

// --- Vibes ---------------------------------------------------------------

const backpackingAdventure = {
  id: "builtin-backpacking-adventure",
  name: "Backpacking Adventure",
  category: "Adventure",
  aesthetic: "vintage-travelogue",
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
    art("washi-03", 20, 196, 180, -28),
    createNoteElement("lined", { x: 470, y: 230, rotation: 3, html: "Budget<br>Beds: <br>Transport: <br>Food: " }),
    text("The route", 64, 510, 320, 40, { ...H2, color: "#3f2d1c" }),
    text("Where I started, where I ended up, and every stop in between.", 64, 554, 320, 120, { ...BODY, color: "#3f2d1c" }),
    createNoteElement("spiral", { x: 430, y: 500, rotation: -2, html: "Gear that saved me:<br>• <br>• <br>• " }),
    createDecorElement("washi-plain", { x: 470, y: 486, rotation: -8 }),
    art("oldschool-05", 90, 700, 190, -8),
    art("cinematic-09", 440, 850, 230, 5),
  ]),
};

const lettersFromAbroad = {
  id: "builtin-letters-from-abroad",
  name: "Letters from Abroad",
  category: "Slow travel",
  aesthetic: "vintage-travelogue",
  description: "A postcard-style page: a letter home, an airmail envelope and a stamped keepsake.",
  title: "Letters from ",
  excerpt: "Everything I'd have written home, if I'd found the time and the stamps.",
  vibes: ["culture", "relaxing"],
  weather: null,
  canvas: page({ style: "parchment", color: "#f1e3c3" }, [
    text("Letters from …", 64, 56, 666, 60, { fontFamily: "display", fontSize: 38, fontWeight: 700, align: "center", color: "#5b3a1e" }),
    text("<i>Postmarked somewhere far from home.</i>", 64, 124, 666, 36, { ...BODY, fontFamily: "serif", align: "center", color: "#7c5a3a" }),
    art("cinematic-13", 60, 190, 320, -4),
    art("oldschool-08", 420, 196, 300, 3),
    text("Dear …,<br>You'd love it here.", 452, 250, 230, 170, { fontFamily: "hand", fontSize: 26, color: "#5b3a1e" }),
    createPolaroidElement({ x: 84, y: 540, rotation: 3, html: "Wish you were here" }),
    art("washi-09", 110, 522, 170, -10),
    art("oldschool-07", 352, 560, 170, -4),
    text("Postcard notes", 500, 560, 240, 40, { ...H2, color: "#5b3a1e" }),
    text("The people, the places, the little things I want to remember.", 500, 604, 240, 140, { ...BODY, color: "#5b3a1e" }),
    art("cinematic-09", 470, 800, 240, 6),
    text("Signed, sealed, delivered.", 64, 880, 380, 40, { fontFamily: "script", fontSize: 28, color: "#7c5a3a" }),
    createDecorElement("stamp-seal", { x: 320, y: 930 }),
  ]),
};

const scenicRoadTrip = {
  id: "builtin-scenic-road-trip",
  name: "Scenic Road Trip",
  category: "Road trip",
  aesthetic: "retro-polaroids",
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
    art("cinematic-07", 60, 800, 300, -6),
    createDecorElement("badge-location", { x: 480, y: 800, html: "Final stop" }),
  ]),
};

const filmRollMemories = {
  id: "builtin-film-roll-memories",
  name: "Film Roll Memories",
  category: "Photo diary",
  aesthetic: "retro-polaroids",
  description: "A contact-sheet page: film strip header, a scatter of instant prints and the clip that says it all.",
  title: "Shot on Film: ",
  excerpt: "Twenty-four exposures and not one of them in focus — perfect.",
  vibes: ["city-walk"],
  weather: null,
  canvas: page({ style: "canvas", color: "#f4f1ea" }, [
    art("cinematic-07", 520, 24, 200, 8),
    text("Shot on Film: …", 64, 64, 420, 60, { fontFamily: "marker", fontSize: 40, color: "#1e293b" }),
    text("Roll no. 1 · the best frames, uncropped.", 64, 128, 420, 36, { fontFamily: "mono", fontSize: 15, color: "#475569" }),
    createPolaroidElement({ x: 60, y: 200, rotation: -5, html: "Frame 03" }),
    createPolaroidElement({ x: 282, y: 220, rotation: 3, html: "Frame 11" }),
    createPolaroidElement({ x: 504, y: 196, rotation: -2, html: "Frame 19" }),
    art("washi-04", 330, 196, 150, 4),
    createViewfinderElement("playcard", { x: 64, y: 540, rotation: -2, html: "the moment" }),
    art("cinematic-05", 420, 540, 230, 6),
    text("Developing notes", 420, 790, 320, 40, H2),
    text("Light, place and who was behind the lens.", 420, 834, 320, 100),
    art("cinematic-16", 120, 820, 170, -8),
  ]),
};

const quietNotes = {
  id: "builtin-quiet-notes",
  name: "Quiet Notes",
  category: "Essay",
  aesthetic: "minimal-editorial",
  description: "One hero photo, an editorial headline and taped notes in soft neutrals.",
  title: "Notes on ",
  excerpt: "A slower look at a place, written the long way round.",
  vibes: ["relaxing", "city-walk"],
  weather: null,
  canvas: page({ style: "clean", color: "#fafaf7" }, [
    text("Issue 01", 64, 56, 200, 28, { fontFamily: "mono", fontSize: 13, color: "#64748b" }),
    text("Notes on …", 64, 88, 666, 80, { fontFamily: "serif", fontSize: 54, fontWeight: 700, color: "#0f172a" }),
    createImageElement({ x: 64, y: 196, width: 666, height: 360, radius: 0 }),
    art("washi-01", 300, 176, 200, -3),
    text("The long read", 64, 596, 380, 40, { ...H2, color: "#0f172a" }),
    text("What I came for, what I found instead, and the hour that changed my mind.", 64, 640, 380, 160, { ...BODY, color: "#475569" }),
    art("paper-03", 480, 596, 250, 3),
    text("Pull quote:<br>“…”", 510, 650, 190, 120, { fontFamily: "serif", fontSize: 20, fontStyle: "italic", color: "#334155" }),
    art("washi-10", 80, 860, 180, 4),
    art("paper-04", 300, 850, 210, -4),
  ]),
};

const tripPlanner = {
  id: "builtin-trip-planner",
  name: "Trip Planner",
  category: "Planning",
  aesthetic: "pastel-planner",
  description: "Countdown lists, a packing to-do and cheerful banners before you go.",
  title: "Getting Ready for ",
  excerpt: "Lists, lists and more lists — the fun part before the trip.",
  vibes: ["relaxing"],
  weather: null,
  canvas: page({ style: "dotted", color: "#fff8f1" }, [
    art("cute-07", 64, 48, 220, -3),
    text("Getting Ready for …", 64, 110, 666, 60, { fontFamily: "marker", fontSize: 40, color: "#334155" }),
    art("cute-18", 64, 200, 300),
    text("Mon …<br>Tue …<br>Wed …", 110, 290, 150, 180, { fontFamily: "hand", fontSize: 22, color: "#334155" }),
    art("cute-19", 300, 220, 290, 3),
    text("Passport<br>Chargers<br>Snacks", 340, 300, 140, 170, { fontFamily: "hand", fontSize: 22, color: "#334155" }),
    art("cute-08", 560, 200, 160, 6),
    createPolaroidElement({ x: 520, y: 400, rotation: 4, html: "Where we're going" }),
    art("cute-03", 560, 384, 200, -8),
    art("cute-16", 64, 570, 220, 2),
    text("Don't leave without…", 64, 620, 380, 120, BODY),
    art("cute-12", 420, 720, 110, -10),
    art("cute-14", 300, 740, 110, 8),
    art("cute-17", 470, 840, 220),
  ]),
};

const celebrationTrip = {
  id: "builtin-celebration-trip",
  name: "Celebration Trip",
  category: "Special occasion",
  aesthetic: "party-pop",
  description: "Birthday getaway or anniversary escape: bunting, stars, gift tags and a highlight reel.",
  title: "Celebrating in ",
  excerpt: "Candles, confetti and a trip worth raising a glass to.",
  vibes: ["foodie"],
  weather: null,
  canvas: page({ style: "colored", color: "#fdf6ec" }, [
    art("party-02", 207, 24, 380),
    text("Celebrating in …", 64, 130, 666, 60, { ...H1, align: "center", color: "#334e68" }),
    art("party-05", 247, 196, 300),
    createImageElement({ x: 64, y: 270, width: 420, height: 300, radius: 14 }),
    art("party-08", 520, 260, 200, 6),
    art("party-15", 560, 470, 180, -6),
    text("The plan:<br>…", 590, 560, 120, 90, { fontFamily: "hand", fontSize: 18, color: "#334e68", align: "center" }),
    art("party-03", 40, 600, 150, -12),
    text("Best moment", 200, 620, 300, 40, { ...H2, color: "#334e68" }),
    text("The toast, the surprise, the dessert that deserved its own post.", 200, 664, 300, 120, { ...BODY, color: "#334e68" }),
    createPolaroidElement({ x: 520, y: 720, rotation: 4, html: "Cheers!" }),
    art("party-18", 64, 840, 230),
    art("party-10", 380, 860, 110, 10),
  ]),
};

// --- Color palettes -------------------------------------------------------

const weekendGetaway = {
  id: "builtin-weekend-getaway",
  name: "Weekend Getaway",
  category: "Short break",
  palette: "beige",
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

const luxuryFoodTour = {
  id: "builtin-luxury-food-tour",
  name: "Luxury Food Tour",
  category: "Food & dining",
  palette: "beige",
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

const redLetterDay = {
  id: "builtin-red-letter-day",
  name: "Red Letter Day",
  category: "Day trip",
  palette: "red",
  description: "One unforgettable day: a big photo, a timeline and the highlight on a sticky note.",
  title: "The Day We ",
  excerpt: "Some days earn a red circle on the calendar. This was one.",
  vibes: ["city-walk"],
  weather: null,
  canvas: page({ style: "colored", color: "#fdecea" }, [
    text("The Day We …", 64, 56, 666, 60, { ...H1, color: "#991b1b" }),
    createDecorElement("washi-stripe", { x: 520, y: 140, tint: "#ef4444" }),
    createImageElement({ x: 64, y: 160, width: 460, height: 320, radius: 10 }),
    createNoteElement("sticky", { x: 548, y: 190, rotation: 4, paperColor: "#fecaca", html: "Highlight:<br>…" }),
    text("Morning", 64, 510, 210, 36, { ...H2, color: "#991b1b" }),
    text("Where it started.", 64, 550, 210, 100),
    text("Afternoon", 292, 510, 210, 36, { ...H2, color: "#991b1b" }),
    text("The main event.", 292, 550, 210, 100),
    text("Evening", 520, 510, 210, 36, { ...H2, color: "#991b1b" }),
    text("How it ended.", 520, 550, 210, 100),
    createImageElement({ x: 64, y: 680, width: 320, height: 220, radius: 10 }),
    createImageElement({ x: 410, y: 680, width: 320, height: 220, radius: 10 }),
    createDecorElement("pushpin", { x: 210, y: 664, tint: "#b91c1c" }),
  ]),
};

const gardenDays = {
  id: "builtin-garden-days",
  name: "Garden Days",
  category: "Outdoors",
  palette: "green",
  description: "Trails, parks and gardens: a photo pair, a field-notes column and a checklist.",
  title: "Green Days in ",
  excerpt: "Moss, ferns, and the kind of quiet you only find off the path.",
  vibes: ["nature"],
  weather: { condition: "cloudy", tempC: null, label: "Mild", source: "manual" },
  canvas: page({ style: "recycled", color: "#e6f2e8" }, [
    text("Green Days in …", 64, 56, 666, 60, { ...H1, color: "#14532d" }),
    createDecorElement("washi-grid", { x: 64, y: 140 }),
    createImageElement({ x: 64, y: 180, width: 320, height: 400, radius: 18 }),
    createImageElement({ x: 410, y: 180, width: 320, height: 190, radius: 18 }),
    createNoteElement("sticky", { x: 430, y: 396, rotation: -3, paperColor: "#bbf7d0", html: "Spotted:<br>☐ <br>☐ <br>☐ " }),
    text("Field notes", 64, 610, 320, 40, { ...H2, color: "#14532d" }),
    text("The trail, the weather, the plants I had to look up later.", 64, 654, 320, 140, { ...BODY, color: "#14532d" }),
    createNoteElement("lined", { x: 410, y: 640, rotation: 2, html: "Distance: <br>Time: <br>Difficulty: " }),
    createDecorElement("badge-location", { x: 410, y: 820, tint: "#15803d", html: "Trailhead" }),
  ]),
};

const coastalSnapshot = {
  id: "builtin-coastal-snapshot",
  name: "Coastal Snapshot",
  category: "Beach",
  palette: "blue",
  description: "A seaside photo grid with tide times, a postcard stamp and a beach-day list.",
  title: "By the Sea in ",
  excerpt: "Salt in the air, sand in everything, and no plans past lunch.",
  vibes: ["relaxing", "nature"],
  weather: { condition: "sunny", tempC: null, label: "Breezy", source: "manual" },
  canvas: page({ style: "graph", color: "#f2f7ff" }, [
    text("By the Sea in …", 64, 56, 520, 60, { ...H1, color: "#1e3a8a" }),
    createDecorElement("stamp-postage", { x: 600, y: 40, rotation: 5, html: "Greetings from the coast" }),
    createImageElement({ x: 64, y: 220, width: 320, height: 240, radius: 8 }),
    createImageElement({ x: 410, y: 220, width: 320, height: 240, radius: 8 }),
    createImageElement({ x: 64, y: 480, width: 666, height: 260, radius: 8 }),
    createDecorElement("washi-dots", { x: 300, y: 200, rotation: -3 }),
    createNoteElement("sticky", { x: 64, y: 770, rotation: -3, paperColor: "#bfdbfe", html: "Tide times:<br>High … <br>Low …" }),
    text("Beach day", 320, 780, 410, 40, { ...H2, color: "#1e3a8a" }),
    text("Swim spots, snack stops and where to watch the sunset.", 320, 824, 410, 120, { ...BODY, color: "#1e3a8a" }),
  ]),
};

const afterDark = {
  id: "builtin-after-dark",
  name: "After Dark",
  category: "Nightlife",
  palette: "mono",
  description: "A moody night-out page: high-contrast photos, white type and chalk tape.",
  title: "After Dark in ",
  excerpt: "Neon, late trains and the best food at 2am.",
  vibes: ["city-walk", "foodie"],
  weather: null,
  canvas: page({ style: "colored", color: "#1e2229" }, [
    text("After Dark in …", 64, 56, 666, 60, { ...H1, color: "#f8fafc" }),
    text("Where the night took us.", 64, 122, 666, 36, { ...BODY, color: "#94a3b8" }),
    createImageElement({ x: 64, y: 190, width: 420, height: 520, radius: 4 }),
    art("washi-01", 330, 170, 200, 6),
    createImageElement({ x: 510, y: 190, width: 220, height: 250, radius: 4 }),
    createImageElement({ x: 510, y: 460, width: 220, height: 250, radius: 4 }),
    text("The night, hour by hour", 64, 750, 666, 40, { ...H2, color: "#f8fafc" }),
    text("First drink, last song, and the long way home.", 64, 794, 420, 120, { ...BODY, color: "#cbd5e1" }),
    createNoteElement("sticky", { x: 520, y: 760, rotation: 3, paperColor: "#ffffff", html: "Late-night eats:<br>…" }),
  ]),
};

/** @type {PostTemplate[]} */
export const BUILT_IN_TEMPLATES = [
  backpackingAdventure,
  lettersFromAbroad,
  scenicRoadTrip,
  filmRollMemories,
  quietNotes,
  tripPlanner,
  celebrationTrip,
  weekendGetaway,
  luxuryFoodTour,
  redLetterDay,
  gardenDays,
  coastalSnapshot,
  afterDark,
].map((t) => ({
  aesthetic: null,
  palette: null,
  ...t,
  builtIn: true,
  coverImage: "",
}));

function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

/** The palette closest to a paper color; null for near-white or off-palette (e.g. purple) papers. */
export function paletteForColor(hex) {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const { h, s, l } = hsl;
  if (l < 0.3) return "mono";
  if (s < 0.15) return l < 0.5 ? "mono" : l > 0.96 ? null : "beige";
  if (h < 18 || h >= 330) return "red";
  if (h < 60) return "beige";
  if (h < 170) return "green";
  if (h < 260) return "blue";
  return null;
}

/** Fills in every field the gallery and editor read, whatever the template's age. */
export function normalizeTemplate(raw) {
  if (!raw) return null;
  const canvas = raw.canvas && Array.isArray(raw.canvas.elements) ? raw.canvas : blocksToCanvas(raw.blocks ?? []);
  const aesthetic = findAesthetic(raw.aesthetic)?.id ?? null;
  return {
    ...raw,
    name: raw.name?.trim() || raw.title?.trim() || "Untitled template",
    category: raw.category || "My template",
    description: raw.description ?? "",
    builtIn: Boolean(raw.builtIn),
    aesthetic,
    // Vibe templates stay out of the color filter; everything else gets a palette.
    palette: aesthetic ? null : findPalette(raw.palette)?.id ?? paletteForColor(canvas.theme?.paper?.color),
    title: raw.title ?? "",
    excerpt: raw.excerpt ?? "",
    coverImage: raw.coverImage ?? "",
    vibes: Array.isArray(raw.vibes) ? raw.vibes : [],
    weather: raw.weather?.condition ? raw.weather : null,
    canvas,
  };
}

export const findBuiltInTemplate = (id) => BUILT_IN_TEMPLATES.find((t) => t.id === id) ?? null;
