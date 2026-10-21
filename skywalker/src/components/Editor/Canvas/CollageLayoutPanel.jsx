import { Columns3, LayoutDashboard, Shrink } from "lucide-react";
import { CollageTemplatePreview } from "./CollageTemplatePicker";
import { COLLAGE_TEMPLATES, MAX_COLUMNS, applyTemplate, collagePatch, detachTemplate, displayColumns, findTemplate, isFilled } from "../../../lib/collage";

function Segmented({ options, value, onPick, label }) {
  return (
    <div className="flex rounded-lg bg-slate-800 p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[12px] ${
            value === o.value ? "bg-blue-500/40 text-white" : "text-slate-300 hover:bg-slate-700"
          }`}
          onClick={() => onPick(o.value)}
        >
          {o.icon && <o.icon size={13} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, onChange }) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-slate-300">
      <span className="w-14 shrink-0">{label}</span>
      <input type="range" min={min} max={max} value={value} className="min-w-0 flex-1 accent-blue-500" onChange={(e) => onChange(Number(e.target.value))} />
      <span className="w-6 text-right tabular-nums text-slate-400">{value}</span>
    </label>
  );
}

/** Toolbar sub-panel for a selected collage: one-click templates plus fine layout controls. */
export default function CollageLayoutPanel({ element, actions }) {
  const { collage } = element;
  const { layout } = collage;

  // Structural changes refit the element's height so cells keep their shape;
  // cosmetic ones (gap, corners) leave the size alone.
  const apply = (fn, { fit = true, coalesce } = {}) =>
    actions.updateElement(element.id, (el) => collagePatch(el, fn(el.collage), { fit }), { coalesce });
  // Changing the structure by hand detaches the template; styling doesn't.
  const setLayout = (patch) =>
    apply((c) => {
      const detached = detachTemplate(c);
      return { ...detached, layout: { ...detached.layout, ...patch } };
    });
  const setStyle = (patch, coalesce) => apply((c) => ({ ...c, layout: { ...c.layout, ...patch } }), { fit: false, coalesce });

  const template = findTemplate(collage.template);
  const filled = collage.items.filter(isFilled).length;
  const open = collage.items.length - filled;

  return (
    <div className="flex w-[min(380px,calc(100vw-40px))] flex-col gap-3">
      <section>
        <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Templates</h4>
        {template && (
          <p className="mb-1.5 text-[11px] leading-snug text-slate-400" role="status">
            {template.label}: {filled} photo{filled === 1 ? "" : "s"}
            {open > 0 ? `, ${open} open slot${open === 1 ? "" : "s"}` : filled > template.slots ? `, ${filled - template.slots} in extra rows` : ""}
          </p>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {COLLAGE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={collage.template === t.id}
              className={`flex flex-col gap-1 rounded-lg p-1 text-left text-[10px] leading-tight ${
                collage.template === t.id ? "bg-blue-500/30 text-white ring-1 ring-blue-400" : "text-slate-300 hover:bg-slate-800"
              }`}
              onClick={() => apply((c) => applyTemplate(c, t.id))}
            >
              <span className="rounded-md bg-slate-800 p-1">
                <CollageTemplatePreview templateId={t.id} height={52} />
              </span>
              <span className="line-clamp-2">{t.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Layout</h4>
        <Segmented
          label="Layout style"
          value={layout.mode}
          onPick={(mode) => setLayout({ mode })}
          options={[
            { value: "grid", label: "Grid", icon: LayoutDashboard },
            { value: "masonry", label: "Masonry", icon: Columns3 },
          ]}
        />
        <div className="flex items-center gap-2 text-[12px] text-slate-300">
          <span className="w-14 shrink-0">Columns</span>
          <Segmented
            label="Columns"
            value={displayColumns(collage)}
            onPick={(columns) => setLayout({ columns })}
            options={Array.from({ length: MAX_COLUMNS }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
          />
        </div>
        <Slider label="Spacing" value={layout.gap} min={0} max={24} onChange={(gap) => setStyle({ gap }, "gap")} />
        <Slider label="Corners" value={layout.radius} min={0} max={24} onChange={(radius) => setStyle({ radius }, "radius")} />
        <button
          type="button"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2 py-1.5 text-[12px] text-slate-200 hover:bg-slate-700"
          onClick={() => apply((c) => c)}
        >
          <Shrink size={13} /> Fit frame to photos
        </button>
      </section>
    </div>
  );
}
