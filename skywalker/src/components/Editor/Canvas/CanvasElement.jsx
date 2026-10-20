import { useRef, useState } from "react";
import { ArrowUp, ArrowDown, Trash2, RotateCw } from "lucide-react";

const MIN_SIZE = 24;

/**
 * Generic transform chrome (move / resize / rotate / layer / delete) shared
 * by every canvas element kind. Drag/resize/rotate only commit a single
 * history snapshot on pointer-up — see docs/canvas-editor-spec.md §3.2.
 */
export default function CanvasElement({ element, selected, toCanvasPoint, onSelect, actions, children }) {
  const elRef = useRef(null);
  const [live, setLive] = useState(null); // { x, y, width, height, rotation } transient override while dragging

  const view = { x: element.x, y: element.y, width: element.width, height: element.height, rotation: element.rotation, ...live };

  const beginPointerSession = (onMove, onDone) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(element.id);
    const move = (ev) => onMove(ev);
    const up = (ev) => {
      onMove(ev);
      onDone();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handleMove = beginPointerSession(
    (() => {
      let start = null;
      return (e) => {
        const p = toCanvasPoint(e.clientX, e.clientY);
        if (!start) start = p;
        setLive({ x: element.x + (p.x - start.x), y: element.y + (p.y - start.y) });
      };
    })(),
    () => {
      setLive((cur) => {
        if (cur) actions.updateElement(element.id, { x: Math.round(cur.x), y: Math.round(cur.y) });
        return null;
      });
    }
  );

  function makeResizeHandler(edges) {
    let startPoint = null;
    return beginPointerSession(
      (e) => {
        const p = toCanvasPoint(e.clientX, e.clientY);
        if (!startPoint) startPoint = p;
        const dx = p.x - startPoint.x;
        const dy = p.y - startPoint.y;
        const next = { x: element.x, y: element.y, width: element.width, height: element.height };
        if (edges.includes("right")) next.width = Math.max(MIN_SIZE, element.width + dx);
        if (edges.includes("bottom")) next.height = Math.max(MIN_SIZE, element.height + dy);
        setLive(next);
      },
      () => {
        setLive((cur) => {
          if (cur) actions.updateElement(element.id, { width: Math.round(cur.width), height: Math.round(cur.height) });
          return null;
        });
      }
    );
  }

  const handleRotate = beginPointerSession(
    (e) => {
      const center = toCanvasPoint(
        elRef.current.getBoundingClientRect().left + elRef.current.getBoundingClientRect().width / 2,
        elRef.current.getBoundingClientRect().top + elRef.current.getBoundingClientRect().height / 2
      );
      const p = toCanvasPoint(e.clientX, e.clientY);
      const angle = (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI + 90;
      setLive({ rotation: Math.round(angle) });
    },
    () => {
      setLive((cur) => {
        if (cur?.rotation !== undefined) actions.updateElement(element.id, { rotation: cur.rotation });
        return null;
      });
    }
  );

  return (
    <div
      ref={elRef}
      className={`absolute ${selected ? "outline outline-2 outline-blue-400" : ""}`}
      style={{
        left: view.x,
        top: view.y,
        width: view.width,
        height: view.height,
        transform: `rotate(${view.rotation}deg)`,
        zIndex: element.zIndex,
        cursor: selected ? "grab" : "pointer",
      }}
      onPointerDown={handleMove}
    >
      {children}

      {selected && (
        <>
          <div
            className="absolute -right-1.5 top-1/2 -translate-y-1/2 h-6 w-3 cursor-ew-resize rounded bg-blue-400 border border-white/70"
            onPointerDown={makeResizeHandler(["right"])}
            title="Resize width"
          />
          <div
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-3 cursor-ns-resize rounded bg-blue-400 border border-white/70"
            onPointerDown={makeResizeHandler(["bottom"])}
            title="Resize height"
          />
          <div
            className="absolute -right-1.5 -bottom-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-full bg-blue-400 border border-white/70"
            onPointerDown={makeResizeHandler(["right", "bottom"])}
            title="Resize"
          />
          <div
            className="absolute left-1/2 -top-7 -translate-x-1/2 h-5 w-5 cursor-alias rounded-full bg-slate-900 text-blue-300 border border-slate-600 flex items-center justify-center"
            onPointerDown={handleRotate}
            title="Rotate"
          >
            <RotateCw size={12} />
          </div>

          <div className="absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/95 px-1 py-1 shadow-xl">
            <button
              type="button"
              className="p-1 rounded text-slate-300 hover:bg-slate-700 hover:text-white"
              title="Bring forward"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => actions.reorderLayer(element.id, "up")}
            >
              <ArrowUp size={13} />
            </button>
            <button
              type="button"
              className="p-1 rounded text-slate-300 hover:bg-slate-700 hover:text-white"
              title="Send backward"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => actions.reorderLayer(element.id, "down")}
            >
              <ArrowDown size={13} />
            </button>
            <button
              type="button"
              className="p-1 rounded text-rose-300 hover:bg-rose-500/20"
              title="Delete"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => actions.deleteElement(element.id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
