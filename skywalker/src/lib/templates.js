// Post templates: the built-in starter set plus helpers shared by the editor's
// gallery. Saved templates live in blogStore's `templates` collection; both
// kinds go through normalizeTemplate so older or partial rows (no canvas, no
// vibes, a null `blocks`) can't break the gallery or the editor.
//
// Built-ins are classified one of two ways:
// - `aesthetic`: a template with a strong look of its own, grouped in the
//   gallery under that named vibe (TEMPLATE_AESTHETICS). Every vibe comes in
//   each of the TEMPLATE_LAYOUTS, recorded as the template's `layout`;
// - `palette`: a layout-first template with no distinct look, filed under its
//   dominant color (TEMPLATE_PALETTES). Saved templates get a palette derived
//   from their paper color, so the color filter covers them too.
// `aesthetic` is unrelated to `vibes`, which are the post's trip vibe tags.
//
// Templates never use ruled papers, ruled notes or flat tape strips as
// dividers: the story's parts are set apart by stamps, motifs and memo boxes.

import { blocksToCanvas } from "./canvasConvert";
import {
  createArtStickerElement,
  createDecorElement,
  createEmptyCanvasDoc,
  createImageElement,
  createNoteElement,
  createPolaroidElement,
  createSectionElement,
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
 *   layout: ?string,
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
  {
    id: "vintage-travelogue",
    label: "Vintage Travelogue",
    description: "An old-world journal: airmail stamps, pressed botanicals and torn craft paper.",
  },
  {
    id: "backpacking-camp",
    label: "Backpacking & Mountaineering",
    description: "A rugged trail log on topo-map kraft, with compass pins and ticket stubs.",
  },
  {
    id: "cute-lively",
    label: "Cute, Fun & Lively",
    description: "A pastel sticker book: washi-taped photos, doodled stars and hearts.",
  },
  {
    id: "autumn-journal",
    label: "Autumn Journey",
    description: "Cozy harvest pages in amber and rust, maple leaves and textured memo notes.",
  },
];

/** The structures every vibe comes in, in picker order. */
export const TEMPLATE_LAYOUTS = [
  { id: "journal", label: "Journal", description: "One long column: hero photo, chaptered story, photos tucked between." },
  { id: "gallery", label: "Photo-led", description: "Big photo spreads and prints, the story told in memos and captions." },
  { id: "itinerary", label: "Day by day", description: "A trip plan, then a zig-zag of day cards, each with its own photo." },
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
export const findLayout = (id) => TEMPLATE_LAYOUTS.find((l) => l.id === id) ?? null;

const H1 = { fontFamily: "serif", fontSize: 36, fontWeight: 700 };
const H2 = { fontFamily: "serif", fontSize: 24, fontWeight: 700 };
const BODY = { fontFamily: "sans", fontSize: 17, color: "#334155" };

// Stacks elements in the order given (nested lists are flattened), so later ones sit on top.
function page(paper, elements) {
  const doc = createEmptyCanvasDoc();
  doc.theme.paper = paper;
  doc.elements = elements.flat(Infinity).map((el, i) => ({ ...el, zIndex: i + 1 }));
  return doc;
}

const text = (html, x, y, width, height, style = BODY) => createTextElement({ html, x, y, width, height, ...style });

/** An illustrated piece whose longer side is `size` px; `look` sets its tone. */
function art(artId, x, y, size, rotation = 0, look = {}) {
  const piece = findArt(artId);
  const scale = size / Math.max(piece.width, piece.height);
  return createArtStickerElement(piece, {
    x,
    y,
    width: Math.round(piece.width * scale),
    height: Math.round(piece.height * scale),
    rotation,
    ...look,
  });
}

const WARM = { tone: "warm" };
const FADED = { tone: "faded" };
const cycle = (list, i) => list[i % list.length];

// --- Vibes ---------------------------------------------------------------
//
// A vibe is a kit: its paper, type and the tactile pieces it decorates with.
// A layout is a structure that asks its kit for those pieces at fixed spots:
// `tape` holds a photo down, `mark` opens a chapter (where a rule would have
// gone), `margin` fills a gutter, and `masthead`, `memoTrim`, `stamp` and
// `signoff` dress the title, memo boxes, trip plan and last lines. Each
// vibe × layout pair is one built-in template.

/** A torn-edged photo held down by tape across two of its top corners. */
const tapeCorners = (kit, x, y, width, i) => [kit.tape(x - 36, y - 14, -32, i), kit.tape(x + width - 114, y - 14, 32, i + 1)];

const polaroid = (kit, x, y, rotation, html) => createPolaroidElement({ x, y, rotation, html, ...kit.caption });

/** A memo box (section element) carrying a heading and a paragraph, with its corner dressed. */
function memo(kit, i, x, y, width, height, heading, body) {
  const box = createSectionElement({ x, y, width, height, ...kit.memo(i) });
  const pad = 24;
  return [
    box,
    text(heading, x + pad, y + pad, width - pad * 2, 44, { ...kit.h2, attachedTo: box.id }),
    text(body, x + pad, y + pad + 56, width - pad * 2, height - pad * 2 - 56, { ...kit.body, attachedTo: box.id }),
    kit.memoTrim(x, y, width, i),
  ];
}

const header = (kit, tpl) => [
  kit.masthead(560, 36),
  text(kit.copy.kicker, 64, 52, 470, 28, kit.kicker),
  text(`${tpl.title}…`, 64, 88, 470, 70, kit.h1),
  text(kit.copy.dek, 64, 166, 470, 60, kit.dek),
];

/** One long column: hero, chapters marked by motifs, a memo box, a photo pair and a pull quote. */
function journalLayout(kit, tpl) {
  const c = kit.copy;
  const image = (x, y, width, height, rotation = 0) => createImageElement({ x, y, width, height, rotation, radius: kit.radius });
  return [
    header(kit, tpl),
    image(64, 250, 666, 380),
    tapeCorners(kit, 64, 250, 666, 0),

    kit.mark(64, 676, 0),
    text(c.chapters[0], 132, 680, 340, 44, kit.h2),
    text(c.story, 64, 740, 400, 240, kit.body),
    polaroid(kit, 500, 690, 4, c.captions[0]),
    kit.tape(540, 672, -6, 2),

    memo(kit, 0, 64, 1080, 666, 300, c.chapters[1], c.story2),

    image(64, 1440, 320, 240, -2),
    image(410, 1460, 320, 240, 2),
    kit.tape(150, 1424, -8, 1),
    kit.tape(500, 1444, 10, 2),

    kit.mark(64, 1756, 1),
    text(c.chapters[2], 132, 1760, 340, 44, kit.h2),
    text(c.story, 64, 1820, 400, 220, kit.body),
    kit.note(490, 1780, 3, c.note),

    kit.margin(30, 2080, 0),
    text(c.quote, 190, 2110, 420, 110, kit.quote),
    kit.margin(624, 2090, 2),

    kit.signoff(64, 2320),
  ];
}

/** Photo-led: a three-photo mosaic, a contact sheet of prints, a memo, a panorama and the clip. */
function galleryLayout(kit, tpl) {
  const c = kit.copy;
  const image = (x, y, width, height) => createImageElement({ x, y, width, height, radius: kit.radius });
  return [
    header(kit, tpl),
    image(64, 250, 420, 520),
    tapeCorners(kit, 64, 250, 420, 0),
    image(510, 250, 220, 250),
    image(510, 520, 220, 250),
    kit.tape(545, 236, 8, 2),
    kit.note(290, 680, 4, c.note),

    kit.mark(64, 920, 0),
    text(c.chapters[0], 132, 924, 340, 44, kit.h2),
    polaroid(kit, 60, 990, -4, c.captions[0]),
    polaroid(kit, 282, 1010, 3, c.captions[1]),
    polaroid(kit, 504, 986, -2, c.captions[2]),
    kit.tape(105, 974, -10, 0),
    kit.tape(540, 970, 8, 1),

    memo(kit, 0, 64, 1340, 666, 280, c.chapters[1], c.story2),

    image(64, 1680, 666, 300),
    tapeCorners(kit, 64, 1680, 666, 1),

    kit.mark(64, 2026, 1),
    text(c.chapters[2], 132, 2030, 260, 76, kit.h2),
    text(c.story, 64, 2116, 320, 170, kit.body),
    kit.mark(410, 2026, 2),
    text(c.chapters[3], 478, 2030, 252, 76, kit.h2),
    text(c.story2, 410, 2116, 320, 170, kit.body),

    createViewfinderElement("viewfinder", { x: 64, y: 2320, html: c.rec }),
    kit.note(470, 2340, -3, c.soundtrack),

    kit.signoff(64, 2650),
  ];
}

/** Day by day: the trip plan, three zig-zagging day cards, the last day's prints and a look back. */
function itineraryLayout(kit, tpl) {
  const c = kit.copy;
  const days = [0, 1, 2].map((d) => {
    const y = 560 + d * 400;
    const left = d % 2 === 0;
    const imageX = left ? 64 : 390;
    return [
      createImageElement({ x: imageX, y, width: 340, height: 260, rotation: left ? -2 : 2, radius: kit.radius }),
      kit.tape(imageX + 95, y - 16, left ? -8 : 8, d),
      memo(kit, d + 1, left ? 430 : 64, y + 30, 300, 260, `${c.day} ${d + 1} · …`, c.dayCopy),
      // Stepping stones down the zig-zag, between one day and the next.
      kit.mark(370, y + 306, d + 1),
    ];
  });
  return [
    header(kit, tpl),
    memo(kit, 0, 64, 250, 400, 230, c.planTitle, c.plan),
    kit.stamp(510, 262, 6),
    days,

    kit.mark(64, 1770, 0),
    text(c.lastDay, 132, 1774, 340, 44, kit.h2),
    polaroid(kit, 72, 1840, -3, c.captions[0]),
    polaroid(kit, 300, 1856, 2, c.captions[1]),
    kit.tape(118, 1824, -10, 0),
    kit.note(540, 1860, 4, c.nextTime),
    kit.margin(610, 2150, 0),

    text(c.lookingBack, 64, 2180, 500, 44, kit.h2),
    text(c.story, 64, 2236, 500, 160, kit.body),

    kit.signoff(64, 2460),
  ];
}

const LAYOUT_BUILDERS = { journal: journalLayout, gallery: galleryLayout, itinerary: itineraryLayout };

const vintageKit = {
  paper: { style: "parchment", color: "#f1e3c3" },
  radius: 2,
  h1: { fontFamily: "display", fontSize: 40, fontWeight: 700, color: "#4a2f1b" },
  h2: { fontFamily: "serif", fontSize: 26, fontWeight: 700, color: "#4a2f1b" },
  dek: { fontFamily: "serif", fontSize: 18, fontStyle: "italic", color: "#7c5a3a" },
  kicker: { fontFamily: "mono", fontSize: 14, fontWeight: 700, color: "#9a3412" },
  body: { fontFamily: "serif", fontSize: 17, color: "#4a2f1b" },
  quote: { fontFamily: "script", fontSize: 30, align: "center", color: "#7c5a3a" },
  caption: { fontFamily: "hand", color: "#4a2f1b" },
  memo: (i) => ({ color: cycle(["#f8eed8", "#ead5b0"], i), texture: "parchment", radius: 4 }),
  note: (x, y, rotation, html) =>
    createNoteElement("sticky", { x, y, rotation, html, paperColor: "#f6e7c8", tapeColor: "#d6b98c", color: "#4a2f1b" }),
  tape: (x, y, rotation, i) => art(cycle(["washi-03", "washi-09", "washi-04"], i), x, y, 150, rotation, FADED),
  // Pressed botanicals in place of chapter rules.
  mark: (x, y, i) => art(cycle(["winter-07", "winter-05", "autumn-04", "winter-02"], i), x, y, 56, -20 + (i % 3) * 14, WARM),
  margin: (x, y, i) =>
    cycle(
      [
        () => art("winter-02", x, y, 150, -14, WARM),
        () => art("cinematic-09", x, y, 150, 6),
        () => art("oldschool-07", x, y, 130, -5),
        () => art("autumn-19", x, y, 140, 12, WARM),
      ],
      i
    )(),
  masthead: (x, y) => [
    art("winter-02", x + 70, y - 12, 140, 24, WARM),
    createDecorElement("stamp-postage", { x, y, rotation: 6, tint: "#1d4ed8", html: "Par avion" }),
  ],
  // A torn craft-paper scrap caught over the memo's corner.
  memoTrim: (x, y, width, i) => art(cycle(["oldschool-11", "oldschool-12"], i), x + width - 96, y - 28, 110, 8),
  stamp: (x, y, rotation) => createDecorElement("stamp-postage", { x, y, rotation, tint: "#b91c1c", html: "Poste restante" }),
  signoff: (x, y) => [
    text("Yours, from somewhere far away,", x, y, 420, 44, { fontFamily: "script", fontSize: 28, color: "#7c5a3a" }),
    text("…", x, y + 50, 300, 44, { fontFamily: "hand", fontSize: 30, color: "#4a2f1b" }),
    art("cinematic-13", 500, y - 30, 210, 6),
    createDecorElement("stamp-seal", { x: 360, y: y + 30, tint: "#9a3412", html: "V" }),
  ],
  copy: {
    kicker: "Par avion · Vol. I",
    dek: "Postmarked somewhere far from home: the long letter I never got round to sending.",
    chapters: ["Chapter one: Arrival", "Chapter two: Getting lost", "Chapter three: Slow days", "Chapter four: Leaving"],
    story: "Begin where the story begins: the train window, the first coffee, the street that made you stop. Write it the long way round.",
    story2: "The people you met, the wrong turns worth taking, and the small things you'd hate to forget.",
    captions: ["Wish you were here", "Postcard view", "The old town"],
    note: "Kept in my pocket:<br>• <br>• <br>• ",
    quote: "“The line you'd underline…”",
    rec: "REC ● Reel 01",
    soundtrack: "On the gramophone:<br>♪ <br>♪ ",
    planTitle: "The grand tour",
    plan: "Cities, trains and the order I took them in, plus the one stop I'd never skip.",
    day: "Day",
    dayCopy: "Morning, afternoon, evening: where the day took me.",
    lastDay: "The last morning",
    nextTime: "Next time:<br>…",
    lookingBack: "Looking back",
  },
};

const campKit = {
  paper: { style: "topo", color: "#d8c3a0" },
  radius: 4,
  h1: { fontFamily: "marker", fontSize: 46, color: "#1f3a2b" },
  h2: { fontFamily: "marker", fontSize: 30, color: "#1f3a2b" },
  dek: { fontFamily: "sans", fontSize: 17, color: "#4b3b26" },
  kicker: { fontFamily: "mono", fontSize: 14, fontWeight: 700, color: "#c2410c" },
  body: { fontFamily: "sans", fontSize: 16, color: "#2f2a1f" },
  quote: { fontFamily: "marker", fontSize: 30, align: "center", color: "#1f3a2b" },
  caption: { fontFamily: "marker", color: "#1f3a2b" },
  memo: (i) => (i % 2 ? { color: "#ece1c8", texture: "recycled", radius: 6 } : { color: "#c9a87c", texture: "kraft", radius: 6 }),
  note: (x, y, rotation, html) =>
    createNoteElement("sticky", { x, y, rotation, html, paperColor: "#fed7aa", tapeColor: "#a8865a", color: "#2f2a1f" }),
  tape: (x, y, rotation, i) =>
    i % 2
      ? createDecorElement("washi-plain", { x, y, rotation, width: 150, height: 34, tint: "#a8865a" })
      : art("washi-05", x, y, 150, rotation),
  // Compass pins and trail markers in place of chapter rules.
  mark: (x, y, i) => art(cycle(["camping-04", "travel-06", "camping2-04", "camping2-12"], i), x, y, 56, (i % 2 ? 1 : -1) * 10),
  margin: (x, y, i) =>
    cycle(
      [
        () => art("camping2-07", x, y, 150, -6),
        () => art("camping-03", x, y, 150, 4),
        () => art("travel-09", x, y, 140, -3),
        () => art("camping2-06", x, y, 130, 14),
      ],
      i
    )(),
  masthead: (x, y) => [
    art("camping2-12", x + 60, y - 10, 110, 12),
    createDecorElement("badge-location", { x: x - 4, y: y + 112, width: 200, rotation: -3, tint: "#1f3a2b", html: "Trailhead · km 0" }),
  ],
  // Ticket stubs and map pins clipped to the memo's corner.
  memoTrim: (x, y, width, i) =>
    i % 2 ? art("camping-04", x + width - 52, y - 30, 70, 12) : art("travel3-06", x + width - 130, y - 34, 150, 8),
  stamp: (x, y, rotation) => [art("travel3-06", x - 10, y + 20, 210, rotation), art("camping2-12", x + 120, y + 120, 80, -12)],
  signoff: (x, y) => [
    art("camping2-11", x, y, 120, -10),
    text("Summit log closed · elev. ____ m", x + 100, y + 20, 420, 36, { fontFamily: "mono", fontSize: 15, fontWeight: 700, color: "#c2410c" }),
    createDecorElement("badge-location", { x: x + 100, y: y + 70, width: 190, tint: "#c2410c", html: "Back at camp" }),
    art("camping2-13", 560, y - 20, 150, 6),
  ],
  copy: {
    kicker: "Trail log · Entry 01",
    dek: "Boots on, pack heavy, signal gone: every switchback and summit, written up at camp.",
    chapters: ["The approach", "Base camp", "Summit day", "The descent"],
    story: "Where the trail started, how the legs held up, and the moment the view opened. Kilometres, weather and the bits the photos miss.",
    story2: "Camp set-up, what we cooked, who snored, and the sky after the stove went out.",
    captions: ["Trailhead", "Camp 1", "From the top"],
    note: "Pack list:<br>☐ Water<br>☐ Layers<br>☐ Headlamp",
    quote: "“Worth every blister…”",
    rec: "REC ● Summit",
    soundtrack: "Campfire songs:<br>♪ <br>♪ ",
    planTitle: "The route",
    plan: "Distance, elevation gain, nights out and where we slept.",
    day: "Day",
    dayCopy: "Start, climb, camp: kilometres, weather and the best stretch of trail.",
    lastDay: "Walking out",
    nextTime: "Gear I'd swap:<br>…",
    lookingBack: "Trail notes",
  },
};

const DOODLE = { fontFamily: "hand", fontSize: 30, fontWeight: 700, color: "#f472b6" };

const cuteKit = {
  paper: { style: "dotted", color: "#fff7fb" },
  radius: 18,
  h1: { fontFamily: "marker", fontSize: 46, color: "#db2777" },
  h2: { fontFamily: "hand", fontSize: 34, fontWeight: 700, color: "#7c3aed" },
  dek: { fontFamily: "sans", fontSize: 17, color: "#6b7280" },
  kicker: { fontFamily: "marker", fontSize: 18, color: "#0ea5e9" },
  body: { fontFamily: "sans", fontSize: 16, color: "#4b5563" },
  quote: { fontFamily: "hand", fontSize: 36, fontWeight: 700, align: "center", color: "#db2777" },
  caption: { fontFamily: "hand", color: "#7c3aed" },
  memo: (i) => ({ color: cycle(["#e0f2fe", "#fce7f3", "#fef9c3", "#dcfce7"], i), texture: "clean", radius: 26 }),
  note: (x, y, rotation, html) => createNoteElement(rotation > 0 ? "heart" : "star", { x, y, rotation, html, color: "#7c3aed" }),
  tape: (x, y, rotation, i) => art(cycle(["cute-05", "planner-07", "cute-15", "planner-06", "cute-09", "cute-11"], i), x, y, 150, rotation),
  // Stars and hearts in place of chapter rules.
  mark: (x, y, i) => art(cycle(["cute-12", "cute-14", "cute-06", "party-12"], i), x, y, 56, (i % 2 ? 1 : -1) * 12),
  // A sticker plus a few hand-drawn doodles beside it.
  margin: (x, y, i) => [
    cycle(
      [
        () => art("cute-02", x, y, 110, -8),
        () => art("planner-13", x, y, 130, 6),
        () => art("travel2-04", x, y, 110, 10),
        () => art("travel3-03", x, y, 120, -6),
      ],
      i
    )(),
    text(cycle(["☆ ♡", "✿ ☆", "♡ ✦"], i), x + 6, y + 120, 110, 40, DOODLE),
  ],
  masthead: (x, y) => [art("planner-11", x + 40, y - 12, 150, -6), art("cute-08", x + 6, y + 86, 120, 8), text("☆", x + 140, y + 110, 40, 40, DOODLE)],
  memoTrim: (x, y, width, i) => art(cycle(["cute-14", "cute-12", "party-12"], i), x + width - 56, y - 26, 70, 14),
  stamp: (x, y, rotation) => [art("planner-08", x + 20, y, 150, rotation), art("cute-13", x + 140, y + 110, 70, -10)],
  signoff: (x, y) => [
    art("cute-10", x, y, 300, -4),
    text("✿ see you next adventure ✿", x + 10, y + 90, 420, 44, { fontFamily: "hand", fontSize: 28, fontWeight: 700, color: "#7c3aed" }),
    art("party-12", 560, y - 10, 110, 12),
    art("cute-14", 660, y + 80, 70, -10),
    text("♡ ☆ ♡", 520, y + 110, 120, 40, DOODLE),
  ],
  copy: {
    kicker: "✿ adventure time ✿",
    dek: "Snacks, selfies and silly little moments: the happiest trip, sticker by sticker.",
    chapters: ["First stop!", "Snack report", "Best day ever", "Bye for now"],
    story: "What we did first, what made us giggle, and the thing we'll be talking about for months. Go on, tell it all!",
    story2: "Every treat, every cute shop, and the one snack we'd fly back for.",
    captions: ["us! ♡", "yummy", "so cute"],
    note: "Faves ♡<br>☆ <br>☆ <br>☆ ",
    quote: "“Best. Trip. Ever.”",
    rec: "REC ● ♡",
    soundtrack: "On repeat:<br>♪ <br>♪ ",
    planTitle: "The plan ☆",
    plan: "Where we're going, what we're eating and who's coming along.",
    day: "Day",
    dayCopy: "What we did, what we ate, and the funniest thing that happened.",
    lastDay: "Last day ♡",
    nextTime: "Next time!<br>…",
    lookingBack: "Little highlights",
  },
};

const autumnKit = {
  paper: { style: "recycled", color: "#f2dcbc" },
  radius: 10,
  h1: { fontFamily: "serif", fontSize: 44, fontWeight: 700, color: "#7c2d12" },
  h2: { fontFamily: "serif", fontSize: 26, fontWeight: 700, fontStyle: "italic", color: "#9a3412" },
  dek: { fontFamily: "hand", fontSize: 24, color: "#92400e" },
  kicker: { fontFamily: "display", fontSize: 14, fontWeight: 700, color: "#b45309" },
  body: { fontFamily: "serif", fontSize: 17, color: "#5a3a22" },
  quote: { fontFamily: "script", fontSize: 32, align: "center", color: "#9a3412" },
  caption: { fontFamily: "hand", color: "#7c2d12" },
  // Textured memo notes in cream, amber and apricot.
  memo: (i) => ({ color: cycle(["#fbefdc", "#f4d7b0", "#fde8c8"], i), texture: "recycled", radius: 12 }),
  note: (x, y, rotation, html) =>
    createNoteElement("sticky", { x, y, rotation, html, paperColor: "#fdba74", tapeColor: "#b45309", color: "#5a2e0e" }),
  tape: (x, y, rotation, i) => art(cycle(["washi-05", "washi-03", "washi-07"], i), x, y, 150, rotation, WARM),
  // Maple and oak leaves in place of chapter rules.
  mark: (x, y, i) => art(cycle(["autumn-07", "autumn-21", "autumn-01", "autumn-09"], i), x, y, 56, -18 + (i % 3) * 16),
  margin: (x, y, i) =>
    cycle(
      [
        () => art("autumn-12", x, y, 150, 0),
        () => art("autumn-03", x, y, 150, -10),
        () => art("autumn-20", x, y, 120, 6),
        () => art("autumn-18", x, y, 110, -4),
      ],
      i
    )(),
  masthead: (x, y) => [art("autumn-21", x + 80, y - 14, 130, 22), art("autumn-07", x + 10, y + 64, 100, -16), art("autumn-08", x + 150, y + 104, 70, 30)],
  memoTrim: (x, y, width, i) => art(cycle(["autumn-01", "autumn-16", "autumn-22"], i), x + width - 50, y - 30, 80, 25),
  stamp: (x, y, rotation) => [art("autumn2-02", x - 10, y, 200, rotation), art("autumn-02", x + 150, y + 140, 60, 18)],
  signoff: (x, y) => [
    art("autumn-15", x, y, 90, -12),
    art("autumn-02", x + 64, y + 30, 64, 18),
    text("Until next season,", x + 150, y + 10, 340, 50, { fontFamily: "script", fontSize: 30, color: "#9a3412" }),
    text("…", x + 150, y + 62, 300, 44, { fontFamily: "hand", fontSize: 30, color: "#7c2d12" }),
    art("autumn-14", 560, y - 20, 140, 8),
  ],
  copy: {
    kicker: "Harvest season · Journal",
    dek: "Crunchy leaves, warm cider and long golden afternoons, written down slowly.",
    chapters: ["Golden mornings", "Orchard afternoons", "Woodsmoke evenings", "The last leaves"],
    story: "The first cold morning, the colour of the trees, the market stalls and what came home in the basket. Take your time with this one.",
    story2: "The cosy café, the long walk, the scarf you didn't need until you did.",
    captions: ["Golden hour", "Orchard", "Cosy corner"],
    note: "Seasonal finds:<br>• <br>• <br>• ",
    quote: "“Everything smelled of woodsmoke…”",
    rec: "REC ● Fall",
    soundtrack: "Fireside playlist:<br>♪ <br>♪ ",
    planTitle: "The plan",
    plan: "Markets, trails and the cosiest places to wait out the rain.",
    day: "Day",
    dayCopy: "Morning walk, long lunch, early dark: the best of the day.",
    lastDay: "The last walk",
    nextTime: "Next autumn:<br>…",
    lookingBack: "Gathered thoughts",
  },
};

const VIBE_TEMPLATES = [
  {
    aesthetic: "vintage-travelogue",
    kit: vintageKit,
    vibes: ["culture", "relaxing"],
    weather: null,
    layouts: {
      journal: {
        name: "Grand Tour Journal",
        category: "Long read",
        description: "A long letter home: hero photo, chaptered story, pressed botanicals and airmail stamps.",
        title: "Letters from ",
        excerpt: "Everything I'd have written home, if I'd found the time and the stamps.",
      },
      gallery: {
        name: "Postcard Collection",
        category: "Photo diary",
        description: "Taped prints and postcards, with the story told in parchment memos and margins.",
        title: "Postcards from ",
        excerpt: "A shoebox of prints and postmarks from the road.",
      },
      itinerary: {
        name: "Rail Pass Itinerary",
        category: "Itinerary",
        description: "City by city: each day a taped photo and a parchment memo, stamped and sealed.",
        title: "A Grand Tour of ",
        excerpt: "City by city, train by train.",
      },
    },
  },
  {
    aesthetic: "backpacking-camp",
    kit: campKit,
    vibes: ["nature"],
    weather: { condition: "cloudy", tempC: null, label: "Mountain weather", source: "manual" },
    layouts: {
      journal: {
        name: "Summit Story",
        category: "Adventure",
        description: "A rugged long read on topo-map kraft: approach, camp and summit, pinned with compass badges.",
        title: "Summiting ",
        excerpt: "Boots on, signal gone, and every switchback worth it.",
      },
      gallery: {
        name: "Trail Photo Log",
        category: "Photo diary",
        description: "Big trail photos, a contact sheet of campsite prints and a ticket-stub memo.",
        title: "On the Trail: ",
        excerpt: "Ridges, rivers and far too many photos of the tent.",
      },
      itinerary: {
        name: "Multi-Day Trek",
        category: "Itinerary",
        description: "The route, then a trek card per day on kraft, with ticket stubs and gear notes.",
        title: "Trekking ",
        excerpt: "Day by day across the range, one campsite at a time.",
      },
    },
  },
  {
    aesthetic: "cute-lively",
    kit: cuteKit,
    vibes: ["foodie", "city-walk"],
    weather: { condition: "sunny", tempC: null, label: "Sunny", source: "manual" },
    layouts: {
      journal: {
        name: "Sticker Diary",
        category: "Fun trip",
        description: "A pastel diary of the whole trip, with washi-taped photos and doodled stars and hearts.",
        title: "Fun Times in ",
        excerpt: "Snacks, selfies and the silliest little moments.",
      },
      gallery: {
        name: "Photo Booth Fun",
        category: "Photo diary",
        description: "A sticker-book spread of prints, candy-colored memos and a heart-shaped highlight.",
        title: "Snapshots from ",
        excerpt: "Too many photos and not one regret.",
      },
      itinerary: {
        name: "Happy Little Itinerary",
        category: "Itinerary",
        description: "Pastel day cards down the page, a heart-flag plan and plenty of stickers.",
        title: "Our Trip to ",
        excerpt: "What we did, what we ate, what made us laugh.",
      },
    },
  },
  {
    aesthetic: "autumn-journal",
    kit: autumnKit,
    vibes: ["nature", "relaxing"],
    weather: { condition: "cloudy", tempC: null, label: "Crisp", source: "manual" },
    layouts: {
      journal: {
        name: "Harvest Journal",
        category: "Seasonal",
        description: "A cozy long read in amber and rust, chapters marked with maple leaves.",
        title: "Autumn in ",
        excerpt: "Crunchy leaves, warm cider and long golden afternoons.",
      },
      gallery: {
        name: "Golden Hour Gallery",
        category: "Photo diary",
        description: "Big warm photos, orchard prints and textured memo notes under falling leaves.",
        title: "Fall Colors in ",
        excerpt: "Every shade of amber we could find.",
      },
      itinerary: {
        name: "Leaf-Peeping Weekend",
        category: "Itinerary",
        description: "A maple-framed plan, then a textured memo note and photo for each day.",
        title: "A Fall Weekend in ",
        excerpt: "Markets, trails and woodsmoke, day by day.",
      },
    },
  },
];

const vibeTemplates = VIBE_TEMPLATES.flatMap(({ aesthetic, kit, vibes, weather, layouts }) =>
  TEMPLATE_LAYOUTS.map(({ id: layout }) => {
    const tpl = layouts[layout];
    return {
      ...tpl,
      id: `builtin-${aesthetic}-${layout}`,
      aesthetic,
      layout,
      vibes,
      weather,
      canvas: page(kit.paper, LAYOUT_BUILDERS[layout](kit, tpl)),
    };
  })
);

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
  canvas: page({ style: "recycled", color: "#f3efe6" }, [
    text("48 Hours in …", 64, 56, 666, 60, H1),
    text("Why I went, who I went with, and what I hoped to find.", 64, 124, 666, 60),
    createDecorElement("washi-stripe", { x: 40, y: 206, width: 150, rotation: -30 }),
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
    createNoteElement("sticky", { x: 64, y: 710, width: 240, height: 260, paperColor: "#fffaf0", html: "Tasting menu<br>1. <br>2. <br>3. <br>4. " }),
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
    createImageElement({ x: 64, y: 160, width: 460, height: 320, radius: 10 }),
    createDecorElement("washi-stripe", { x: 420, y: 146, width: 150, rotation: 32, tint: "#ef4444" }),
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
    createImageElement({ x: 64, y: 180, width: 320, height: 400, radius: 18 }),
    createDecorElement("washi-grid", { x: 28, y: 168, width: 150, rotation: -32 }),
    createImageElement({ x: 410, y: 180, width: 320, height: 190, radius: 18 }),
    createNoteElement("sticky", { x: 430, y: 396, rotation: -3, paperColor: "#bbf7d0", html: "Spotted:<br>☐ <br>☐ <br>☐ " }),
    text("Field notes", 64, 610, 320, 40, { ...H2, color: "#14532d" }),
    text("The trail, the weather, the plants I had to look up later.", 64, 654, 320, 140, { ...BODY, color: "#14532d" }),
    createNoteElement("sticky", { x: 430, y: 630, rotation: 2, width: 260, height: 170, paperColor: "#dcfce7", html: "Distance: <br>Time: <br>Difficulty: " }),
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
  canvas: page({ style: "dotted", color: "#f2f7ff" }, [
    text("By the Sea in …", 64, 56, 520, 60, { ...H1, color: "#1e3a8a" }),
    createDecorElement("stamp-postage", { x: 600, y: 40, rotation: 5, html: "Greetings from the coast" }),
    createImageElement({ x: 64, y: 220, width: 320, height: 240, radius: 8 }),
    createImageElement({ x: 410, y: 220, width: 320, height: 240, radius: 8 }),
    createImageElement({ x: 64, y: 480, width: 666, height: 260, radius: 8 }),
    createDecorElement("washi-dots", { x: 620, y: 206, width: 150, rotation: 32 }),
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
    art("washi-01", 360, 178, 150, 30),
    createImageElement({ x: 510, y: 190, width: 220, height: 250, radius: 4 }),
    createImageElement({ x: 510, y: 460, width: 220, height: 250, radius: 4 }),
    text("The night, hour by hour", 64, 750, 666, 40, { ...H2, color: "#f8fafc" }),
    text("First drink, last song, and the long way home.", 64, 794, 420, 120, { ...BODY, color: "#cbd5e1" }),
    createNoteElement("sticky", { x: 520, y: 760, rotation: 3, paperColor: "#ffffff", html: "Late-night eats:<br>…" }),
  ]),
};

/** @type {PostTemplate[]} */
export const BUILT_IN_TEMPLATES = [
  ...vibeTemplates,
  weekendGetaway,
  luxuryFoodTour,
  redLetterDay,
  gardenDays,
  coastalSnapshot,
  afterDark,
].map((t) => ({
  aesthetic: null,
  layout: null,
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
    layout: aesthetic ? findLayout(raw.layout)?.id ?? null : null,
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

// Retired vibe templates, so old `?template=` links still open their closest successor.
const RETIRED_TEMPLATE_IDS = {
  "builtin-backpacking-adventure": "builtin-backpacking-camp-itinerary",
  "builtin-letters-from-abroad": "builtin-vintage-travelogue-journal",
  "builtin-scenic-road-trip": "builtin-backpacking-camp-gallery",
  "builtin-film-roll-memories": "builtin-vintage-travelogue-gallery",
  "builtin-quiet-notes": "builtin-vintage-travelogue-journal",
  "builtin-trip-planner": "builtin-cute-lively-itinerary",
  "builtin-celebration-trip": "builtin-cute-lively-gallery",
};

export const findBuiltInTemplate = (id) => {
  const current = RETIRED_TEMPLATE_IDS[id] ?? id;
  return BUILT_IN_TEMPLATES.find((t) => t.id === current) ?? null;
};
