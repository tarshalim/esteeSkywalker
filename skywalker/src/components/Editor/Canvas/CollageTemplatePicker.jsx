import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, LayoutGrid, X } from "lucide-react";
import { CollageLayout } from "./elements/CollageElementContent";
import { COLLAGE_TEMPLATES, DEFAULT_TEMPLATE, applyTemplate, findTemplate, naturalHeight } from "../../../lib/collage";
import { PLACEHOLDER_ASPECTS, placeholderPhoto } from "../../../lib/collagePlaceholders";

const PREVIEW_WIDTH = 300;
const MAX_EXTRA = 9;

/**
 * Miniature of a template filled with demo photos. `count` defaults to the
 * template's base slots; pass more to show how it grows. The preview keeps the
 * collage's real proportions inside a box `height` px tall.
 */
export function CollageTemplatePreview({ templateId, count, height }) {
  const collage = useMemo(() => {
    const n = count ?? findTemplate(templateId)?.slots ?? 1;
    const items = Array.from({ length: n }, (_, i) => ({
      id: `demo${i}`,
      src: placeholderPhoto(i),
      caption: "",
      aspect: PLACEHOLDER_ASPECTS[i % PLACEHOLDER_ASPECTS.length],
      span: { col: 1, row: 1 },
    }));
    return applyTemplate({ template: null, layout: { gap: 3, radius: 3 }, items }, templateId);
  }, [templateId, count]);
  const ratio = naturalHeight(collage, PREVIEW_WIDTH) / PREVIEW_WIDTH;

  return (
    <div className="flex w-full items-center justify-center" style={{ height }} aria-hidden="true">
      <div className="overflow-hidden rounded-md bg-white shadow-sm" style={{ width: `min(100%, ${height / ratio}px)`, aspectRatio: `1 / ${ratio}` }}>
        <CollageLayout
          collage={collage}
          renderTile={(item, i, style) => (
            <img key={item.id} src={item.src} alt="" draggable={false} className="h-full w-full object-cover" style={{ ...style, borderRadius: 3 }} />
          )}
        />
      </div>
    </div>
  );
}

/**
 * Template-first gallery shown when a collage is added: pick a structure,
 * then either upload photos straight away or start with open slots.
 * `onPick(templateId, { addPhotos })` places the collage.
 */
export default function CollageTemplatePicker({ onPick, onClose }) {
  const [selected, setSelected] = useState(DEFAULT_TEMPLATE);
  const [extra, setExtra] = useState(0);
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    dialogRef.current?.querySelector("[aria-pressed='true']")?.focus();
    const onKey = (e) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="collage-picker-title"
        className="flex max-h-[min(92vh,760px)] w-[min(760px,100%)] flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 text-slate-100 shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-slate-800 px-4 py-3">
          <LayoutGrid size={20} className="mt-0.5 shrink-0 text-blue-300" />
          <div className="min-w-0 flex-1">
            <h2 id="collage-picker-title" className="text-[15px] font-semibold">
              Choose a collage layout
            </h2>
            <p className="text-[12px] text-slate-400">Pick a structure first. Add as many photos as you like after: extras flow into new rows below.</p>
          </div>
          <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="grid grid-cols-2 gap-2.5 overflow-y-auto overscroll-contain p-4 sm:grid-cols-3">
          {COLLAGE_TEMPLATES.map((t) => {
            const active = selected === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                className={`flex flex-col gap-1.5 rounded-xl p-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${
                  active ? "bg-blue-500/20 ring-2 ring-blue-400" : "bg-slate-800/60 hover:bg-slate-800"
                }`}
                onClick={() => setSelected(t.id)}
                onDoubleClick={() => onPick(t.id, { addPhotos: true })}
              >
                <div className="rounded-lg bg-slate-950/40 p-2">
                  <CollageTemplatePreview templateId={t.id} count={t.slots + extra} height={120} />
                </div>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold leading-tight">{t.label}</span>
                  <span className="shrink-0 text-[10px] text-slate-400">{t.slots} slots</span>
                </span>
                <span className="text-[11px] leading-snug text-slate-400">{t.description}</span>
              </button>
            );
          })}
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-slate-800 px-4 py-3">
          <label className="flex min-w-[200px] flex-1 items-center gap-2 text-[12px] text-slate-300">
            <span className="shrink-0">Preview with</span>
            <input
              type="range"
              min={0}
              max={MAX_EXTRA}
              value={extra}
              className="min-w-0 flex-1 accent-blue-500"
              onChange={(e) => setExtra(Number(e.target.value))}
            />
            <span className="w-[78px] shrink-0 tabular-nums text-slate-400">{extra ? `+${extra} photos` : "base slots"}</span>
          </label>
          <div className="ml-auto flex gap-2">
            <button type="button" className="rounded-lg px-3 py-2 text-[13px] text-slate-200 hover:bg-slate-800" onClick={() => onPick(selected, { addPhotos: false })}>
              Start with empty slots
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-[13px] font-semibold text-white hover:bg-blue-400"
              onClick={() => onPick(selected, { addPhotos: true })}
            >
              <ImagePlus size={15} /> Add photos
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}
