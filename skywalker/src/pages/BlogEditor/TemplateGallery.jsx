import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, LayoutTemplate, Palette, Pencil, Sparkles, X } from "lucide-react";
import { BUILT_IN_TEMPLATES, TEMPLATE_AESTHETICS, TEMPLATE_PALETTES, findAesthetic, findPalette } from "../../lib/templates";
import { ELEMENT_KIND, hasText } from "../../lib/canvasElements";
import { artFilter, findArt } from "../../data/scrapbookArt";
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
    case ELEMENT_KIND.STICKER: {
      const art = el.category === "art" && findArt(el.stickerId);
      return art ? { background: `center / contain no-repeat url("${art.src}")`, filter: artFilter(el) } : {};
    }
    case ELEMENT_KIND.COLLAGE: {
      const cover = el.collage?.items?.find((it) => it.src)?.src;
      return { background: cover ? `center / cover url("${cover}")` : "#94a3b8", borderRadius: 3, boxShadow: "0 0 0 2px #fff" };
    }
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

/** A template's vibe, or its color palette as a dot + name; nothing if it has neither. */
function StyleTag({ template }) {
  const aesthetic = findAesthetic(template.aesthetic);
  const palette = findPalette(template.palette);
  if (aesthetic) {
    return (
      <span
        className="w-fit rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide"
        style={{ background: "color-mix(in srgb, var(--blue) 14%, transparent)", color: "var(--blue)" }}
      >
        {aesthetic.label}
      </span>
    );
  }
  if (!palette) return null;
  return (
    <span
      className="inline-flex w-fit items-center gap-1 rounded-full border border-(--border) px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide"
      style={{ color: "var(--text)" }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: palette.color }} aria-hidden="true" />
      {palette.label}
    </span>
  );
}

/** The color-circle toggles; clicking the active circle clears the filter. */
function PaletteFilter({ value, counts, onChange }) {
  return (
    <div role="group" aria-label="Filter templates by color" className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        Color
      </span>
      {TEMPLATE_PALETTES.map((p) => {
        const active = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(active ? null : p.id)}
            aria-pressed={active}
            aria-label={`${p.label} templates (${counts[p.id] ?? 0})`}
            title={`${p.label} · ${counts[p.id] ?? 0}`}
            className={`relative grid h-11 w-11 place-items-center rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--blue) sm:h-9 sm:w-9 ${
              active ? "ring-2 ring-(--blue) ring-offset-2 ring-offset-(--bg-panel-strong)" : ""
            }`}
          >
            <span className="h-7 w-7 rounded-full border border-black/10 shadow-sm" style={{ background: p.color }} />
            {active && <Check size={14} strokeWidth={3} className="absolute text-white drop-shadow" aria-hidden="true" />}
          </button>
        );
      })}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-1 inline-flex min-h-9 items-center gap-1 rounded-full border border-(--border) px-3 text-xs font-bold hover:bg-(--blue)/10"
          style={{ color: "var(--text)" }}
        >
          <X size={13} aria-hidden="true" />
          Clear
        </button>
      )}
    </div>
  );
}

const CARD_GRID = "grid grid-cols-2 gap-3 lg:grid-cols-3";

// In edit mode (`onDelete` set) a card only offers its corner delete button,
// so a stray tap can't select or apply it.
function TemplateCard({ template, selected, onSelect, onHover, onApply, onDelete }) {
  const editing = Boolean(onDelete);
  return (
    <li className="relative">
      <button
        type="button"
        disabled={editing}
        onClick={() => onSelect(template)}
        onDoubleClick={() => onApply(template)}
        onMouseEnter={() => onHover(template)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(template)}
        onBlur={() => onHover(null)}
        aria-pressed={selected}
        className={`flex h-full w-full flex-col overflow-hidden rounded-xl border-2 text-left transition-all focus-visible:outline-none ${
          editing
            ? "cursor-default border-dashed border-red-500/50"
            : selected
            ? "border-(--blue) shadow-lg hover:-translate-y-0.5"
            : "border-(--border) hover:-translate-y-0.5 hover:border-(--blue)/60 hover:shadow-lg"
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
          {selected && !editing && (
            <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-(--blue) text-white shadow">
              <Check size={14} aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <span className="flex flex-wrap items-center gap-1.5">
            <StyleTag template={template} />
            <span className="text-[0.65rem] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              {template.category}
            </span>
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
      {editing && (
        <motion.button
          type="button"
          onClick={() => onDelete(template)}
          aria-label={`Delete template ${template.name}`}
          title="Delete template"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -right-2 -top-2 z-10 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-red-600 text-white shadow-md transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          <X size={15} strokeWidth={3} aria-hidden="true" />
        </motion.button>
      )}
    </li>
  );
}

function Section({ icon, title, action, children }) {
  return (
    <section className="mb-6 last:mb-0">
      {(title || action) && (
        <div className="mb-3 flex min-h-8 items-center gap-2">
          <h4 className="flex flex-1 items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            {icon}
            {title}
          </h4>
          {action}
        </div>
      )}
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
  const [editing, setEditing] = useState(false);
  const [palette, setPalette] = useState(null);
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

  // Nothing left to edit once the last saved template is deleted.
  useEffect(() => {
    if (savedTemplates.length === 0) setEditing(false);
  }, [savedTemplates.length]);

  const vibeLabels = shown.vibes.map((id) => vibeList.find((v) => v.id === id)?.label).filter(Boolean);
  const weatherText = formatWeather(shown.weather);
  const cardProps = { onSelect: setSelected, onHover: setHovered, onApply };
  const shownStyle = findAesthetic(shown.aesthetic);
  const shownPalette = findPalette(shown.palette);

  const paletteCounts = {};
  for (const t of [...BUILT_IN_TEMPLATES, ...savedTemplates]) {
    if (t.palette) paletteCounts[t.palette] = (paletteCounts[t.palette] ?? 0) + 1;
  }
  const activePalette = findPalette(palette);
  const builtInByColor = BUILT_IN_TEMPLATES.filter((t) => (palette ? t.palette === palette : t.palette));
  const savedShown = palette ? savedTemplates.filter((t) => t.palette === palette) : savedTemplates;
  const renderCards = (list, deletable = false) => (
    <ul className={CARD_GRID}>
      {list.map((t) => (
        <TemplateCard key={t.id} template={t} selected={selected.id === t.id} onDelete={deletable && editing ? onDelete : null} {...cardProps} />
      ))}
    </ul>
  );

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
          <div className="min-h-0 overflow-y-auto px-4 pb-4 sm:px-6">
            <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-(--border) px-4 py-2 sm:-mx-6 sm:px-6" style={{ background: "var(--bg-panel-strong)" }}>
              <PaletteFilter value={palette} counts={paletteCounts} onChange={setPalette} />
            </div>

            {!palette &&
              TEMPLATE_AESTHETICS.map((a, i) => {
                const list = BUILT_IN_TEMPLATES.filter((t) => t.aesthetic === a.id);
                if (list.length === 0) return null;
                return (
                  <Section
                    key={a.id}
                    icon={i === 0 ? <Sparkles size={13} aria-hidden="true" /> : null}
                    title={i === 0 ? "Vibes" : null}
                  >
                    <div className="mb-2">
                      <h5 className="text-sm font-bold" style={{ color: "var(--text)" }}>
                        {a.label}
                      </h5>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {a.description}
                      </p>
                    </div>
                    {renderCards(list)}
                  </Section>
                );
              })}

            <Section
              icon={activePalette ? <span className="h-3 w-3 rounded-full" style={{ background: activePalette.color }} /> : <Palette size={13} aria-hidden="true" />}
              title={activePalette ? `${activePalette.label} templates` : "By color"}
            >
              {builtInByColor.length > 0 ? (
                renderCards(builtInByColor)
              ) : (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  No starter templates in this color yet.
                </p>
              )}
              {palette && (
                <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  Vibe templates keep their own look, so they aren&rsquo;t filtered by color.
                </p>
              )}
            </Section>

            <Section
              icon={<LayoutTemplate size={13} aria-hidden="true" />}
              title={activePalette ? `Your ${activePalette.label.toLowerCase()} templates` : "Your templates"}
              action={
                savedTemplates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEditing((e) => !e)}
                    aria-pressed={editing}
                    className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-xs font-bold transition-colors ${
                      editing ? "border-(--blue) bg-(--blue) text-white" : "border-(--border) hover:bg-(--blue)/10"
                    }`}
                    style={editing ? undefined : { color: "var(--text)" }}
                  >
                    {editing ? <Check size={13} aria-hidden="true" /> : <Pencil size={13} aria-hidden="true" />}
                    {editing ? "Done" : "Edit"}
                  </button>
                )
              }
            >
              {savedTemplates.length === 0 ? (
                <p
                  className="rounded-xl border-2 border-dashed border-(--border) p-4 text-center text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Nothing saved yet. Use “Save as Template” to reuse a layout you&rsquo;ve built.
                </p>
              ) : savedShown.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  None of your templates use this color.
                </p>
              ) : (
                renderCards(savedShown, true)
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
              {(shownStyle || shownPalette) && (
                <>
                  <dt style={{ color: "var(--text-muted)" }}>Style</dt>
                  <dd className="flex items-center gap-1.5">
                    {shownPalette && <span className="h-2.5 w-2.5 rounded-full" style={{ background: shownPalette.color }} aria-hidden="true" />}
                    {shownStyle?.label ?? shownPalette.label}
                  </dd>
                </>
              )}
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
