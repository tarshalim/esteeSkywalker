import { useState } from "react";
import { Play } from "lucide-react";
import EditableText from "./EditableText";
import MediaFill, { VideoSourceInput } from "./MediaFill";
import { videoPoster } from "../../../../lib/media";

/** Video wrapped in a retro camcorder viewfinder, or a scrapbook "play" card. */
export default function ViewfinderElementContent({ element, editable, editing, actions, onPickMedia }) {
  const [playing, setPlaying] = useState(false);
  const hasMedia = Boolean(element.url);
  const sourceInput = (
    <VideoSourceInput
      onUrl={(url) => actions.updateElement(element.id, { url })}
      onUpload={() => onPickMedia?.(element.id, "video/*", (url) => ({ url }))}
      onDismiss={() => actions.deleteElement(element.id)}
    />
  );

  if (element.variant === "playcard") {
    const poster = videoPoster(element.url);
    return (
      <div className="relative flex w-full h-full flex-col gap-[3%] rounded-[18px] border border-amber-900/10 bg-[#fdf6e3] p-[4%] shadow-[0_10px_24px_rgba(15,23,42,0.22)]">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-slate-900">
          {!hasMedia ? (
            editable ? sourceInput : null
          ) : playing ? (
            <MediaFill src={element.url} type="video" trim={element} />
          ) : (
            <button
              type="button"
              className="absolute inset-0"
              onClick={() => !editable && setPlaying(true)}
              tabIndex={editable ? -1 : 0}
              aria-label="Play video"
            >
              {poster ? <img src={poster} alt="" draggable={false} className="w-full h-full object-cover opacity-85" /> : <MediaFill src={element.url} type="video" editable />}
              <span className="absolute inset-0 m-auto flex h-[34%] max-h-16 aspect-square items-center justify-center rounded-full bg-white/90 text-rose-500 shadow-lg">
                <Play className="w-1/2 h-1/2 translate-x-[6%]" fill="currentColor" />
              </span>
            </button>
          )}
        </div>
        <EditableText element={element} editing={editing} actions={actions} placeholder="Name this clip…" className="h-[20%] shrink-0 overflow-hidden" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-[14px] bg-[#141414] p-[3.5%] shadow-[0_12px_28px_rgba(0,0,0,0.4)]">
      <div className="relative w-full h-full overflow-hidden rounded-md bg-slate-900">
        {hasMedia ? <MediaFill src={element.url} type="video" editable={editable} trim={element} /> : editable ? sourceInput : null}
        {hasMedia && (
          <>
            <div className="sb-viewfinder pointer-events-none absolute inset-[4%]">
              <span className="sb-rec absolute left-[3%] top-[4%]">● REC</span>
              <span className="absolute right-[3%] top-[4%]">00:00:12</span>
              <span className="sb-battery absolute right-[3%] bottom-[5%]" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl opacity-70">+</span>
            </div>
            <EditableText
              element={element}
              editing={editing}
              actions={actions}
              placeholder="Label…"
              className={`absolute left-[8%] right-[30%] bottom-[8%] overflow-hidden whitespace-nowrap [text-shadow:0_1px_2px_rgba(0,0,0,0.8)] ${editing ? "" : "pointer-events-none"}`}
            />
          </>
        )}
      </div>
    </div>
  );
}
