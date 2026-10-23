import { useRef, useState } from "react";
import { Copy, Move, RotateCw, X } from "lucide-react";
import { ELEMENT_KIND, hasEditMode } from "../../../lib/canvasElements";

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
 *
 * `layer` is the paint position (overlays sit right above their host),
 * `follow` is where an overlay is while its host is being dragged, and
 * `onLive` reports this element's own in-progress transform.
 *
 * `findDock(view)` names the element whose empty slot a drag would fill if
 * released now; the drag reports it through `onDockHover` and docks into it
 * on release. `dropTarget` highlights this element as a drop target, with a
 * hint pill when it's a string.
 */
export default function CanvasElement({
  element,
  selected,
  editing,
  zoom,
  pageWidth,
  toCanvasPoint,
  actions,
  onInteract,
  layer = element.zIndex,
  follow,
  onLive,
  dropTarget,
  findDock,
  onDockHover,
  children,
}) {
  const liveRef = useRef(null);
  const [live, setLiveState] = useState(null);
  const setLive = (next) => {
    liveRef.current = next;
    setLiveState(next);
    onLive?.(next);
  };
  const view = { ...element, ...follow, ...live };

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
    // Element whose empty slot this drag would fill on release (Alt overlays instead).
    let dockId = null;
    const setDock = (id) => {
      if (id === dockId) return;
      dockId = id;
      onDockHover?.(id);
    };
    startSession(e, {
      onMove: ({ dx, dy, event }) => {
        const x = Math.min(Math.max(element.x + dx, KEEP_VISIBLE - element.width), pageWidth - KEEP_VISIBLE);
        const y = Math.max(element.y + dy, KEEP_VISIBLE - element.height);
        setLive({ x, y });
        if (findDock) setDock(event.altKey ? null : findDock({ ...element, x, y }));
      },
      onEnd: ({ dragged, cancelled }) => {
        const host = dockId;
        setDock(null);
        if (dragged && !cancelled && host) {
          setLive(null);
          actions.dockInto(element.id, host);
        } else if (dragged && !cancelled) commitLive();
        else if (!dragged && allowEdit && wasSelected && !editing && hasEditMode(element)) actions.edit(element.id);
      },
    });
  };

  const startResize = (edges) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    const corner = edges.length === 2;
    // +1 grows toward right/bottom, -1 toward left/top, 0 leaves that axis alone.
    const dirX = edges.includes("right") ? 1 : edges.includes("left") ? -1 : 0;
    const dirY = edges.includes("bottom") ? 1 : edges.includes("top") ? -1 : 0;
    startSession(e, {
      onMove: ({ dx, dy, event }) => {
        // Work in the element's own (unrotated) frame, then shift the centre
        // so the opposite corner stays visually pinned.
        const local = rotateVec(dx, dy, -element.rotation);
        let w = element.width + dirX * local.x;
        let h = element.height + dirY * local.y;
        if (corner && (KEEP_ASPECT.has(element.kind) || event.shiftKey)) {
          const s = Math.max(w / element.width, h / element.height);
          w = element.width * s;
          h = element.height * s;
        }
        w = Math.max(MIN_SIZE, w);
        h = Math.max(MIN_SIZE, h);
        const shift = rotateVec((dirX * (w - element.width)) / 2, (dirY * (h - element.height)) / 2, element.rotation);
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
  const chip = "absolute flex items-center justify-center rounded-full bg-white shadow-md";
  const rotateTop = -18 / zoom - hs * 1.3;
  // Corner handles: [vertical edge, horizontal edge, CSS position, cursor].
  const corners = [
    ["top", "left", { top: -hs / 2, left: -hs / 2 }, "nwse-resize"],
    ["top", "right", { top: -hs / 2, right: -hs / 2 }, "nesw-resize"],
    ["bottom", "left", { bottom: -hs / 2, left: -hs / 2 }, "nesw-resize"],
    ["bottom", "right", { bottom: -hs / 2, right: -hs / 2 }, "nwse-resize"],
  ];
  // A tap on a chip must not start a move of the element underneath.
  const chipPress = (fn) => ({
    onPointerDown: (e) => e.stopPropagation(),
    onClick: (e) => {
      e.stopPropagation();
      fn();
    },
  });

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
        zIndex: layer,
        // On the wrapper, not the art: the rotate transform isolates its children from the paper.
        mixBlendMode: element.blend ? "multiply" : undefined,
        cursor: editing ? "auto" : "grab",
        touchAction: selected ? "none" : "pan-y",
        outline: selected
          ? `${2 / zoom}px ${editing ? "dashed" : "solid"} #3b82f6`
          : dropTarget
          ? `${3 / zoom}px dashed #f59e0b`
          : undefined,
        outlineOffset: 3 / zoom,
      }}
      onPointerDown={(e) => startMove(e, { allowEdit: true })}
      onDoubleClick={() => hasEditMode(element) && actions.edit(element.id)}
    >
      {children}

      {typeof dropTarget === "string" && (
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 whitespace-nowrap rounded-full bg-amber-500 font-semibold text-white shadow-lg"
          style={{ fontSize: 12 / zoom, padding: `${4 / zoom}px ${10 / zoom}px`, transform: `translate(-50%, -50%) rotate(${-view.rotation}deg)` }}
        >
          {dropTarget}
        </span>
      )}

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
          {!editing &&
            corners.map(([v, h, pos, cursor]) => (
              <div
                key={`${v}-${h}`}
                className={`${handle} ${v === "bottom" && h === "right" ? "bg-blue-500" : ""}`}
                style={{ width: hs, height: hs, ...pos, cursor, touchAction: "none" }}
                onPointerDown={startResize([h, v])}
                title="Resize (Shift keeps proportions)"
              />
            ))}
          {editing && (
            <div
              className={`${handle} cursor-nwse-resize bg-blue-500`}
              style={{ width: hs, height: hs, right: -hs / 2, bottom: -hs / 2, touchAction: "none" }}
              onPointerDown={startResize(["right", "bottom"])}
              title="Resize (Shift keeps proportions)"
            />
          )}
          <div
            className="absolute bg-blue-500 pointer-events-none"
            style={{ width: 2 / zoom, height: 18 / zoom, top: -18 / zoom, left: `calc(50% - ${1 / zoom}px)` }}
          />
          <div
            className={`${handle} cursor-alias flex items-center justify-center text-blue-600`}
            style={{ width: hs * 1.3, height: hs * 1.3, top: rotateTop, left: `calc(50% - ${(hs * 1.3) / 2}px)`, touchAction: "none" }}
            onPointerDown={startRotate}
            title="Rotate (snaps to 15°)"
          >
            <RotateCw size={hs * 0.75} strokeWidth={2.5} />
          </div>
          {!editing && (
            <>
              <button
                type="button"
                className={`${chip} text-slate-600 hover:text-blue-600`}
                style={{ width: hs * 1.3, height: hs * 1.3, top: rotateTop, left: `calc(50% - ${hs * 1.3 * 2.1}px)` }}
                title="Duplicate"
                aria-label="Duplicate"
                {...chipPress(() => actions.duplicateElement(element.id))}
              >
                <Copy size={hs * 0.7} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                className={`${chip} text-rose-500 hover:bg-rose-50`}
                style={{ width: hs * 1.3, height: hs * 1.3, top: rotateTop, left: `calc(50% + ${hs * 1.3 * 1.1}px)` }}
                title="Delete"
                aria-label="Delete"
                {...chipPress(() => actions.deleteElement(element.id))}
              >
                <X size={hs * 0.8} strokeWidth={3} />
              </button>
            </>
          )}
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
