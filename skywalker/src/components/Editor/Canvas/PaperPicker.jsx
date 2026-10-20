import { PAPER_GROUPS, PAPER_SWATCHES, findPaperStyle, paperBackground } from "../../../lib/paperStyles";

/** Grid of paper styles grouped Clean / Colored / Textured / Exercise book / Scrapbook, plus a tint row. */
export default function PaperPicker({ paper, onChange }) {
  return (
    <div className="flex flex-col gap-3">
      {PAPER_GROUPS.map((group) => (
        <section key={group.id}>
          <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</h4>
          <div className="flex flex-wrap gap-2">
            {group.styles.map((style) => {
              const active = paper.style === style.id;
              return (
                <button
                  key={style.id}
                  type="button"
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1 rounded-xl p-1 text-[11px] ${active ? "bg-blue-500/25 text-white" : "text-slate-300 hover:bg-slate-800"}`}
                  onClick={() => onChange({ style: style.id, color: style.color })}
                >
                  <span
                    className={`block h-12 w-16 rounded-md border ${active ? "border-blue-400" : "border-slate-600"}`}
                    style={paperBackground({ style: style.id, color: active ? paper.color : style.color })}
                  />
                  {style.label}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {paper.style !== "clean" && (
        <section>
          <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Paper tint</h4>
          <div className="flex flex-wrap items-center gap-1.5">
            {[findPaperStyle(paper.style).color, ...PAPER_SWATCHES.filter((c) => c !== findPaperStyle(paper.style).color)].map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Tint ${c}`}
                className={`h-7 w-7 rounded-full border-2 ${paper.color === c ? "border-white" : "border-slate-600"}`}
                style={{ background: c }}
                onClick={() => onChange({ color: c })}
              />
            ))}
            <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-slate-500" title="Custom color">
              <span className="absolute inset-0 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] opacity-80" />
              <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={paper.color} onChange={(e) => onChange({ color: e.target.value })} />
            </label>
          </div>
        </section>
      )}
    </div>
  );
}
