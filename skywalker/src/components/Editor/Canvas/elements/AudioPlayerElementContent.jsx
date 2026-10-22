import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Music2, Disc3, Radio } from "lucide-react";
import { audioEmbedSrc, trimmedAudioEmbed } from "../../../../lib/media";
import { attachTrim, readTrim } from "../../../../lib/mediaTrim";
import TrimmedEmbed from "../../TrimmedEmbed";

const SKIN_ICON = { cassette: Disc3, vinyl: Disc3, pill: Radio };

function isEmbed(sourceType) {
  return sourceType === "youtube" || sourceType === "spotify";
}

export default function AudioPlayerElementContent({ element, editable, actions, onRequestSource, autoplayOnVisible }) {
  const audioRef = useRef(null);
  const containerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [localVolume, setLocalVolume] = useState(element.volume);

  useEffect(() => {
    setLocalVolume(element.volume);
    if (audioRef.current) audioRef.current.volume = element.volume;
  }, [element.volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const onTime = () => setProgress(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    // play/pause also fire when the trim loops or stops the track at its end time.
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    const detachTrim = attachTrim(audio, readTrim({ startSec: element.startSec, endSec: element.endSec, loop: element.loop }));
    return () => {
      detachTrim();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [element.src, element.sourceType, element.startSec, element.endSec, element.loop]);

  // Auto-play-on-scroll-into-view: only meaningful in the published/read-only render.
  useEffect(() => {
    if (!autoplayOnVisible || !element.autoplayOnScroll || isEmbed(element.sourceType)) return undefined;
    const node = containerRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && audioRef.current) {
          audioRef.current.play().then(() => setPlaying(true)).catch(() => {});
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [autoplayOnVisible, element.autoplayOnScroll, element.sourceType]);

  if (!element.sourceType) {
    return (
      <button
        type="button"
        className="w-full h-full flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-500 bg-slate-900/60 text-slate-300 text-xs"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onRequestSource?.(element.id)}
      >
        <Music2 size={18} />
        {editable ? "Add music / audio" : "No audio source"}
      </button>
    );
  }

  if (isEmbed(element.sourceType)) {
    const src = audioEmbedSrc(element);
    const trimmed = trimmedAudioEmbed(element);
    return (
      <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden bg-slate-900">
        {trimmed ? (
          <TrimmedEmbed music={trimmed} className={`w-full h-full ${editable ? "pointer-events-none" : ""}`} />
        ) : src ? (
          <iframe
            className={`w-full h-full ${editable ? "pointer-events-none" : ""}`}
            src={src}
            title="Embedded audio player"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Invalid link</div>
        )}
      </div>
    );
  }

  const Icon = SKIN_ICON[element.widgetStyle] || Radio;
  // The scrubber covers just the trimmed segment.
  const trim = readTrim({ startSec: element.startSec, endSec: element.endSec });
  const segmentEnd = trim.end != null ? Math.min(trim.end, duration || trim.end) : duration;
  const segmentLength = Math.max(0, segmentEnd - trim.start);
  const pct = segmentLength ? (Math.min(Math.max(0, progress - trim.start), segmentLength) / segmentLength) * 100 : 0;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play().catch(() => {});
  };

  const skinClass =
    element.widgetStyle === "cassette"
      ? "bg-gradient-to-br from-amber-100 to-amber-200 border-amber-300"
      : element.widgetStyle === "vinyl"
      ? "bg-slate-900 border-slate-700"
      : "bg-white/10 backdrop-blur-xl border-white/20";

  const textClass = element.widgetStyle === "cassette" ? "text-amber-900" : "text-white";

  return (
    <div
      ref={containerRef}
      className={`w-full h-full rounded-2xl border shadow-lg px-3 py-2 flex items-center gap-2 ${skinClass} ${textClass}`}
      onPointerDown={(e) => editable && e.stopPropagation()}
    >
      {/* Looping is set by attachTrim, which also keeps playback inside the trim. */}
      <audio ref={audioRef} src={element.src} muted={element.muted} />
      <button
        type="button"
        className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center"
        style={{ background: element.accentColor, color: "#0f172a" }}
        onClick={togglePlay}
        title={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="text-[11px] truncate flex items-center gap-1 opacity-80">
          <Icon size={11} className={element.widgetStyle === "vinyl" && playing ? "animate-spin" : ""} />
          {element.title || "Untitled track"}
        </div>
        <input
          type="range"
          min={trim.start}
          max={segmentEnd || 0}
          value={progress}
          onChange={(e) => {
            const t = Number(e.target.value);
            if (audioRef.current) audioRef.current.currentTime = t;
            setProgress(t);
          }}
          className="w-full accent-current h-1"
          style={{ accentColor: element.accentColor, background: `linear-gradient(to right, ${element.accentColor} ${pct}%, transparent ${pct}%)` }}
        />
      </div>

      <button
        type="button"
        className="shrink-0 p-1 opacity-80 hover:opacity-100"
        onClick={() => actions?.updateElement(element.id, { muted: !element.muted })}
        title={element.muted ? "Unmute" : "Mute"}
      >
        {element.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={localVolume}
        className="w-12 h-1 accent-current"
        onPointerDown={(e) => e.stopPropagation()}
        onInput={(e) => {
          const v = Number(e.target.value);
          setLocalVolume(v);
          if (audioRef.current) audioRef.current.volume = v;
        }}
        onPointerUp={() => actions?.updateElement(element.id, { volume: localVolume })}
      />
    </div>
  );
}
