import { useEffect, useRef } from "react";

const LINE_PX = 16;
/** Finger travel before a touch commits to an axis. */
const AXIS_LOCK_PX = 8;
/** How far (ms of current velocity) a released swipe keeps coasting. */
const FLING_MS = 220;
/** Fraction of the viewport width an arrow key rides. */
const KEY_STEP = 0.25;

const isEditable = (el) => el instanceof Element && !!el.closest("input, textarea, select, [contenteditable='true']");

/** True when something between `el` and `root` scrolls sideways on its own (e.g. a chip row) and should keep the gesture. */
function scrollsSideways(el, root) {
  for (let node = el; node && node !== root; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth) {
      const { overflowX } = getComputedStyle(node);
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
  }
  return false;
}

/**
 * The trail is ridden by vertical page scroll (see useTrailScroll); this feeds sideways input
 * into that same scroll so it rides too, with no second source of truth:
 * - trackpad side-swipes and shift+wheel
 * - horizontal touch drags (vertical drags stay native), with a short coast on release
 * - ← / → keys
 * Moving right (swipe content left, drag finger left, →) rides forward; the opposite rides back.
 * `scrollPerPx` is page scroll per px of sideways input.
 */
export function useHorizontalRide(stageRef, { scrollPerPx = 1, enabled = true, reduceMotion = false } = {}) {
  const opts = useRef({ scrollPerPx, enabled, reduceMotion });
  opts.current = { scrollPerPx, enabled, reduceMotion };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ride = (dx, behavior = "instant") => window.scrollBy({ top: dx * opts.current.scrollPerPx, behavior });

    const onWheel = (e) => {
      if (!opts.current.enabled || e.ctrlKey) return; // ctrl+wheel is pinch-zoom
      // Firefox reports shift+wheel as deltaY; Chromium already swaps it into deltaX.
      const raw = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      if (!raw || (!e.shiftKey && Math.abs(e.deltaX) <= Math.abs(e.deltaY))) return;
      if (scrollsSideways(e.target, stage)) return;
      const unit = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? window.innerWidth : 1;
      e.preventDefault(); // also stops the browser's swipe-to-go-back
      ride(raw * unit);
    };

    let touch = null;
    const onTouchStart = (e) => {
      if (!opts.current.enabled || e.touches.length !== 1 || isEditable(e.target) || scrollsSideways(e.target, stage)) {
        touch = null;
        return;
      }
      const { clientX, clientY } = e.touches[0];
      touch = { x0: clientX, y0: clientY, x: clientX, t: e.timeStamp, v: 0, axis: null };
    };
    const onTouchMove = (e) => {
      if (!touch || e.touches.length !== 1) return;
      const { clientX, clientY } = e.touches[0];
      if (!touch.axis) {
        const ax = Math.abs(clientX - touch.x0);
        const ay = Math.abs(clientY - touch.y0);
        if (Math.max(ax, ay) < AXIS_LOCK_PX) return;
        touch.axis = ax > ay ? "x" : "y";
      }
      if (touch.axis !== "x") return;
      const dx = touch.x - clientX;
      const dt = Math.max(e.timeStamp - touch.t, 1);
      touch.v = 0.8 * (dx / dt) + 0.2 * touch.v;
      touch.x = clientX;
      touch.t = e.timeStamp;
      ride(dx);
    };
    const onTouchEnd = () => {
      if (touch?.axis === "x" && !opts.current.reduceMotion && Math.abs(touch.v) > 0.2) {
        ride(touch.v * FLING_MS, "smooth");
      }
      touch = null;
    };

    const onKeyDown = (e) => {
      if (!opts.current.enabled || e.altKey || e.ctrlKey || e.metaKey || isEditable(e.target)) return;
      const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      ride(dir * window.innerWidth * KEY_STEP, opts.current.reduceMotion ? "instant" : "smooth");
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchmove", onTouchMove, { passive: true });
    stage.addEventListener("touchend", onTouchEnd);
    stage.addEventListener("touchcancel", onTouchEnd);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
      stage.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [stageRef]);
}
