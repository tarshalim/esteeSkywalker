import { useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, RefreshCw, Scaling, Trash2 } from "lucide-react";
import {
  backgroundCss,
  collagePatch,
  createCollage,
  cycleSpan,
  fillSlotPatch,
  filledView,
  isFilled,
  masonryColumns,
  moveItem,
  packGrid,
  photosUploadedPatch,
  removeItem,
  replacePhotoPatch,
  shiftItem,
  updateItem,
  withItems,
} from "../../../../lib/collage";
import { findFont } from "../../../../lib/canvasFonts";

const DRAG_THRESHOLD = 4;

/**
 * Lays out a collage's tiles as a CSS grid (packed spans) or masonry columns,
 * filling whatever box it's given. `renderTile(item, index, style)` draws each
 * tile, so template previews can reuse the exact same layout.
 */
export function CollageLayout({ collage, items = collage.items, renderTile, gap = collage.layout.gap }) {
  const { mode, columns } = collage.layout;

  if (mode === "masonry") {
    return (
      <div className="flex h-full w-full" style={{ gap, padding: gap }}>
        {masonryColumns(items, columns).map((col, c) => (
          <div key={c} className="flex min-w-0 flex-1 flex-col" style={{ gap }}>
            {col.tiles.map(({ item, index, weight }) => renderTile(item, index, { flex: `${weight} 1 0px`, minHeight: 0 }))}
          </div>
        ))}
      </div>
    );
  }

  const { cells, rows } = packGrid(items, columns);
  return (
    <div
      className="grid h-full w-full"
      style={{
        gap,
        padding: gap,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${Math.max(rows, 1)}, minmax(0, 1fr))`,
      }}
    >
      {cells.map((cell) =>
        renderTile(items[cell.index], cell.index, {
          gridColumn: `${cell.col + 1} / span ${cell.w}`,
          gridRow: `${cell.row + 1} / span ${cell.h}`,
          minHeight: 0,
        })
      )}
    </div>
  );
}

function TileButton({ label, onClick, size, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="flex shrink-0 items-center justify-center rounded-full bg-slate-900/75 text-white shadow hover:bg-blue-500"
      style={{ width: size, height: size }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * Multi-photo collage. Selected, it moves like any element; in edit mode
 * (double-tap, Enter or the toolbar's Arrange button) tiles can be dragged to
 * reorder, resized, replaced, removed and captioned. Open template slots show
 * an "Add photo" tile in the editor and are left out for readers. Image files
 * dropped on it fill open slots, then grow the collage. Its backdrop color or
 * gradient shows through the spacing; text and scrapbook overlays are separate
 * canvas elements attached to it (lib/canvasGroups.js).
 */
export default function CollageElementContent({ element, editable, editing, actions, zoom = 1, onPickMedia, onUploadFiles }) {
  const stored = element.collage ?? createCollage();
  const { layout } = stored;
  const [drag, setDrag] = useState(null); // { id, overId } while a tile is being dragged
  const [dropActive, setDropActive] = useState(false);
  const collage = !editable ? filledView(stored) : drag ? withItems(stored, moveItem(stored.items, drag.id, drag.overId)) : stored;
  const ui = 1 / zoom; // counter-scale controls to a constant on-screen size
  const captionFont = findFont("hand").family;

  const update = (fn, opts) => actions.updateElement(element.id, (el) => ({ collage: fn(el.collage) }), opts);
  // Changes that can add or drop rows refit the frame so tiles keep their shape.
  const restructure = (fn) => actions.updateElement(element.id, (el) => collagePatch(el, fn(el.collage)));
  const addPhotos = () => onPickMedia?.(element.id, "image/*", photosUploadedPatch, { multiple: true });

  const startTileDrag = (e, id) => {
    if (e.button > 0) return;
    e.stopPropagation();
    const { pointerId } = e;
    const start = { x: e.clientX, y: e.clientY };
    let current = null;

    const move = (ev) => {
      if (ev.pointerId !== pointerId) return;
      if (!current && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD) return;
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(`[data-collage="${element.id}"] [data-tile-id]`);
      const overId = hit?.dataset.tileId ?? current?.overId ?? id;
      if (!current || current.overId !== overId) {
        current = { id, overId };
        setDrag(current);
      }
    };
    const end = (ev) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setDrag(null);
      if (ev.type === "pointerup" && current && current.overId !== id) {
        restructure((c) => withItems(c, moveItem(c.items, id, current.overId)));
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes("Files");
  const dropProps =
    editable && onUploadFiles
      ? {
          onDragOver: (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            e.stopPropagation(); // the collage takes these, not the page underneath
            setDropActive(true);
          },
          onDragLeave: (e) => !e.currentTarget.contains(e.relatedTarget) && setDropActive(false),
          onDrop: (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            e.stopPropagation();
            setDropActive(false);
            const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
            onUploadFiles(element.id, files, photosUploadedPatch);
          },
        }
      : {};

  const renderTile = (item, index, placement) => {
    const dragging = drag?.id === item.id;
    const btn = 26 * ui;

    if (!isFilled(item)) {
      return (
        <div
          key={item.id}
          data-tile-id={item.id}
          className="relative overflow-hidden border-2 border-dashed border-slate-300 bg-slate-100/90"
          style={{ ...placement, borderRadius: layout.radius }}
        >
          <button
            type="button"
            className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-[14px] font-medium text-slate-400 hover:bg-blue-50 hover:text-blue-600"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onPickMedia?.(element.id, "image/*", fillSlotPatch(item.id), { multiple: true })}
            aria-label={`Add photo to slot ${index + 1}`}
          >
            <ImagePlus size={26} strokeWidth={1.5} />
            Add photo
          </button>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        data-tile-id={item.id}
        className="group relative overflow-hidden bg-slate-200"
        style={{
          ...placement,
          borderRadius: layout.radius,
          cursor: editing ? (drag ? "grabbing" : "grab") : undefined,
          touchAction: editing ? "none" : undefined,
          opacity: dragging ? 0.6 : 1,
          outline: dragging ? `${2 * ui}px solid #3b82f6` : undefined,
          outlineOffset: -2 * ui,
        }}
        onPointerDown={editing ? (e) => startTileDrag(e, item.id) : undefined}
      >
        {item.src && <img src={item.src} alt={item.caption || ""} draggable={false} className="h-full w-full object-cover" />}

        {editing ? (
          <>
            <div
              className="absolute right-0 top-0 flex flex-wrap justify-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100"
              style={{ gap: 4 * ui, padding: 5 * ui }}
            >
              <TileButton label="Move earlier" size={btn} onClick={() => restructure((c) => withItems(c, shiftItem(c.items, item.id, -1)))}>
                <ArrowLeft size={14 * ui} />
              </TileButton>
              <TileButton label="Move later" size={btn} onClick={() => restructure((c) => withItems(c, shiftItem(c.items, item.id, 1)))}>
                <ArrowRight size={14 * ui} />
              </TileButton>
              {layout.mode === "grid" && (
                <TileButton
                  label={stored.template ? "Resize tile (switches to a custom layout)" : `Tile size ${item.span?.col ?? 1}×${item.span?.row ?? 1} (click to change)`}
                  size={btn}
                  onClick={() => restructure((c) => cycleSpan(c, item.id))}
                >
                  <Scaling size={14 * ui} />
                </TileButton>
              )}
              <TileButton label="Replace photo" size={btn} onClick={() => onPickMedia?.(element.id, "image/*", replacePhotoPatch(item.id))}>
                <RefreshCw size={13 * ui} />
              </TileButton>
              <TileButton label="Remove photo" size={btn} onClick={() => restructure((c) => removeItem(c, item.id))}>
                <Trash2 size={13 * ui} />
              </TileButton>
            </div>
            <input
              className="absolute inset-x-0 bottom-0 w-full bg-gradient-to-t from-black/70 to-black/0 text-white outline-none placeholder:text-white/60 focus:from-black/85"
              style={{ fontFamily: captionFont, fontSize: 18, padding: "14px 8px 4px" }}
              placeholder="Add a caption…"
              aria-label={`Caption for photo ${index + 1}`}
              value={item.caption}
              maxLength={140}
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => update((c) => updateItem(c, item.id, { caption: e.target.value }), { coalesce: `caption:${item.id}` })}
            />
          </>
        ) : (
          item.caption && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/65 to-black/0 text-white"
              style={{ fontFamily: captionFont, fontSize: 18, padding: "14px 8px 4px" }}
            >
              {item.caption}
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <div
      data-collage={element.id}
      className="relative h-full w-full overflow-hidden shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
      style={{ borderRadius: Math.min(layout.radius + layout.gap, 28), background: backgroundCss(stored.background) }}
      {...dropProps}
    >
      {collage.items.length > 0 ? (
        <CollageLayout collage={collage} renderTile={renderTile} />
      ) : (
        editable && (
          <button
            type="button"
            className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100/80 text-[15px] font-medium text-slate-500 hover:text-blue-600"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={addPhotos}
          >
            <ImagePlus size={30} strokeWidth={1.5} />
            Add photos to your collage
            <span className="text-[12px] font-normal opacity-75">Pick several at once, or drop them here</span>
          </button>
        )
      )}

      {dropActive && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center border-4 border-dashed border-blue-500 bg-blue-500/15 text-[18px] font-semibold text-blue-700">
          Drop photos to add them
        </div>
      )}
    </div>
  );
}
