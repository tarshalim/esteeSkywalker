import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, LayoutTemplate, Sparkles, Trash2, X } from "lucide-react";
import { BUILT_IN_TEMPLATES } from "../../lib/templates";
import { ELEMENT_KIND, hasText } from "../../lib/canvasElements";
import { paperBackground } from "../../lib/paperStyles";
import { formatWeather } from "../../lib/weather";
import { useVibes } from "../../lib/vibes";

// What each kind of element looks like in the miniature page.
function miniStyle(el) {
  switch (el.kind) {
    case ELEMENT_KIND.NOTE:
      return { background: el.paperColor, boxShadow: "0 1px 3px rgba(0,0,0,0.18)" };
    case ELEMENT_KIND.POLAROID:
      return { background: "#fff", padding: "6% 6% 22%", boxShadow: "0 1px 3px rgba(0,0,0,0.22)" };
    case ELEMENT_KIND.DECOR:
      return { background: el.tint, opacity: 0.85, borderRadius: el.decorId === "stamp-seal" ? "50%" : 2 };
    case ELEMENT_KIND.IMAGE:
    case ELEMENT_KIND.VIDEO:
    case ELEMENT_KIND.VIEWFINDER:
    case ELEMENT_KIND.FRAME_STICKER:
      return { background: el.src ? `center / cover url("${el.src}")` : "#94a3b8", borderRadius: 3 };
    default:
      return {};
  }
}

/** A to-scale miniature of a template's scrapbook page: paper plus element shapes. */
function MiniPage({ canvas }) {
  const { width, height } = canvas.size;
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: `${width} / ${height}`, ...paperBackground(canvas.theme?.paper) }}
      aria-hidden="true"
    >
      {canvas.elements.map((el) => {
        const isText = el.kind === ELEMENT_KIND.TEXT;
        return (
          <div
            key={el.id}
            className="absolute"
            style={{
              left: `${(el.x / width) * 100}%`,
              top: `${(el.y / height) * 100}%`,
              width: `${(el.width / width) * 100}%`,
              height: `${(el.height / height) * 100}%`,
              transform: `rotate(${el.rotation || 0}deg)`,
              zIndex: el.zIndex,
              ...miniStyle(el),
            }}
          >
            {el.kind === ELEMENT_KIND.POLAROID && <div className="h-full w-full rounded-[1px] bg-slate-400" />}
            {isText && (
              <div className="flex h-full flex-col justify-start gap-[12%] pt-[4%]">
                {[0, 1].map((i) => (
                  <span
                    key={i}
                    className="block rounded-full"
                    style={{
                      height: el.fontSize >= 24 ? "34%" : "18%",
                      width: i === 0 ? "86%" : "58%",
                      background: el.color || "#334155",
                      opacity: el.fontSize >= 24 ? 0.8 : 0.35,
                      marginInline: el.align === "center" ? "auto" : 0,
                    }}
                  />
                ))}
              </div>
            )}
            {!isText && hasText(el) && el.kind !== ELEMENT_KIND.POLAROID && (
              <span className="absolute inset-x-[14%] top-[30%] block h-[8%] rounded-full bg-slate-700/30" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TemplateCard({ template, selected, onSelect, onHover, onApply, onDelete }) {
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => onSelect(template)}
        onDoubleClick={() => onApply(template)}
        onMouseEnter={() => onHover(template)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(template)}
        onBlur={() => onHover(null)}
        aria-pressed={selected}
        className={`flex h-full w-full flex-col overflow-hidden rounded-xl border-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none ${
          selected ? "border-(--blue) shadow-lg" : "border-(--border) hover:border-(--blue)/60"
        }`}
        style={{ background: "var(--bg-elevated)" }}
      >
        {/* Thumbnail: the top of the page, where the layout's character shows. */}
        <div className="relative aspect-[4/3] overflow-hidden border-b border-(--border)">
          {template.coverImage ? (
            <img src={template.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          ) : (
            <MiniPage canvas={template.canvas} />
          )}
          {selected && (
            <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-(--blue) text-white shadow">
              <Check size={14} aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <span
            className="w-fit rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide"
            style={{ background: "color-mix(in srgb, var(--blue) 14%, transparent)", color: "var(--blue)" }}
          >
            {template.category}
          </span>
          <span className="text-sm font-bold" style={{ color: "var(--text)" }}>
            {template.name}
          </span>
          {template.description && (
            <span className="line-clamp-2 text-xs" style={{ color: "var(--text-muted)" }}>
              {template.description}
            </span>
          )}
        </div>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(template)}
          aria-label={`Delete template ${template.name}`}
          title="Delete template"
          className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white opacity-100 transition-opacity hover:bg-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

function Section({ icon, title, children }) {
  return (
    <section className="mb-6 last:mb-0">
      <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {icon}
        {title}
      </h4>
      {children}
    </section>
  );
}

/**
 * The editor's template gallery: built-in starters plus the user's saved
 * layouts. Hovering (or focusing) a card previews it; clicking selects it;
 * double-click or "Use template" applies it.
 *
 * @param {{
 *   savedTemplates: import("../../lib/templates").PostTemplate[],
 *   onApply: (template: import("../../lib/templates").PostTemplate) => void,
 *   onDelete: (template: import("../../lib/templates").PostTemplate) => void,
 *   onClose: () => void,
 * }} props
 */
export default function TemplateGallery({ savedTemplates, onApply, onDelete, onClose }) {
  const [selected, setSelected] = useState(BUILT_IN_TEMPLATES[0]);
  const [hovered, setHovered] = useState(null);
  const { vibes: vibeList } = useVibes();
  const panelRef = useRef(null);
  const shown = hovered ?? selected;

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // A deleted template can't stay selected.
  useEffect(() => {
    if (!selected.builtIn && !savedTemplates.some((t) => t.id === selected.id)) setSelected(BUILT_IN_TEMPLATES[0]);
  }, [savedTemplates, selected]);

  const vibeLabels = shown.vibes.map((id) => vibeList.find((v) => v.id === id)?.label).filter(Boolean);
  const weatherText = formatWeather(shown.weather);
  const cardProps = { onSelect: setSelected, onHover: setHovered, onApply };

  return (
    // Above the editor's z-70 dock, below the tour (z-80) so the walkthrough can spotlight it.
    <motion.div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-gallery-title"
        data-tour="template-gallery"
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-(--border) shadow-2xl outline-none sm:max-w-5xl sm:rounded-2xl"
        style={{ background: "var(--bg-panel-strong)" }}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-(--border) px-4 py-3 sm:px-6 sm:py-4">
          <LayoutTemplate size={20} className="mt-0.5 shrink-0" style={{ color: "var(--blue)" }} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h3 id="template-gallery-title" className="text-base font-bold" style={{ color: "var(--text)" }}>
              Templates
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Start from a ready-made layout. Fields you&rsquo;ve already filled in are kept.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close templates"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-(--blue)/10 sm:h-9 sm:w-9"
            style={{ color: "var(--text)" }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
            <Section icon={<Sparkles size={13} aria-hidden="true" />} title="Starter templates">
              <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {BUILT_IN_TEMPLATES.map((t) => (
                  <TemplateCard key={t.id} template={t} selected={selected.id === t.id} {...cardProps} />
                ))}
              </ul>
            </Section>
            <Section icon={<LayoutTemplate size={13} aria-hidden="true" />} title="Your templates">
              {savedTemplates.length === 0 ? (
                <p
                  className="rounded-xl border-2 border-dashed border-(--border) p-4 text-center text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Nothing saved yet. Use “Save as Template” to reuse a layout you&rsquo;ve built.
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {savedTemplates.map((t) => (
                    <TemplateCard key={t.id} template={t} selected={selected.id === t.id} onDelete={onDelete} {...cardProps} />
                  ))}
                </ul>
              )}
            </Section>
          </div>

          {/* Preview of the hovered card, else the selected one. Phones get a compact bar instead. */}
          <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto border-l border-(--border) p-5 md:flex" aria-live="polite">
            <div className="overflow-hidden rounded-lg border border-(--border) shadow-sm">
              <MiniPage canvas={shown.canvas} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                {shown.name}
              </p>
              {shown.description && (
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  {shown.description}
                </p>
              )}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text)" }}>
              <dt style={{ color: "var(--text-muted)" }}>Layout</dt>
              <dd>{shown.canvas.elements.length} elements</dd>
              {shown.title && (
                <>
                  <dt style={{ color: "var(--text-muted)" }}>Title</dt>
                  <dd className="truncate">{shown.title.trim()}…</dd>
                </>
              )}
              {vibeLabels.length > 0 && (
                <>
                  <dt style={{ color: "var(--text-muted)" }}>Vibes</dt>
                  <dd>{vibeLabels.join(", ")}</dd>
                </>
              )}
              {weatherText && (
                <>
                  <dt style={{ color: "var(--text-muted)" }}>Weather</dt>
                  <dd>{weatherText}</dd>
                </>
              )}
            </dl>
          </aside>
        </div>

        <footer className="flex items-center gap-3 border-t border-(--border) px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
          <p className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--text)" }}>
            <span style={{ color: "var(--text-muted)" }}>Selected: </span>
            <b>{selected.name}</b>
          </p>
          <button type="button" className="editor-btn hidden sm:inline-flex" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="editor-btn editor-btn-primary" onClick={() => onApply(selected)}>
            Use template
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
