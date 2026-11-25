// The guided tour's steps and layout maths, kept free of React and the DOM so
// they can be unit-tested (tourSteps.test.js). Tour.jsx renders them.

/**
 * Each step lives on `route` (the overlay navigates there) and spotlights the
 * first of its `targets` (data-tour attributes on the real UI) that exists.
 * `scrollTo` brings a section of the page's scroll container into view first;
 * `onEnter` sets the UI up; `preview` names UI the step's page shows while it
 * is current (see useTour().preview). No matching target — say the create signpost for
 * a read-only account — falls back to a centered card.
 */
const showPinPreview = () => window.dispatchEvent(new CustomEvent("tour:pin-preview", { detail: true }));
const hidePinPreview = () => window.dispatchEvent(new CustomEvent("tour:pin-preview", { detail: false }));

export const ALL_STEPS = [
  {
    route: "/blogs",
    targets: ['[data-tour="journey-header"]'],
    onEnter: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    title: "Welcome to Your Journey",
    body: "Every published story marks a stop on your travel map. Use the filters to explore by country, city, or category.",
  },
  // Creating anything needs a signed-in editor: `requiresEdit` steps are
  // left out for everyone else, and `editNote` is only appended for editors.
  {
    route: "/blogs",
    requiresEdit: true,
    targets: ['[data-tour="create-story"]', '[data-tour="create-blog"]'],
    onEnter: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    title: "Start a Story",
    body: "Ready to begin? Click the glowing signpost to create your first story. Each story you publish adds a new stop along the road.",
  },
  {
    // BlogEditor shows the template gallery while this step is current.
    route: "/blogs/new",
    requiresEdit: true,
    group: "editor",
    targets: ['[data-tour="template-gallery"]', '[data-tour="editor-templates"]'],
    preview: "template-gallery",
    title: "Explore Templates",
    body: "Tap Templates to browse ready-made layouts like Weekend Getaway or Scenic Road Trip. Hover a card to preview it, then apply it instantly. Your scrapbook page is set up for you, and anything you've already typed is kept.",
  },
  {
    route: "/blogs/new",
    requiresEdit: true,
    group: "editor",
    targets: ['[data-tour="editor-save-template"]'],
    title: "Save Your Template",
    body: "Built a layout you love? Save as Template stores the page, title, summary, vibes and weather so you can reuse it for your next story.",
  },
  {
    route: "/blogs/new",
    requiresEdit: true,
    group: "editor",
    targets: ['[data-tour="editor-scrapbook"]'],
    scrollTo: '[data-tour="editor-scrapbook"]',
    title: "Create Your Scrapbook",
    body: "Click anywhere on the page to add text, photos, videos, or scrapbook elements. Drag to move, use the corner handle to resize, and the top handle to rotate.",
  },
  {
    route: "/blogs/new",
    requiresEdit: true,
    group: "editor",
    targets: ['[data-tour="editor-paper"]'],
    title: "Choose a Paper",
    body: "Tap Paper to pick a background for your page. Undo and redo sit right beside it.",
  },
  {
    route: "/blogs/new",
    requiresEdit: true,
    group: "editor",
    targets: ['[data-tour="editor-music"]'],
    scrollTo: '[data-tour="editor-music"]',
    title: "Add Background Music",
    body: "Add music from MP3, YouTube, or Spotify. Readers can tap the spinning CD to pause the music.",
  },
  {
    route: "/blogs",
    targets: ['[data-tour="journey-controls"]'],
    title: "Explore Your Journey",
    body: "Scroll, swipe sideways, drag the slider, or use the ‹ › arrows to explore your stories. Open one to read it—readers can leave comments on any section.",
    editNote: "Click your avatar in the top-right corner to update your profile picture and display settings.",
  },
  {
    route: "/blogs",
    targets: ['[data-tour="nav-search"]', '[data-tour="nav-search-button"]'],
    title: "Search Anywhere",
    body: "The search bar follows the page you're on: signposts and stories on your journey, photos in the gallery, and pins, places and trips on the globe. Pick a result to jump straight to it.",
  },
  {
    route: "/blogs",
    targets: ['[data-tour="gallery"]', '[data-tour="nav-menu"]'],
    title: "Browse Your Gallery",
    body: "Find every photo and video in one place, including those from your stories. Filter by continent, country, or year.",
    editNote: "Upload new photos anytime.",
  },
  {
    // Hidden for read-only accounts until a trip exists, so they get the centered card.
    route: "/",
    targets: ['[data-tour="trips"]'],
    scrollTo: '[data-tour="trips"]',
    title: "Your Trips",
    body: "Each trip is a boarding pass with its stops and travel companions. Hover one (or tap its stories count) to fan out its stories, and filter trips by continent or country.",
    editNote: "Create New Trip takes you to the globe to pin where it begins.",
  },
  {
    route: "/",
    targets: ['[data-tour="globe"]'],
    scrollTo: '[data-tour="globe"]',
    title: "Explore the Globe",
    body: "Open the 3D globe from the navbar or scroll down to find it. Search for a place in the navbar to fly there, and tap a pin to read its stories.",
  },
  {
    route: "/",
    requiresEdit: true,
    targets: ['[data-tour="annotate"]', '[data-tour="pin-dock"]'],
    scrollTo: '[data-tour="globe"]',
    title: "Drag the Pin",
    body: "Use the toolbar in the bottom-left corner to leave a note. Drag the floating pin onto the globe—the place beneath it updates as you move—and release to drop it there.",
  },
  {
    route: "/",
    requiresEdit: true,
    targets: ['[data-tour="pin-click-mode"]', '[data-tour="pin-dock"]'],
    scrollTo: '[data-tour="globe"]',
    title: "Choose a Spot",
    body: "Prefer precision? Turn on click mode—or tap the pin—then choose any spot on the globe to place it exactly there.",
  },
  {
    route: "/",
    requiresEdit: true,
    targets: ['[data-tour="pin-locate"]', '[data-tour="pin-dock"]'],
    scrollTo: '[data-tour="globe"]',
    title: "Use My Location",
    body: "Drop the pin right where you are, using your browser's location.",
  },
  {
    // GlobeExplorer opens a preview of the naming dialog for these steps and
    // closes it on the way out.
    route: "/",
    requiresEdit: true,
    group: "pin",
    targets: ['[data-tour="pin-name"]'],
    scrollTo: '[data-tour="globe"]',
    onEnter: showPinPreview,
    onExit: hidePinPreview,
    title: "Create Your Pin",
    body: "However you drop it, you'll name your pin and add an optional note, then save. From the pin, write a new story or attach ones you've already published.",
  },
  {
    route: "/",
    requiresEdit: true,
    group: "pin",
    targets: ['[data-tour="pin-trip"]', '[data-tour="pin-name"]'],
    scrollTo: '[data-tour="globe"]',
    onEnter: showPinPreview,
    onExit: hidePinPreview,
    title: "Plan a Trip",
    body: "Tick Start a trip here to turn the pin into a trip: give it a name, dates and companions, then add its stops. While a trip's pin is open, click anywhere on the globe to add another stop there.",
  },
];

/** The steps a user sees: editor-only steps are left out for everyone else. */
export const tourStepsFor = (canEdit) => ALL_STEPS.filter((s) => !s.requiresEdit || canEdit);

export const REVISIT_HINT = " Want to revisit the tour? Click the ? button anytime.";

export const PAD = 8;
const GAP = 14;
export const MARGIN = 16;

// Consecutive steps sharing a `group` count as one numbered step with
// lettered parts (3a, 3b, 3c); a group of one keeps its plain number.
export function stepLabels(steps) {
  let n = 0;
  let part = 0;
  const parts = steps.map((s, i) => {
    if (s.group && steps[i - 1]?.group === s.group) part++;
    else [n, part] = [n + 1, 0];
    return { n, part };
  });
  const isGrouped = (i) => steps[i].group && (steps[i - 1]?.group === steps[i].group || steps[i + 1]?.group === steps[i].group);
  return { total: n, labels: parts.map(({ n, part }, i) => (isGrouped(i) ? `${n}${"abcdefgh"[part]}` : `${n}`)) };
}

const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

// Below, then above, then beside the target; if it fills the screen (the
// globe), float inside it near the bottom edge.
export function placePopover(rect, w, h, vw, vh) {
  if (!rect) return { left: (vw - w) / 2, top: (vh - h) / 2 };
  const top = rect.top - PAD;
  const bottom = rect.top + rect.height + PAD;
  const left = rect.left - PAD;
  const right = rect.left + rect.width + PAD;
  const cx = clamp(rect.left + rect.width / 2 - w / 2, MARGIN, vw - w - MARGIN);
  const cy = clamp(rect.top + rect.height / 2 - h / 2, MARGIN, vh - h - MARGIN);
  if (bottom + GAP + h <= vh - MARGIN) return { left: cx, top: bottom + GAP };
  if (top - GAP - h >= MARGIN) return { left: cx, top: top - GAP - h };
  if (left - GAP - w >= MARGIN) return { left: left - GAP - w, top: cy };
  if (right + GAP + w <= vw - MARGIN) return { left: right + GAP, top: cy };
  return { left: cx, top: clamp(bottom - h - 32, MARGIN, vh - h - MARGIN) };
}
