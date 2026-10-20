import { useEffect, useRef, useState } from "react";
import { Music2, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { audioEmbedSrc } from "../../../../lib/media";

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Streaming-app style "now playing" card: cover art, title/artist, progress
 * and transport controls. Uploaded/direct audio plays in place; Spotify and
 * YouTube links swap the card for the provider's embed when played.
 */
export default function MusicCardContent({ element, editable, onRequestSource, onPickMedia }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showEmbed, setShowEmbed] = useState(false);
  const embed = audioEmbedSrc(element);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    audio.volume = element.volume ?? 0.8;
    const onTime = () => setProgress(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnd);
    };
  }, [element.src, element.volume]);

  if (showEmbed && embed) {
    return (
      <iframe
        className="w-full h-full rounded-2xl border-0"
        src={embed}
        title="Embedded audio player"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
        loading="lazy"
      />
    );
  }

  const togglePlay = () => {
    if (!element.sourceType) return editable && onRequestSource?.(element.id);
    if (embed) return editable ? onRequestSource?.(element.id) : setShowEmbed(true);
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play().catch(() => {});
    setPlaying(!playing);
  };

  const pct = duration ? (progress / duration) * 100 : 0;
  const accent = element.accentColor || "#3b82f6";

  return (
    <div
      className="flex w-full h-full items-center gap-[4%] overflow-hidden rounded-2xl p-[3.5%] text-white shadow-[0_10px_24px_rgba(0,0,0,0.35)] font-['Plus_Jakarta_Sans',Inter,sans-serif]"
      style={{ background: `linear-gradient(135deg, ${accent} 0%, #181818 80%)` }}
    >
      {!embed && element.src && <audio ref={audioRef} src={element.src} muted={element.muted} preload="metadata" />}

      <button
        type="button"
        className="relative h-full aspect-square shrink-0 overflow-hidden rounded-lg bg-white/10 shadow-lg"
        onClick={editable ? () => onPickMedia?.(element.id, "image/*", (url) => ({ coverSrc: url })) : undefined}
        tabIndex={editable ? 0 : -1}
        title={editable ? "Change cover art" : undefined}
      >
        {element.coverSrc ? (
          <img src={element.coverSrc} alt="" draggable={false} className="w-full h-full object-cover" />
        ) : (
          <Music2 className="m-auto h-1/3 w-1/3 text-white/70" />
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-[3px]">
        <button
          type="button"
          className="truncate text-left text-[15px] font-bold leading-tight"
          onClick={editable ? () => onRequestSource?.(element.id) : undefined}
          tabIndex={editable ? 0 : -1}
        >
          {element.title || (editable ? "Add a track…" : "Untitled track")}
        </button>
        <div className="truncate text-[12px] text-white/70">{element.artist || "Unknown artist"}</div>
        <div
          className="mt-1 h-1 w-full cursor-pointer rounded-full bg-white/25"
          onClick={(e) => {
            const audio = audioRef.current;
            if (!audio || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
          }}
        >
          <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-white/60">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="flex items-center justify-between px-[2%] text-white/80">
          <Shuffle size={14} aria-hidden="true" />
          <button
            type="button"
            aria-label="Restart track"
            onClick={() => {
              if (audioRef.current) audioRef.current.currentTime = 0;
            }}
          >
            <SkipBack size={16} fill="currentColor" />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="translate-x-px" />}
          </button>
          <SkipForward size={16} fill="currentColor" aria-hidden="true" />
          <Repeat size={14} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
