import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { useTour } from "../../lib/tour";
import { useAuth } from "../../lib/auth";
import "./Tour.css";

/**
 * Each step lives on `route` (the overlay navigates there) and spotlights the
 * first of its `targets` (data-tour attributes on the real UI) that exists.
 * `scrollTo` brings a section of the page's scroll container into view first;
 * `onEnter` sets the UI up; `preview` names UI the step's page shows while it
 * is current (see useTour().preview). No matching target — say the create signpost for
 * a read-only account — falls back to a centered card.
 */
const ALL_STEPS = [
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
    body: "Scroll, drag the slider, or use the ‹ › arrows to explore your stories.",
    editNote: "Click your avatar in the top-right corner to update your profile picture and display settings.",
  },
  {
    route: "/blogs",
    targets: ['[data-tour="gallery"]', '[data-tour="nav-menu"]'],
    title: "Browse Your Gallery",
    body: "Find every photo and video in one place, including those from your stories. Filter by continent, country, or year.",
    editNote: "Upload new photos anytime.",
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
    // GlobeExplorer opens a preview of the naming dialog for this step and
    // closes it on the way out.
    route: "/",
    requiresEdit: true,
    targets: ['[data-tour="pin-name"]'],
    scrollTo: '[data-tour="globe"]',
    onEnter: () => window.dispatchEvent(new CustomEvent("tour:pin-preview", { detail: true })),
    onExit: () => window.dispatchEvent(new CustomEvent("tour:pin-preview", { detail: false })),
    title: "Create Your Pin",
    body: "However you drop it, you'll name your pin and add an optional note, then save. From the pin, write a new story or attach ones you've already published.",
  },
];

const REVISIT_HINT = " Want to revisit the tour? Click the ? button anytime.";

const PAD = 8;
const GAP = 14;
const MARGIN = 16;
// While changing pages or scrolling, give the target a moment to appear
// before falling back to the centered card.
const TARGET_GRACE_MS = 1200;

// Consecutive steps sharing a `group` count as one numbered step with
// lettered parts (3a, 3b, 3c); a group of one keeps its plain number.
function stepLabels(steps) {
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

// Skips targets that are in the DOM but not rendered (`display: none`), e.g.
// nav pills that move into the phone menu.
const findTarget = (targets) =>
  targets.map((t) => document.querySelector(t)).find((el) => el?.getClientRects().length) ?? null;

const clamp = (v, min, max) => Math.max(min, Math.min(v, max));

// Below, then above, then beside the target; if it fills the screen (the
// globe), float inside it near the bottom edge.
function placePopover(rect, w, h, vw, vh) {
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

// The part of the element actually on screen, or null if none of it is.
function visibleRect(el) {
  const r = el.getBoundingClientRect();
  const top = Math.max(r.top, 0);
  const left = Math.max(r.left, 0);
  const bottom = Math.min(r.bottom, window.innerHeight);
  const right = Math.min(r.right, window.innerWidth);
  if (bottom <= top || right <= left) return null;
  return { top, left, width: right - left, height: bottom - top };
}

function TourOverlay({ onFinish, onSkip }) {
  const { canEdit } = useAuth();
  const { setPreview } = useTour();
  const STEPS = useMemo(() => ALL_STEPS.filter((s) => !s.requiresEdit || canEdit), [canEdit]);
  const { total, labels } = useMemo(() => stepLabels(STEPS), [STEPS]);
  const [rawIndex, setIndex] = useState(0);
  const [layout, setLayout] = useState({ rect: null, pending: true, popH: 0, vw: 0, vh: 0 });
  const popRef = useRef(null);
  const rootRef = useRef(null);
  const dragControls = useDragControls();
  const primaryRef = useRef(null);
  const titleId = useId();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // STEPS shrinks if auth settles to a viewer mid-tour; stay in range.
  const index = Math.min(rawIndex, STEPS.length - 1);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const next = () => (isLast ? onFinish() : setIndex(index + 1));
  const prev = () => setIndex(Math.max(0, index - 1));

  useEffect(() => {
    if (pathname !== step.route) navigate(step.route);
  }, [step, pathname, navigate]);

  useEffect(() => setPreview(step.preview ?? null), [step, setPreview]);

  useEffect(() => {
    step.onEnter?.();
    // After the step's UI mounts, so an autofocused field (the pin dialog's
    // name input) doesn't take keyboard focus from the tour.
    const frame = requestAnimationFrame(() => primaryRef.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(frame);
      step.onExit?.();
    };
  }, [step]);

  // Track the target every frame: it can move or resize under us (smooth
  // scrolling, panels animating open, window resizes).
  useEffect(() => {
    const startedAt = performance.now();
    let scrolled = false;
    let lastKey = "";
    let frame;
    const tick = () => {
      if (!scrolled && step.scrollTo) {
        const scrollEl = document.querySelector(step.scrollTo);
        if (scrollEl) {
          scrollEl.scrollIntoView({ behavior: "smooth", block: "start" });
          scrolled = true;
        }
      }
      const el = findTarget(step.targets);
      const rect = el ? visibleRect(el) : null;
      const pending = !el && performance.now() - startedAt < TARGET_GRACE_MS;
      const popH = popRef.current?.offsetHeight ?? 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const key = JSON.stringify([rect, pending, popH, vw, vh]);
      if (key !== lastKey) {
        lastKey = key;
        setLayout({ rect, pending, popH, vw, vh });
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onSkip();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const { rect, pending, popH, vw, vh } = layout;
  const popW = Math.min(280, vw - MARGIN * 2);
  const pos = placePopover(rect, popW, popH, vw, vh);
  const spotlight = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : { top: vh / 2, left: vw / 2, width: 0, height: 0 };

  return (
    <div className="tour-root" ref={rootRef}>
      {/* Swallows clicks so the globe/feed can't be poked mid-step. */}
      <div className="tour-blocker" />
      <div className={`tour-spotlight${rect ? "" : " is-empty"}`} style={spotlight} aria-hidden="true" />

      {/* Draggable out of the way of the spotlit UI; buttons stay clickable
          and the remount on each step (key) snaps it back into place. */}
      <motion.div
        key={index}
        ref={popRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="tour-popover"
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={rootRef}
        onPointerDown={(e) => {
          if (!e.target.closest("button")) dragControls.start(e);
        }}
        style={{ width: popW, left: pos.left, top: pos.top, visibility: pending || !popH ? "hidden" : "visible" }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="tour-popover-head">
          <span className="tour-step-count">
            Step {labels[index]} of {total}
          </span>
          <button type="button" className="tour-close" onClick={onSkip} aria-label="Skip tour" title="Skip tour">
            <X size={16} />
          </button>
        </div>
        <h2 id={titleId} className="tour-title">{step.title}</h2>
        <p className="tour-body">
          {step.body}
          {canEdit && step.editNote && ` ${step.editNote}`}
          {isLast && REVISIT_HINT}
        </p>

        <div className="tour-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={i === index ? "is-active" : ""} />
          ))}
        </div>

        <div className="tour-actions">
          <button type="button" className="tour-btn tour-btn--ghost" onClick={onSkip}>
            Skip
          </button>
          <div className="tour-actions-nav">
            <button type="button" className="tour-btn tour-btn--secondary" onClick={prev} disabled={index === 0}>
              Previous
            </button>
            <button ref={primaryRef} type="button" className="tour-btn tour-btn--primary" onClick={next}>
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function Tour() {
  const { isActive, finish, skip } = useTour();
  if (!isActive) return null;
  return <TourOverlay onFinish={finish} onSkip={skip} />;
}
