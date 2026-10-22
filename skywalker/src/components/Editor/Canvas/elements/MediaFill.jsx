import { useEffect, useRef, useState } from "react";
import { ImagePlus, Link2, Upload, X } from "lucide-react";
import { isEmbedUrl, toEmbedUrl } from "../../../../lib/blocks";
import { isDirectVideo, withFirstFramePoster } from "../../../../lib/media";
import { parseYouTubeId } from "../../../../lib/music";
import { attachTrim, hasTrim, readTrim } from "../../../../lib/mediaTrim";
import TrimmedEmbed from "../../TrimmedEmbed";

// Canvas videos loop unless the author turns it off.
const VIDEO_LOOPS_BY_DEFAULT = true;

/** A direct/uploaded <video> that keeps to its trim (startSec/endSec/loop). */
function TrimmedVideo({ src, trim, editable, fit, className }) {
  const videoRef = useRef(null);
  const { start, end, loop } = trim;
  useEffect(() => attachTrim(videoRef.current, { start, end, loop }), [src, start, end, loop]);
  return (
    <video
      ref={videoRef}
      src={withFirstFramePoster(src)}
      className={`w-full h-full ${editable ? "pointer-events-none" : ""} ${className}`}
      style={{ objectFit: fit }}
      controls={!editable}
      muted={editable}
      playsInline
      preload="metadata"
    />
  );
}

/**
 * Fills its box with an image, an uploaded/direct video, or a YouTube/Vimeo/Loom embed.
 * `trim` ({ startSec, endSec, loop }) limits a direct or YouTube video to a segment.
 */
export default function MediaFill({ src, type, editable, fit = "cover", className = "", trim: trimFields }) {
  if (!src) return null;
  const trim = readTrim(trimFields, { loop: VIDEO_LOOPS_BY_DEFAULT });
  const embed = toEmbedUrl(src);
  const youTubeId = hasTrim(trim) ? parseYouTubeId(src) : null;
  if (youTubeId) {
    return (
      <TrimmedEmbed
        music={{ type: "youtube", id: youTubeId, startSec: trim.start, endSec: trim.end, loop: trim.loop }}
        className={`w-full h-full ${editable ? "pointer-events-none" : ""} ${className}`}
      />
    );
  }
  if (isEmbedUrl(embed)) {
    return (
      <iframe
        className={`w-full h-full border-0 ${editable ? "pointer-events-none" : ""} ${className}`}
        src={embed}
        title="Embedded video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    );
  }
  if (type === "video" || isDirectVideo(src)) {
    return <TrimmedVideo src={src} trim={trim} editable={editable} fit={fit} className={className} />;
  }
  return <img src={src} alt="" draggable={false} className={`w-full h-full ${className}`} style={{ objectFit: fit }} />;
}

/** Placeholder for an empty photo slot: one tap opens the file picker. */
export function MediaPlaceholder({ label = "Add photo or video", onPick, dark = false }) {
  return (
    <button
      type="button"
      className={`w-full h-full flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
        dark ? "bg-slate-800 text-slate-300" : "bg-slate-100/80 text-slate-500"
      }`}
      onPointerDown={(e) => onPick && e.stopPropagation()}
      onClick={onPick}
      disabled={!onPick}
    >
      <ImagePlus size={18} />
      {onPick && label}
    </button>
  );
}

/**
 * URL field + upload button for elements that hold a video. `onDismiss` removes the empty element.
 * Only the controls swallow pointer-down, so the rest of the card still selects/drags the element.
 */
export function VideoSourceInput({ onUrl, onUpload, onDismiss, dark = true }) {
  const [value, setValue] = useState("");
  const submit = () => value.trim() && onUrl(value.trim());
  const keepPointer = (e) => e.stopPropagation();
  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-center gap-2 p-3 text-[11px] ${dark ? "bg-slate-900 text-slate-300" : "bg-slate-100 text-slate-600"}`}
    >
      {onDismiss && (
        <button
          type="button"
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full opacity-70 hover:bg-white/10 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
          onPointerDown={keepPointer}
          onClick={onDismiss}
          title="Remove video"
          aria-label="Remove video"
        >
          <X size={14} />
        </button>
      )}
      <span className="opacity-80">Paste a YouTube, Vimeo, Loom or MP4 link</span>
      <div className="flex w-full max-w-[260px] gap-1" onPointerDown={keepPointer}>
        <input
          className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white outline-none focus:border-blue-400"
          placeholder="https://youtube.com/watch?v=…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            // Escape on an untouched field backs out of the empty video entirely.
            else if (e.key === "Escape" && !value.trim() && onDismiss) onDismiss();
          }}
          onBlur={submit}
        />
        <button type="button" className="rounded-md bg-blue-500 px-2 text-white" onClick={submit} aria-label="Use link">
          <Link2 size={13} />
        </button>
      </div>
      <button type="button" className="flex items-center gap-1 rounded-full border border-current px-2.5 py-1 opacity-80 hover:opacity-100" onPointerDown={keepPointer} onClick={onUpload}>
        <Upload size={12} /> Upload a clip
      </button>
    </div>
  );
}
