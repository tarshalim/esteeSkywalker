import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useTour } from "../../lib/tour";
import { useAuth } from "../../lib/auth";
import "./Tour.css";

/**
 * Each step lives on `route` (the overlay navigates there) and spotlights the
 * first of its `targets` (data-tour attributes on the real UI) that exists.
 * `scrollTo` brings a section of the page's scroll container into view first;
 * `onEnter` sets the UI up. No matching target — say the create signpost for
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
  {
    route: "/blogs",
    targets: ['[data-tour="create-story"]', '[data-tour="create-blog"]'],
    onEnter: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    title: "Start a Story",
    body: "Ready to begin? Click the glowing signpost to create your first story. Each story you publish adds a new stop along the road.",
  },
  {
    // The editor is behind RequireAuth; read-only accounts skip this step
    // rather than bouncing between it and /account.
    route: "/blogs/new",
    requiresEdit: true,
    targets: ['[data-tour="editor-scrapbook"]'],
    scrollTo: '[data-tour="editor-music"]',
    title: "Create Your Scrapbook",
    body: "Click anywhere on the page to add text, photos, videos, or scrapbook elements. Choose a paper background and add music from MP3, YouTube, or Spotify. Readers can tap the spinning CD to pause the music.",
  },
  {
    route: "/blogs",
    targets: ['[data-tour="journey-controls"]'],
    title: "Explore Your Journey",
    body: "Scroll, drag the slider, or use the ‹ › arrows to explore your stories. Click your avatar in the top-right corner to update your profile picture and display settings.",
  },
  {
    route: "/blogs",
    targets: ['[data-tour="gallery"]'],
    title: "Browse Your Gallery",
    body: "Find every photo and video in one place, including those from your stories. Filter by continent, country, or year, and upload new photos anytime.",
  },
  {
    route: "/",
    targets: ['[data-tour="globe"]'],
    scrollTo: '[data-tour="globe"]',
    title: "Pin Stories on the Globe",
    body: "Open the 3D globe from the navbar or scroll down to find it. Search for a place to fly there, then use the toolbar in the bottom-left corner to leave a note.",
  },
  {
    route: "/",
    targets: ['[data-tour="annotate"]', '[data-tour="pin-dock"]'],
    scrollTo: '[data-tour="globe"]',
    title: "Drag the Pin",
    body: "Drag the floating pin onto the globe. The place beneath it updates as you move—release to leave a note there.",
  },
  {
    route: "/",
    targets: ['[data-tour="pin-click-mode"]', '[data-tour="pin-dock"]'],
    scrollTo: '[data-tour="globe"]',
    title: "Choose a Spot",
    body: "Prefer precision? Turn on click mode—or tap the pin—then choose any spot on the globe to place it exactly there.",
  },
  {
    route: "/",
    targets: ['[data-tour="pin-locate"]', '[data-tour="pin-dock"]'],
    scrollTo: '[data-tour="globe"]',
    title: "Use My Location",
    body: "Drop the pin right where you are, using your browser's location. Want to revisit the tour? Click the ? button anytime.",
  },
];

const PAD = 8;
const GAP = 14;
const MARGIN = 16;
// While changing pages or scrolling, give the target a moment to appear
// before falling back to the centered card.
const TARGET_GRACE_MS = 1200;

const findTarget = (targets) => targets.map((t) => document.querySelector(t)).find(Boolean) ?? null;

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
  const STEPS = useMemo(() => ALL_STEPS.filter((s) => !s.requiresEdit || canEdit), [canEdit]);
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState({ rect: null, pending: true, popH: 0, vw: 0, vh: 0 });
  const popRef = useRef(null);
  const primaryRef = useRef(null);
  const titleId = useId();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const next = () => (isLast ? onFinish() : setIndex((i) => i + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  useEffect(() => {
    if (pathname !== step.route) navigate(step.route);
  }, [step, pathname, navigate]);

  useEffect(() => {
    step.onEnter?.();
    primaryRef.current?.focus({ preventScroll: true });
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
  const popW = Math.min(340, vw - MARGIN * 2);
  const pos = placePopover(rect, popW, popH, vw, vh);
  const spotlight = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : { top: vh / 2, left: vw / 2, width: 0, height: 0 };

  return (
    <div className="tour-root">
      {/* Swallows clicks so the globe/feed can't be poked mid-step. */}
      <div className="tour-blocker" />
      <div className={`tour-spotlight${rect ? "" : " is-empty"}`} style={spotlight} aria-hidden="true" />

      <motion.div
        key={index}
        ref={popRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="tour-popover"
        style={{ width: popW, left: pos.left, top: pos.top, visibility: pending || !popH ? "hidden" : "visible" }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="tour-popover-head">
          <span className="tour-step-count">
            Step {index + 1} of {STEPS.length}
          </span>
          <button type="button" className="tour-close" onClick={onSkip} aria-label="Skip tour" title="Skip tour">
            <X size={16} />
          </button>
        </div>
        <h2 id={titleId} className="tour-title">{step.title}</h2>
        <p className="tour-body">{step.body}</p>

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
