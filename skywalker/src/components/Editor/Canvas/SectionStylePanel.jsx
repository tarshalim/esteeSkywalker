import { ColorField, Heading, PresetSwatch } from "./CollageBackgroundPanel";
import { BACKGROUND_SOLIDS } from "../../../lib/collage";
import { PAPER_TEXTURES, paperBackground } from "../../../lib/paperStyles";
import { SECTION_PADDINGS, SECTION_WIDTHS, activeSectionWidth } from "../../../lib/canvasSections";

function Segmented({ label, options, value, onPick }) {
  return (
    <div className="flex rounded-lg bg-slate-800 p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={`flex-1 rounded-md px-2 py-1 text-[12px] ${value === o.id ? "bg-blue-500/40 text-white" : "text-slate-300 hover:bg-slate-700"}`}
          onClick={() => onPick(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Toolbar sub-panels for a selected section box. `view` is "color" (shared
 * palette + custom hex), "texture" (paper textures, previewed in the box's
 * own tint) or "size" (width preset + inner padding). Every change applies
 * to this one box only.
 */
export default function SectionStylePanel({ element, view, pageWidth, actions }) {
  const set = (patch, coalesce) => actions.updateSection(element.id, patch, { coalesce });

  if (view === "color") {
    return (
      <div className="flex w-[min(320px,calc(100vw-40px))] flex-col gap-3">
        <section>
          <Heading>Palette</Heading>
          <div className="grid grid-cols-5 gap-1.5">
            {BACKGROUND_SOLIDS.map((p) => (
              <PresetSwatch key={p.label} preset={p} active={element.color === p.color} onPick={() => set({ color: p.color })} />
            ))}
          </div>
        </section>
        <section>
          <Heading>Custom</Heading>
          <ColorField label="Background" value={element.color} onChange={(color) => set({ color }, "color")} />
        </section>
      </div>
    );
  }

  if (view === "texture") {
    return (
      <div className="grid w-[min(320px,calc(100vw-40px))] grid-cols-4 gap-1" role="radiogroup" aria-label="Paper texture">
        {PAPER_TEXTURES.map((t) => {
          const active = (element.texture ?? "clean") === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`flex flex-col items-center gap-1 rounded-lg p-1 text-[11px] ${active ? "bg-blue-500/25 text-white" : "text-slate-300 hover:bg-slate-800"}`}
              onClick={() => set({ texture: t.id })}
            >
              <span
                className={`block h-10 w-full rounded-md border ${active ? "border-blue-400" : "border-slate-600"}`}
                style={paperBackground({ style: t.id, color: element.color })}
              />
              {t.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex w-[min(300px,calc(100vw-40px))] flex-col gap-3">
      <section>
        <Heading>Width</Heading>
        <Segmented label="Box width" options={SECTION_WIDTHS} value={activeSectionWidth(element, pageWidth)} onPick={(id) => set({ widthPreset: id })} />
      </section>
      <section>
        <Heading>Inner padding</Heading>
        <Segmented label="Inner padding" options={SECTION_PADDINGS} value={element.padding ?? "md"} onPick={(id) => set({ padding: id })} />
      </section>
    </div>
  );
}
