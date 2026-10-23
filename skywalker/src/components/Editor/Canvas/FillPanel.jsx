import { useEffect, useState } from "react";
import { Clapperboard, Images, ImagePlus, Link2, Loader2, Type, Upload } from "lucide-react";
import { hasText, mediaSlot } from "../../../lib/canvasElements";
import { collectMedia } from "../../../lib/media";
import { getPhotos } from "../../../lib/photoStore";

const GALLERY_LIMIT = 60;
// Anything from the gallery can go on a piece: what its slot can't take is laid on top instead.
const GALLERY_ACCEPTS = ["image", "video"];

function Action({ icon: Icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      className="flex items-center gap-2.5 rounded-xl bg-slate-800/80 px-3 py-2 text-left transition hover:bg-blue-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
      onClick={onClick}
    >
      <Icon size={17} className="shrink-0 text-blue-300" />
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] font-medium text-slate-100">{label}</span>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </span>
    </button>
  );
}

/** Thumbnails of the user's gallery uploads; `accepts` limits them to the media the target takes. */
function GalleryGrid({ accepts, onPick }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    getPhotos()
      .then((photos) => live && setItems(collectMedia(photos, []).filter((m) => accepts.includes(m.type)).slice(0, GALLERY_LIMIT)))
      .catch((err) => live && setError(err.message || "Couldn't load your gallery."));
    return () => {
      live = false;
    };
  }, [accepts]);

  if (error) return <p className="px-1 py-2 text-[12px] text-rose-300">{error}</p>;
  if (!items) {
    return (
      <p className="flex items-center gap-1.5 px-1 py-2 text-[12px] text-slate-400">
        <Loader2 size={13} className="animate-spin" /> Loading your gallery…
      </p>
    );
  }
  if (!items.length) return <p className="px-1 py-2 text-[12px] text-slate-400">Nothing in your gallery yet.</p>;
  return (
    <div className="grid max-h-[220px] grid-cols-4 gap-1 overflow-y-auto overscroll-contain">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="relative aspect-square overflow-hidden rounded-md bg-slate-800 hover:ring-2 hover:ring-blue-400 focus-visible:ring-2 focus-visible:ring-blue-400"
          onClick={() => onPick(item)}
          aria-label={item.caption || (item.type === "video" ? "Gallery clip" : "Gallery photo")}
        >
          {item.thumbUrl ? (
            <img src={item.thumbUrl} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
          ) : (
            <video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
          )}
          {item.type === "video" && <Clapperboard size={12} className="absolute bottom-1 right-1 text-white drop-shadow" />}
        </button>
      ))}
    </div>
  );
}

/**
 * Click-to-edit actions for a scrapbook piece: type straight onto it, or put
 * a photo/clip in it. Media goes into the piece's own slot when it has one
 * that takes that media (a polaroid's print, a frame's window); otherwise it's
 * laid on top of the piece and attached to it (`onAddInside`).
 */
export default function FillPanel({ element, actions, onPickMedia, onAddInside, onDone }) {
  const slot = mediaSlot(element);
  const takes = (type) => Boolean(slot?.accepts.includes(type));
  const [link, setLink] = useState("");
  const [showGallery, setShowGallery] = useState(false);
  const fillOrAdd = (type, src) => {
    if (takes(type)) actions.updateElement(element.id, slot.fill(src, type));
    else onAddInside(element.id, type, src);
    onDone();
  };
  const photoVerb = takes("image") ? (slot.filled ? "Replace the photo" : "Upload a photo") : "Add a photo on top";
  const writeLabel = hasText(element) ? "Type on it" : "Add text on top";

  return (
    <div className="flex w-[272px] flex-col gap-1.5">
      <Action
        icon={Type}
        label={writeLabel}
        hint="Fonts, colours and rotation in the toolbar"
        onClick={() => {
          onDone();
          if (hasText(element)) actions.edit(element.id);
          else onAddInside(element.id, "text");
        }}
      />
      <Action
        icon={ImagePlus}
        label={photoVerb}
        hint={takes("image") ? "Fills the frame, cropped to fit" : "Moves and turns with this piece"}
        onClick={() => {
          onDone();
          if (takes("image")) onPickMedia(element.id, "image/*", (url) => slot.fill(url, "image"));
          else onAddInside(element.id, "image");
        }}
      />

      <div className="rounded-xl bg-slate-800/80 p-2">
        <div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-slate-100">
          <Clapperboard size={17} className="text-blue-300" />
          {takes("video") ? (slot.filled ? "Change the video" : "Play a video in it") : "Add a video on top"}
        </div>
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (link.trim()) fillOrAdd("video", link.trim());
          }}
        >
          <input
            className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-blue-400"
            placeholder="YouTube, Vimeo, Loom or .mp4 link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            aria-label="Video link"
          />
          <button type="submit" className="rounded-md bg-blue-500 px-2 text-white disabled:opacity-40" disabled={!link.trim()} aria-label="Use link">
            <Link2 size={13} />
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-600 px-2 text-slate-200 hover:bg-slate-700"
            title="Upload a clip"
            aria-label="Upload a clip"
            onClick={() => {
              onDone();
              if (takes("video")) onPickMedia(element.id, "video/*", (url) => slot.fill(url, "video"));
              else onAddInside(element.id, "video");
            }}
          >
            <Upload size={13} />
          </button>
        </form>
      </div>

      <Action icon={Images} label="Choose from your gallery" onClick={() => setShowGallery((v) => !v)} />
      {showGallery && <GalleryGrid accepts={GALLERY_ACCEPTS} onPick={(item) => fillOrAdd(item.type, item.url)} />}
    </div>
  );
}
