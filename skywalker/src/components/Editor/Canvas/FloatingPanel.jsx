import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const GAP = 8; // min distance from the visible viewport edge

function viewportBounds() {
  const vv = window.visualViewport;
  const left = vv?.offsetLeft ?? 0;
  const top = vv?.offsetTop ?? 0;
  return {
    minX: left + GAP,
    minY: top + GAP,
    maxX: left + (vv?.width ?? window.innerWidth) - GAP,
    maxY: top + (vv?.height ?? window.innerHeight) - GAP,
  };
}

const clamp = (v, min, max) => Math.max(min, Math.min(v, Math.max(min, max)));

/**
 * Viewport-clamped popup portalled to <body> (so ancestor transforms such as
 * the page transition can't break `position: fixed`).
 *
 * anchor: { point: {x, y} }  — opens at a client point (context menu)
 *       | { elementId }      — sits above that canvas element, flipping below
 *                              when there's no room (contextual toolbar)
 */
export default function FloatingPanel({ anchor, onDismiss, className = "", children, label }) {
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [, setTick] = useState(0);

  // Re-measure every render: the anchor element moves/resizes with the doc.
  // Intentionally dependency-free; the change guard on setPos stops the loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const b = viewportBounds();
    let left;
    let top;

    if (anchor.point) {
      left = anchor.point.x + 6;
      top = anchor.point.y + 6;
      if (left + w > b.maxX) left = anchor.point.x - w - 6;
      if (top + h > b.maxY) top = anchor.point.y - h - 6;
    } else {
      const target = document.querySelector(`[data-element-id="${anchor.elementId}"]`);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      left = rect.left + rect.width / 2 - w / 2;
      top = rect.top - h - 44; // clear the rotate handle
      if (top < b.minY) top = rect.bottom + 18;
    }

    const next = { left: clamp(left, b.minX, b.maxX - w), top: clamp(top, b.minY, b.maxY - h) };
    if (!pos || Math.abs(pos.left - next.left) > 0.5 || Math.abs(pos.top - next.top) > 0.5) setPos(next);
  });

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("scroll", bump, true);
    window.addEventListener("resize", bump);
    window.visualViewport?.addEventListener("resize", bump);
    window.visualViewport?.addEventListener("scroll", bump);
    return () => {
      window.removeEventListener("scroll", bump, true);
      window.removeEventListener("resize", bump);
      window.visualViewport?.removeEventListener("resize", bump);
      window.visualViewport?.removeEventListener("scroll", bump);
    };
  }, []);

  useEffect(() => {
    if (!onDismiss) return undefined;
    const onDown = (e) => {
      if (!panelRef.current?.contains(e.target)) onDismiss();
    };
    const onKey = (e) => e.key === "Escape" && onDismiss();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      className={`fixed z-[80] max-w-[calc(100vw-16px)] rounded-2xl border border-slate-700/80 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur-md ${className}`}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}
      onPointerDown={(e) => e.stopPropagation()}
      // Keep the caret/selection in the text box while clicking toolbar buttons.
      onMouseDown={(e) => {
        if (!e.target.closest("input, select, textarea")) e.preventDefault();
      }}
    >
      {children}
    </div>,
    document.body
  );
}
