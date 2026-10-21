import { useEffect, useState } from "react";
import { BACKGROUND_GRADIENTS, BACKGROUND_SOLIDS, DEFAULT_BACKGROUND, backgroundCss, collagePatch, sameBackground } from "../../../lib/collage";

const HEX = /^#[0-9a-f]{6}$/i;
const ANGLES = [
  { value: 180, label: "↓", name: "Top to bottom" },
  { value: 135, label: "↘", name: "Diagonal" },
  { value: 90, label: "→", name: "Left to right" },
  { value: 45, label: "↗", name: "Rising diagonal" },
];

function Heading({ children }) {
  return <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{children}</h4>;
}

function PresetSwatch({ preset, active, onPick }) {
  return (
    <button
      type="button"
      title={preset.label}
      aria-label={preset.label}
      aria-pressed={active}
      className={`h-8 w-full rounded-lg border-2 ${active ? "border-white ring-1 ring-blue-400" : "border-slate-600 hover:border-slate-400"}`}
      style={{ background: backgroundCss(preset) }}
      onClick={onPick}
    />
  );
}

/** Native color well plus a hex field that applies once the value is a full #rrggbb. */
function ColorField({ label, value, onChange }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-slate-300">
      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-slate-500" style={{ background: value }}>
        <input type="color" aria-label={`${label} color picker`} className="absolute inset-0 cursor-pointer opacity-0" value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
      <input
        aria-label={`${label} hex`}
        className="w-[74px] min-w-0 rounded-md bg-slate-800 px-1.5 py-1 font-mono text-[12px] uppercase text-slate-100 outline-none focus:ring-1 focus:ring-blue-400"
        value={text}
        maxLength={7}
        spellCheck={false}
        onChange={(e) => {
          const next = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
          setText(next);
          if (HEX.test(next)) onChange(next.toLowerCase());
        }}
        onBlur={() => setText(value)}
      />
    </label>
  );
}

/** Toolbar sub-panel for a selected collage: the backdrop that shows between (and around) its photos. */
export default function CollageBackgroundPanel({ element, actions }) {
  const bg = element.collage.background ?? DEFAULT_BACKGROUND;
  const isGradient = Boolean(bg.color2);
  const { gap } = element.collage.layout;

  const set = (next, coalesce) =>
    actions.updateElement(element.id, (el) => ({ collage: { ...el.collage, background: next } }), { coalesce: coalesce && `bg-${coalesce}` });
  const solid = (color) => ({ color });

  return (
    <div className="flex w-[min(320px,calc(100vw-40px))] flex-col gap-3">
      <section>
        <Heading>Solid colors</Heading>
        <div className="grid grid-cols-5 gap-1.5">
          {BACKGROUND_SOLIDS.map((p) => (
            <PresetSwatch key={p.label} preset={p} active={sameBackground(bg, p)} onPick={() => set(solid(p.color))} />
          ))}
        </div>
      </section>

      <section>
        <Heading>Soft gradients</Heading>
        <div className="grid grid-cols-6 gap-1.5">
          {BACKGROUND_GRADIENTS.map((p) => (
            <PresetSwatch key={p.label} preset={p} active={sameBackground(bg, p)} onPick={() => set({ color: p.color, color2: p.color2, angle: p.angle })} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Heading>Custom</Heading>
          <label className="mb-1.5 flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-300">
            <input
              type="checkbox"
              className="accent-blue-500"
              checked={isGradient}
              onChange={(e) => set(e.target.checked ? { color: bg.color, color2: "#f9c5d1", angle: 135 } : solid(bg.color))}
            />
            Gradient
          </label>
        </div>
        <div className="flex items-center gap-2">
          <ColorField label={isGradient ? "From" : "Background"} value={bg.color} onChange={(color) => set({ ...bg, color }, "color")} />
          {isGradient && <ColorField label="To" value={bg.color2} onChange={(color2) => set({ ...bg, color2 }, "color2")} />}
        </div>
        {isGradient && (
          <div className="flex rounded-lg bg-slate-800 p-0.5" role="radiogroup" aria-label="Gradient direction">
            {ANGLES.map((a) => (
              <button
                key={a.value}
                type="button"
                role="radio"
                aria-checked={(bg.angle ?? 135) === a.value}
                title={a.name}
                aria-label={a.name}
                className={`flex-1 rounded-md py-1 text-[13px] ${(bg.angle ?? 135) === a.value ? "bg-blue-500/40 text-white" : "text-slate-300 hover:bg-slate-700"}`}
                onClick={() => set({ ...bg, angle: a.value })}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {gap < 6 && (
        <p className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/70 px-2 py-1.5 text-[11px] leading-snug text-slate-300">
          The background shows in the spacing between photos.
          <button
            type="button"
            className="shrink-0 rounded-md bg-blue-500/30 px-2 py-1 text-white hover:bg-blue-500/50"
            onClick={() => actions.updateElement(element.id, (el) => collagePatch(el, { ...el.collage, layout: { ...el.collage.layout, gap: 14 } }, { fit: false }))}
          >
            Widen spacing
          </button>
        </p>
      )}
    </div>
  );
}
