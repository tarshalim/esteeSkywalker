import { toEmbedUrl } from "../../../../lib/blocks";

export default function VideoElementContent({ element, editable, actions }) {
  const embed = toEmbedUrl(element.url);

  if (!embed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-900 text-slate-300 border-2 border-dashed border-slate-600 p-3">
        <span className="text-xs opacity-70">Paste a YouTube / video URL</span>
        {editable && (
          <input
            className="w-full text-xs px-2 py-1 rounded bg-slate-800 border border-slate-600 text-white outline-none"
            placeholder="https://youtube.com/watch?v=…"
            defaultValue={element.url}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => actions.updateElement(element.id, { url: e.target.value })}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <iframe
        className={`w-full h-full ${editable ? "pointer-events-none" : ""}`}
        src={embed}
        title="Embedded video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
