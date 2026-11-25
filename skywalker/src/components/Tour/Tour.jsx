import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { useTour } from "../../lib/tour";
import { useAuth } from "../../lib/auth";
import { MARGIN, PAD, REVISIT_HINT, placePopover, stepLabels, tourStepsFor } from "./tourSteps";
import "./Tour.css";

// While changing pages or scrolling, give the target a moment to appear
// before falling back to the centered card.
const TARGET_GRACE_MS = 1200;

// Skips targets that are in the DOM but not rendered (`display: none`), e.g.
// nav pills that move into the phone menu.
const findTarget = (targets) =>
  targets.map((t) => document.querySelector(t)).find((el) => el?.getClientRects().length) ?? null;

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
  const STEPS = useMemo(() => tourStepsFor(canEdit), [canEdit]);
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
