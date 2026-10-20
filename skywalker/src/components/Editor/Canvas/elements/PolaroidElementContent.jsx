import EditableText from "./EditableText";
import MediaFill, { MediaPlaceholder } from "./MediaFill";
import { mediaPatch } from "../../../../lib/canvasElements";

/** Instant-camera print: photo/clip on top, handwritten caption in the wide bottom margin. */
export default function PolaroidElementContent({ element, editable, editing, actions, onPickMedia }) {
  return (
    <div className="relative w-full h-full bg-[#fdfcf8] shadow-[0_8px_18px_rgba(15,23,42,0.22)] rounded-[3px]">
      <div className="absolute overflow-hidden bg-slate-800" style={{ top: "6%", left: "6.5%", right: "6.5%", bottom: "23%" }}>
        {element.mediaSrc ? (
          <>
            <MediaFill src={element.mediaSrc} type={element.mediaType} editable={editable} />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-amber-900/10" />
          </>
        ) : (
          <MediaPlaceholder dark onPick={editable ? () => onPickMedia?.(element.id, "image/*,video/*", mediaPatch) : undefined} />
        )}
      </div>
      <EditableText
        element={element}
        editing={editing}
        actions={actions}
        placeholder="Caption…"
        className="absolute overflow-hidden"
        style={{ left: "6.5%", right: "6.5%", bottom: "2%", height: "19%", paddingTop: "1%" }}
      />
    </div>
  );
}
