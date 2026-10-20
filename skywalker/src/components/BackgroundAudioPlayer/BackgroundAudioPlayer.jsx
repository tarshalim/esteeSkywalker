import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import cdUrl from "../../assets/journey/cd.svg";
import noteUrl from "../../assets/journey/music-note-02.svg";
import notesUrl from "../../assets/journey/music-notes-01.svg";
import { MUSIC_SOURCES, musicExternalUrl } from "../../lib/music";
import { createMusicEngine } from "../../lib/musicEngines";
import "./BackgroundAudioPlayer.css";

const NOTE_SHAPES = [noteUrl, notesUrl];
const NOTE_COLORS = ["var(--blue-bright)", "var(--yellow)", "var(--blue)", "var(--yellow-bright)"];
const NOTE_INTERVAL_MS = 700;
// Hidden tabs can stall animationend; cap the list so notes never pile up.
const MAX_NOTES = 10;
const GESTURE_EVENTS = ["pointerdown", "keydown"];

let noteSeq = 0;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function makeNote() {
  return {
    id: ++noteSeq,
    style: {
      "--note-src": `url("${NOTE_SHAPES[Math.floor(Math.random() * NOTE_SHAPES.length)]}")`,
      "--note-color": NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
      "--note-size": `${randomBetween(14, 22).toFixed(1)}px`,
      // The widget sits in the bottom-right corner, so notes waft up and to the left.
      "--note-dx": `${randomBetween(-46, -6).toFixed(1)}px`,
      "--note-sway": `${randomBetween(6, 14).toFixed(1)}px`,
      "--note-rot": `${randomBetween(-35, 35).toFixed(0)}deg`,
      "--note-dur": `${randomBetween(2.2, 3).toFixed(2)}s`,
    },
  };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Fixed corner CD that plays a post's background track — an uploaded file,
 * a YouTube video (hidden player) or a Spotify track (compact embed). Tries to
 * autoplay on mount; when the browser blocks that, it waits for the reader's
 * first tap or key press anywhere on the page (or a click on the CD itself).
 * Key it by musicKey(music) so a new track gets a fresh engine.
 */
export default function BackgroundAudioPlayer({ music, fallbackTitle }) {
  const rootRef = useRef(null);
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false); // autoplay refused, waiting for a gesture
  const [failed, setFailed] = useState(false);
  const [sourceTitle, setSourceTitle] = useState("");
  const [embedOpen, setEmbedOpen] = useState(true);
  const [notes, setNotes] = useState([]);
  // An explicit pause on the CD must win over the pending "play on first gesture".
  const userPausedRef = useRef(false);
  const reducedMotion = usePrefersReducedMotion();
  const isSpotify = music.type === "spotify";

  useEffect(() => {
    const mountEl = mountRef.current;
    let cancelled = false;
    userPausedRef.current = false;

    const stopListening = () => GESTURE_EVENTS.forEach((type) => document.removeEventListener(type, onGesture, true));
    function onGesture(e) {
      // Taps on the widget (CD, tooltip, Spotify embed) go through their own controls.
      if (rootRef.current?.contains(e.target)) return;
      stopListening();
      if (!userPausedRef.current) engineRef.current?.play();
    }

    const engine = createMusicEngine(music, mountEl, {
      onPlay: () => {
        if (cancelled) return;
        stopListening();
        setPlaying(true);
        setBlocked(false);
      },
      onPause: () => !cancelled && setPlaying(false),
      onBlocked: () => {
        if (cancelled || userPausedRef.current) return;
        setBlocked(true);
        stopListening();
        GESTURE_EVENTS.forEach((type) => document.addEventListener(type, onGesture, true));
      },
      onError: (err) => {
        if (cancelled) return;
        console.warn("Background music unavailable", err);
        setFailed(true);
      },
      onTitle: (title) => !cancelled && setSourceTitle(title),
    });
    engineRef.current = engine;

    return () => {
      cancelled = true;
      stopListening();
      engineRef.current = null;
      // Tears down the <audio>/iframe so music stops the moment the reader leaves.
      engine.destroy();
    };
    // The parent keys this component by track, so `music` is fixed for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!playing || reducedMotion) return;
    const spawn = () => setNotes((prev) => [...prev.slice(-(MAX_NOTES - 1)), makeNote()]);
    spawn();
    const timer = setInterval(spawn, NOTE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, reducedMotion]);

  const removeNote = useCallback((id) => setNotes((prev) => prev.filter((n) => n.id !== id)), []);

  const toggle = () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (playing) {
      userPausedRef.current = true;
      engine.pause();
    } else {
      userPausedRef.current = false;
      engine.play();
    }
  };

  if (failed) return null;

  const title = music.title || sourceTitle || fallbackTitle || "Background music";
  const source = MUSIC_SOURCES[music.type];
  const externalUrl = musicExternalUrl(music);
  const label = playing ? "Pause background music" : "Play background music";
  const showHint = blocked && !playing && !userPausedRef.current && !(isSpotify && embedOpen);

  return (
    <div
      ref={rootRef}
      className={`bg-audio${playing ? " is-playing" : ""}${isSpotify ? " bg-audio--spotify" : ""}`}
    >
      {isSpotify ? (
        <div className={`bg-audio-embed${embedOpen ? " is-open" : ""}`} aria-hidden={!embedOpen}>
          <button
            type="button"
            className="bg-audio-embed-close"
            onClick={() => setEmbedOpen(false)}
            aria-label="Hide Spotify player"
            tabIndex={embedOpen ? 0 : -1}
          >
            <X size={14} aria-hidden="true" />
          </button>
          {/* Kept mounted (just hidden) when closed so the track keeps playing. */}
          <div ref={mountRef} className="bg-audio-embed-frame" />
        </div>
      ) : (
        <div ref={mountRef} className="bg-audio-engine" aria-hidden="true" />
      )}

      <div className="bg-audio-notes" aria-hidden="true">
        {notes.map((note) => (
          <span key={note.id} className="bg-audio-note" style={note.style} onAnimationEnd={() => removeNote(note.id)} />
        ))}
      </div>

      {showHint && (
        <span className="bg-audio-hint" aria-hidden="true">
          Tap for music
        </span>
      )}

      <div className="bg-audio-tip" role="tooltip" id="bg-audio-tip">
        <span className="bg-audio-tip-status">
          {playing ? "Now playing" : "Paused"} · {source.label}
        </span>
        <span className="bg-audio-tip-title">{title}</span>
        {(externalUrl || (isSpotify && !embedOpen)) && (
          <span className="bg-audio-tip-actions">
            {externalUrl && (
              <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="bg-audio-tip-link">
                <ExternalLink size={12} aria-hidden="true" /> {source.app}
              </a>
            )}
            {isSpotify && !embedOpen && (
              <button type="button" className="bg-audio-tip-link" onClick={() => setEmbedOpen(true)}>
                Show player
              </button>
            )}
          </span>
        )}
      </div>

      <button
        type="button"
        className="bg-audio-disc"
        onClick={toggle}
        aria-label={`${label}: ${title}`}
        aria-pressed={playing}
        aria-describedby="bg-audio-tip"
      >
        <img src={cdUrl} alt="" className="bg-audio-cd" draggable="false" />
        <span className="bg-audio-strike" aria-hidden="true" />
      </button>
    </div>
  );
}
