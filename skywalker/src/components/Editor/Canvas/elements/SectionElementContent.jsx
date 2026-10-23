import { paperBackground } from "../../../../lib/paperStyles";
import { sectionPadding } from "../../../../lib/canvasSections";

/**
 * Section background box: the tinted, textured backdrop itself. Its content
 * is the pieces attached to it, painted right above it. While editing, a
 * faint dashed line marks the padding those pieces are kept inside.
 */
export default function SectionElementContent({ element, editable }) {
  const radius = element.radius ?? 18;
  const pad = sectionPadding(element);
  return (
    <div
      className="relative h-full w-full shadow-[0_6px_18px_rgba(15,23,42,0.12)]"
      style={{ borderRadius: radius, ...paperBackground({ style: element.texture, color: element.color }) }}
    >
      {editable && (
        <div
          className="pointer-events-none absolute border border-dashed border-slate-500/35"
          style={{ inset: pad, borderRadius: Math.max(4, radius - pad / 2) }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
