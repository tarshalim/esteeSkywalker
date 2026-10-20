import { useRef, useState } from "react";
import { Disc3, Eye, EyeOff, Music, RefreshCw, SquarePlay, Trash2, Upload } from "lucide-react";
import {
  AUDIO_ACCEPT,
  MUSIC_SOURCES,
  fetchMusicTitle,
  musicFromLink,
  spotifyEmbedUrl,
  uploadBlogAudio,
  validateAudioFile,
  youTubeEmbedUrl,
} from "../../lib/music";

const TABS = [
  { id: "upload", label: "Upload" },
  { id: "youtube", label: "YouTube" },
  { id: "spotify", label: "Spotify" },
];

const LINK_HINTS = {
  youtube: { placeholder: "https://youtu.be/… or youtube.com/watch?v=…", error: "That doesn't look like a YouTube video link." },
  spotify: { placeholder: "https://open.spotify.com/track/…", error: "Paste a Spotify track link (open.spotify.com/track/…)." },
};

function SourceIcon({ type }) {
  if (type === "youtube") return <SquarePlay size={16} aria-hidden="true" />;
  if (type === "spotify") return <Disc3 size={16} aria-hidden="true" />;
  return <Music size={16} aria-hidden="true" />;
}

function MusicPreview({ music }) {
  if (music.type === "upload") return <audio className="editor-music-preview" src={music.url} controls autoPlay preload="metadata" />;
  if (music.type === "youtube") {
    return (
      <iframe
        className="editor-music-embed editor-music-embed--youtube"
        src={`${youTubeEmbedUrl(music.id)}?autoplay=1`}
        title="YouTube preview"
        allow="autoplay; encrypted-media"
        allowFullScreen
      />
    );
  }
  return (
    <iframe
      className="editor-music-embed"
      src={spotifyEmbedUrl(music.id)}
      title="Spotify preview"
      allow="autoplay; clipboard-write; encrypted-media"
      loading="lazy"
    />
  );
}

function MusicPicker({ onPick, onCancel, onError }) {
  const inputRef = useRef(null);
  const [tab, setTab] = useState("upload");
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    const invalid = validateAudioFile(file);
    if (invalid) return onError(invalid);
    setBusy(true);
    try {
      onPick(await uploadBlogAudio(file));
    } catch (err) {
      console.error(err);
      onError(`Couldn't upload audio: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleLink = async (e) => {
    e.preventDefault();
    const music = musicFromLink(tab, link);
    if (!music) return setLinkError(LINK_HINTS[tab].error);
    setBusy(true);
    const title = await fetchMusicTitle(music);
    setBusy(false);
    onPick({ ...music, title });
  };

  const switchTab = (id) => {
    setTab(id);
    setLink("");
    setLinkError("");
  };

  return (
    <div className="editor-music-picker">
      <div className="editor-music-tabs" role="tablist" aria-label="Music source">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`editor-music-tab${tab === t.id ? " is-on" : ""}`}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "upload" ? (
        <button
          type="button"
          className={`editor-music-drop${dragging ? " is-dragging" : ""}`}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
        >
          <Upload size={18} aria-hidden="true" />
          <span>{busy ? "Uploading…" : "Drop an audio file here, or click to choose"}</span>
          <small>.mp3, .m4a or .wav</small>
          <input
            ref={inputRef}
            type="file"
            accept={AUDIO_ACCEPT}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              handleFile(file);
            }}
          />
        </button>
      ) : (
        <form className="editor-music-row" onSubmit={handleLink}>
          <input
            className="editor-date-input editor-music-url"
            placeholder={LINK_HINTS[tab].placeholder}
            aria-label={`${MUSIC_SOURCES[tab].label} link`}
            aria-invalid={Boolean(linkError)}
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setLinkError("");
            }}
          />
          <button type="submit" className="editor-btn" disabled={busy || !link.trim()}>
            {busy ? "Adding…" : "Add"}
          </button>
        </form>
      )}
      {linkError && <p className="editor-music-warning">{linkError}</p>}
      {tab === "spotify" && !linkError && (
        <p className="editor-music-note">Readers without Spotify Premium hear a 30-second preview.</p>
      )}

      {onCancel && (
        <button type="button" className="editor-music-cancel" onClick={onCancel}>
          Keep current music
        </button>
      )}
    </div>
  );
}

/**
 * Background music for a post: pick an uploaded file, a YouTube video or a
 * Spotify track. `value` is a music object (see lib/music.js) or null. The
 * editor owns storage cleanup, since a replaced file may still be the saved one.
 */
export default function BackgroundMusicField({ value, onChange, onError }) {
  const [replacing, setReplacing] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const pick = (music) => {
    setReplacing(false);
    setPreviewing(false);
    onChange(music);
  };

  return (
    <div className="editor-music">
      <span className="editor-metadata-label">
        <Music size={12} aria-hidden="true" /> Background music
      </span>

      {value && !replacing ? (
        <div className="editor-music-card">
          <div className="editor-music-info">
            <span className={`editor-music-badge editor-music-badge--${value.type}`}>
              <SourceIcon type={value.type} />
            </span>
            <div className="editor-music-meta">
              <input
                className="editor-music-title"
                value={value.title ?? ""}
                placeholder="Track title"
                aria-label="Track title"
                onChange={(e) => onChange({ ...value, title: e.target.value })}
              />
              <span className="editor-music-type">{MUSIC_SOURCES[value.type]?.label}</span>
            </div>
          </div>
          <div className="editor-music-row">
            <button type="button" className="editor-btn" onClick={() => setPreviewing((p) => !p)} aria-pressed={previewing}>
              {previewing ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              {previewing ? "Hide preview" : "Preview"}
            </button>
            <button
              type="button"
              className="editor-btn"
              onClick={() => {
                setPreviewing(false);
                setReplacing(true);
              }}
            >
              <RefreshCw size={14} aria-hidden="true" /> Replace music
            </button>
            <button type="button" className="editor-btn editor-music-remove" onClick={() => pick(null)}>
              <Trash2 size={14} aria-hidden="true" /> Remove music
            </button>
          </div>
          {previewing && <MusicPreview music={value} />}
        </div>
      ) : (
        <MusicPicker onPick={pick} onCancel={value ? () => setReplacing(false) : null} onError={onError} />
      )}
    </div>
  );
}
