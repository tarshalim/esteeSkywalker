import { useRef, useState } from "react";
import { Move, RotateCw } from "lucide-react";
import { ELEMENT_KIND, hasText } from "../../../lib/canvasElements";

const MIN_SIZE = 24;
const DRAG_THRESHOLD = 4; // screen px a press must travel before it becomes a drag
const KEEP_VISIBLE = 40; // px of an element that must stay on the page after a drag
const KEEP_ASPECT = new Set([ELEMENT_KIND.STICKER, ELEMENT_KIND.FRAME_STICKER, ELEMENT_KIND.POLAROID]);
const COARSE_POINTER = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

function rotateVec(x, y, deg) {
  const r = (deg * Math.PI) / 180;
  return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) };
}

function rounded(patch) {
  return Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, Math.round(v)]));
}

/**
 * Transform chrome (move / resize / rotate) shared by every canvas element
 * kind. Pointer moves only update local `live` state; a single history
 * snapshot is committed on release. A press that never passes the drag
 * threshold is a tap: it selects, and a second tap on a text-bearing element
 * starts editing it.
 */
export default function CanvasElement({ element, selected, editing, zoom, pageWidth, toCanvasPoint, actions, onInteract, children }) {
  const liveRef = useRef(null);
  const [live, setLiveState] = useState(null);
  const setLive = (next) => {
    liveRef.current = next;
    setLiveState(next);
  };
  const view = { ...element, ...live };

  const commitLive = () => {
    const cur = liveRef.current;
    setLive(null);
    if (cur) actions.updateElement(element.id, rounded(cur));
  };

  function startSession(e, { onMove, onEnd }) {
    const { pointerId } = e;
    const startClient = { x: e.clientX, y: e.clientY };
    const startPoint = toCanvasPoint(e.clientX, e.clientY);
    let dragging = false;

    const move = (ev) => {
      if (ev.pointerId !== pointerId) return;
      if (!dragging) {
        if (Math.hypot(ev.clientX - startClient.x, ev.clientY - startClient.y) < DRAG_THRESHOLD) return;
        dragging = true;
        onInteract?.(true);
      }
      const point = toCanvasPoint(ev.clientX, ev.clientY);
      onMove({ dx: point.x - startPoint.x, dy: point.y - startPoint.y, point, event: ev });
    };
    const end = (ev) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (dragging) onInteract?.(false);
      const cancelled = ev.type === "pointercancel";
      if (cancelled) setLive(null);
      onEnd({ dragged: dragging, cancelled });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  const startMove = (e, { allowEdit }) => {
    if (e.button > 0) return;
    e.stopPropagation();
    const wasSelected = selected;
    if (!selected) actions.select(element.id);
    startSession(e, {
      onMove: ({ dx, dy }) => {
        const x = Math.min(Math.max(element.x + dx, KEEP_VISIBLE - element.width), pageWidth - KEEP_VISIBLE);
        const y = Math.max(element.y + dy, KEEP_VISIBLE - element.height);
        setLive({ x, y });
      },
      onEnd: ({ dragged, cancelled }) => {
        if (dragged && !cancelled) commitLive();
        else if (!dragged && allowEdit && wasSelected && !editing && hasText(element)) actions.edit(element.id);
      },
    });
  };

  const startResize = (edges) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    const corner = edges.length === 2;
    startSession(e, {
      onMove: ({ dx, dy, event }) => {
        // Work in the element's own (unrotated) frame, then shift the centre
        // so the opposite corner stays visually pinned.
        const local = rotateVec(dx, dy, -element.rotation);
        let w = edges.includes("right") ? element.width + local.x : element.width;
        let h = edges.includes("bottom") ? element.height + local.y : element.height;
        if (corner && (KEEP_ASPECT.has(element.kind) || event.shiftKey)) {
          const s = Math.max(w / element.width, h / element.height);
          w = element.width * s;
          h = element.height * s;
        }
        w = Math.max(MIN_SIZE, w);
        h = Math.max(MIN_SIZE, h);
        const shift = rotateVec((w - element.width) / 2, (h - element.height) / 2, element.rotation);
        const cx = element.x + element.width / 2 + shift.x;
        const cy = element.y + element.height / 2 + shift.y;
        setLive({ x: cx - w / 2, y: cy - h / 2, width: w, height: h });
      },
      onEnd: ({ dragged, cancelled }) => dragged && !cancelled && commitLive(),
    });
  };

  const startRotate = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const center = { x: element.x + element.width / 2, y: element.y + element.height / 2 };
    startSession(e, {
      onMove: ({ point, event }) => {
        let angle = (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI + 90;
        angle = ((angle + 540) % 360) - 180;
        const snapped = Math.round(angle / 15) * 15;
        if (event.shiftKey || Math.abs(snapped - angle) < 4) angle = snapped;
        setLive({ rotation: angle });
      },
      onEnd: ({ dragged, cancelled }) => dragged && !cancelled && commitLive(),
    });
  };

  // Handles live inside the scaled page, so counter-scale them to stay a
  // constant on-screen size (and finger-sized on touch screens).
  const hs = (COARSE_POINTER ? 22 : 13) / zoom;
  const handle = "absolute rounded-full bg-white border-2 border-blue-500 shadow-md";

  return (
    <div
      data-element-id={element.id}
      className="absolute select-none"
      style={{
        left: view.x,
        top: view.y,
        width: view.width,
        height: view.height,
        transform: `rotate(${view.rotation}deg)`,
        zIndex: element.zIndex,
        cursor: editing ? "auto" : "grab",
        touchAction: selected ? "none" : "pan-y",
        outline: selected ? `${2 / zoom}px ${editing ? "dashed" : "solid"} #3b82f6` : undefined,
        outlineOffset: 3 / zoom,
      }}
      onPointerDown={(e) => startMove(e, { allowEdit: true })}
      onDoubleClick={() => hasText(element) && actions.edit(element.id)}
    >
      {children}

      {selected && (
        <>
          <div
            className={`${handle} cursor-ew-resize`}
            style={{ width: hs, height: hs, right: -hs / 2, top: `calc(50% - ${hs / 2}px)`, touchAction: "none" }}
            onPointerDown={startResize(["right"])}
            title="Resize width"
          />
          <div
            className={`${handle} cursor-ns-resize`}
            style={{ width: hs, height: hs, bottom: -hs / 2, left: `calc(50% - ${hs / 2}px)`, touchAction: "none" }}
            onPointerDown={startResize(["bottom"])}
            title="Resize height"
          />
          <div
            className={`${handle} cursor-nwse-resize bg-blue-500`}
            style={{ width: hs, height: hs, right: -hs / 2, bottom: -hs / 2, touchAction: "none" }}
            onPointerDown={startResize(["right", "bottom"])}
            title="Resize (Shift keeps proportions)"
          />
          <div
            className="absolute bg-blue-500 pointer-events-none"
            style={{ width: 2 / zoom, height: 18 / zoom, top: -18 / zoom, left: `calc(50% - ${1 / zoom}px)` }}
          />
          <div
            className={`${handle} cursor-alias flex items-center justify-center text-blue-600`}
            style={{ width: hs * 1.3, height: hs * 1.3, top: -18 / zoom - hs * 1.3, left: `calc(50% - ${(hs * 1.3) / 2}px)`, touchAction: "none" }}
            onPointerDown={startRotate}
            title="Rotate (snaps to 15°)"
          >
            <RotateCw size={hs * 0.75} strokeWidth={2.5} />
          </div>
          {editing && (
            <div
              className="absolute flex items-center justify-center rounded-full bg-blue-500 text-white shadow-md cursor-move"
              style={{ width: hs * 1.5, height: hs * 1.5, left: -hs * 1.1, top: -hs * 1.1, touchAction: "none" }}
              onPointerDown={(e) => startMove(e, { allowEdit: false })}
              title="Drag to move"
            >
              <Move size={hs * 0.85} strokeWidth={2.5} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
