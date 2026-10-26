import { useState } from "react";
import { X, Upload, Link2 } from "lucide-react";
import { fileToUrl } from "../../../lib/files";
import { canTrimAudioSource } from "../../../lib/media";
import TrimFields from "../TrimFields";

function detectUrlSourceType(url) {
  if (/youtu\.be\/|youtube\.com\//.test(url)) return "youtube";
  if (/open\.spotify\.com\//.test(url)) return "spotify";
  return "url";
}

const WIDGET_STYLES = [
  { id: "card", label: "Music Card" },
  { id: "pill", label: "Glass Pill" },
  { id: "cassette", label: "Cassette" },
  { id: "vinyl", label: "Vinyl" },
];

export default function AudioSourceModal({ element, palette, onSave, onClose }) {
  const [tab, setTab] = useState("upload");
  const [url, setUrl] = useState(element.src && element.sourceType !== "upload" ? element.src : "");
  const [title, setTitle] = useState(element.title || "");
  const [artist, setArtist] = useState(element.artist || "");
  const [widgetStyle, setWidgetStyle] = useState(element.widgetStyle || "pill");
  const [accentColor, setAccentColor] = useState(element.accentColor || "#3b82f6");
  const [pendingUpload, setPendingUpload] = useState(null);
  const [trim, setTrim] = useState({ startSec: element.startSec ?? null, endSec: element.endSec ?? null, loop: element.loop ?? false });
  const [trimError, setTrimError] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToUrl(file);
    setPendingUpload({ dataUrl, name: file.name });
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  };

  const urlSourceType = detectUrlSourceType(url.trim());
  // Albums/playlists have no single timeline to trim.
  const trimmable = tab === "upload" || !url.trim() || canTrimAudioSource(urlSourceType, url.trim());
  const canSave = (tab === "upload" ? Boolean(pendingUpload || element.sourceType === "upload") : url.trim().length > 0) && !(trimmable && trimError);
  const savedTrim = trimmable ? trim : { startSec: null, endSec: null, loop: trim.loop };

  const handleSave = () => {
    if (tab === "upload") {
      onSave({
        sourceType: "upload",
        src: pendingUpload?.dataUrl ?? element.src,
        title,
        artist,
        widgetStyle,
        accentColor,
        ...savedTrim,
      });
    } else {
      onSave({
        sourceType: urlSourceType,
        src: url.trim(),
        title,
        artist,
        widgetStyle,
        accentColor,
        ...savedTrim,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-full overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Add music</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1 mb-4 rounded-lg bg-slate-800 p-1">
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs ${
              tab === "upload" ? "bg-blue-500/20 text-blue-300" : "text-slate-400"
            }`}
            onClick={() => setTab("upload")}
          >
            <Upload size={13} /> Upload MP3
          </button>
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs ${
              tab === "url" ? "bg-blue-500/20 text-blue-300" : "text-slate-400"
            }`}
            onClick={() => setTab("url")}
          >
            <Link2 size={13} /> Paste URL
          </button>
        </div>

        {tab === "upload" ? (
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-600 py-6 text-xs text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-300">
            <Upload size={20} />
            {pendingUpload?.name || (element.sourceType === "upload" ? "Replace file…" : "Choose an MP3 file")}
            <input type="file" accept="audio/*" hidden onChange={handleFile} />
          </label>
        ) : (
          <input
            className="w-full text-sm px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 outline-none focus:border-blue-400"
            placeholder="Spotify, YouTube, or a direct ambient-track URL…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        )}

        <input
          className="w-full mt-3 text-sm px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 outline-none focus:border-blue-400"
          placeholder="Track title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="w-full mt-2 text-sm px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 outline-none focus:border-blue-400"
          placeholder="Artist (optional)"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
        />

        <div className="mt-4">
          {trimmable ? (
            <TrimFields
              dark
              value={trim}
              onChange={setTrim}
              onErrorChange={setTrimError}
              hint={
                urlSourceType === "spotify" && tab === "url"
                  ? "Without Spotify Premium, readers only hear a 30-second preview."
                  : "Optional: play only part of the track, e.g. 0:45 to 2:15."
              }
            />
          ) : (
            <p className="m-0 text-[11px] text-slate-400">Start and end times work with single tracks and episodes, not albums or playlists.</p>
          )}
        </div>

        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1.5">Widget style</div>
          <div className="flex gap-1.5">
            {WIDGET_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`flex-1 rounded-lg border py-1.5 text-xs ${
                  widgetStyle === s.id ? "border-blue-400 bg-blue-500/20 text-blue-300" : "border-slate-600 text-slate-300"
                }`}
                onClick={() => setWidgetStyle(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1.5">Accent color</div>
          <div className="flex gap-1.5">
            {palette.map((c) => (
              <button
                key={c}
                type="button"
                className={`h-6 w-6 rounded-full border-2 ${accentColor === c ? "border-white" : "border-transparent"}`}
                style={{ background: c }}
                onClick={() => setAccentColor(c)}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="text-xs px-3 py-1.5 rounded-full text-slate-300 hover:bg-slate-800" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            className="text-xs px-3 py-1.5 rounded-full bg-blue-400 text-slate-900 font-semibold disabled:opacity-40"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
