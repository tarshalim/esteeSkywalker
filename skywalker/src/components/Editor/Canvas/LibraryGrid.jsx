import { useMemo, useRef } from "react";
import { CONTENT_BY_KIND } from "./elementRegistry";
import { LIBRARY_DRAG_TYPE } from "../../../lib/scrapbookLibrary";

const PREVIEW = 58;

/** A library item's element, scaled down to a square thumbnail. */
export function Preview({ element }) {
  const Content = CONTENT_BY_KIND[element.kind];
  const scale = Math.min(PREVIEW / element.width, PREVIEW / element.height) * 0.9;
  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-[#f6f2ea]" style={{ width: PREVIEW, height: PREVIEW }}>
      <div
        className="pointer-events-none shrink-0"
        style={{ width: element.width, height: element.height, transform: `scale(${scale}) rotate(${element.rotation}deg)` }}
        aria-hidden="true"
        inert
      >
        <Content element={element} editable={false} />
      </div>
    </div>
  );
}

/**
 * Sectioned grid of scrapbook pieces with jump links. Tapping a piece calls
 * `onPick(item)`; pieces can also be dragged onto the page (the canvas reads
 * LIBRARY_DRAG_TYPE on drop).
 */
export default function LibraryGrid({ sections, onPick, maxHeight = "min(60vh,440px)" }) {
  const listRef = useRef(null);
  // Build previews once per open; factories mint ids, so don't redo per render.
  const library = useMemo(
    () => sections.map((section) => ({ ...section, items: section.items.map((item) => ({ ...item, preview: item.create() })) })),
    [sections]
  );

  return (
    <>
      <nav aria-label="Element sections" className="flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {library.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:bg-blue-500/25 hover:text-white ${
              section.art ? "bg-amber-400/15 text-amber-200" : "bg-slate-800 text-slate-300"
            }`}
            onClick={() => listRef.current?.querySelector(`[data-section="${section.id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" })}
          >
            {section.label}
          </button>
        ))}
      </nav>
      <div ref={listRef} className="overflow-y-auto overscroll-contain px-1 pb-1" style={{ maxHeight }}>
        {library.map((section) => (
          <section key={section.id} data-section={section.id} className="mt-2 scroll-mt-1">
            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{section.label}</h4>
            <div className="grid grid-cols-4 gap-1.5">
              {section.items.map((item) => (
                // Not a <button>: previews render real element content, which contains buttons of its own.
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  draggable
                  title={`${item.label} (tap to add, or drag onto the page)`}
                  aria-label={item.label}
                  className="flex cursor-grab flex-col items-center gap-1 rounded-xl p-1 text-[10px] leading-tight text-slate-300 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 active:cursor-grabbing"
                  onClick={() => onPick(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPick(item);
                    }
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(LIBRARY_DRAG_TYPE, item.id);
                    e.dataTransfer.effectAllowed = "copy";
                    const preview = e.currentTarget.firstElementChild;
                    if (preview) e.dataTransfer.setDragImage(preview, PREVIEW / 2, PREVIEW / 2);
                  }}
                >
                  <Preview element={item.preview} />
                  <span className="line-clamp-2 text-center">{item.label}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
