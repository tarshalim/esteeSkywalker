import { useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronRight, FilePlus2, ImagePlus, Link2, LoaderCircle, Luggage, MapPin, Pencil, Unlink, Users, X } from "lucide-react";
import { formatBlogDate, formatDateRange } from "../../utils/dateFilters";
import { formatWeather } from "../../lib/weather";
import { formatCoords } from "../../utils/geo";
import { PLACEHOLDER_COVER } from "../../lib/media";
import { allCompanions } from "../../lib/hierarchy";

const MAX_COVERS = 6;

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function PostRow({ post, canDetach, busy, onOpenPost, onDetach }) {
  const weather = formatWeather(post.weather);
  return (
    <li className="group flex items-stretch gap-1">
      <button
        type="button"
        onClick={() => onOpenPost(post)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-black/5 focus-visible:bg-black/5"
        aria-label={`Read “${post.title}”`}
      >
        <img src={post.coverImage || PLACEHOLDER_COVER} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{post.title}</span>
            {post.status === "draft" && (
              <span className="shrink-0 rounded-full bg-amber-400/25 px-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                Draft
              </span>
            )}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>{formatBlogDate(post)}</span>
            {weather && (
              <span className="rounded-full px-2 py-px" style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}>
                {weather}
              </span>
            )}
          </span>
        </span>
        <span className="hidden shrink-0 items-center text-xs font-semibold sm:flex" style={{ color: "var(--text-strong)" }}>
          Read
          <ChevronRight size={14} aria-hidden="true" />
        </span>
      </button>
      {canDetach && (
        <button
          type="button"
          onClick={() => onDetach(post)}
          disabled={Boolean(busy)}
          className="inline-flex w-9 shrink-0 items-center justify-center rounded-xl opacity-60 transition hover:bg-red-500/10 hover:text-red-600 hover:opacity-100 disabled:opacity-30 sm:opacity-0 sm:group-hover:opacity-60 sm:focus-visible:opacity-100"
          aria-label={`Remove “${post.title}” from this pin`}
          title="Remove from this pin"
        >
          <Unlink size={15} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

const SMALL_ACTION =
  "inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition hover:bg-black/5 disabled:opacity-40";

/** One trip under the location: its dates, who came, its stories and photo count. */
function TripSection({ trip, canEdit, busy, rowProps, onNewStory, onAddPhotos, onEditTrip }) {
  const companions = allCompanions(trip);
  return (
    <section className="rounded-2xl border p-2" style={{ borderColor: "var(--glass-border)" }} aria-label={trip.title}>
      <header className="flex items-start gap-2 px-1 pt-1">
        <Luggage size={16} className="mt-0.5 shrink-0" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold">{trip.title}</h3>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {formatDateRange(trip.startDate, trip.endDate)} · {plural(trip.posts.length, "story", "stories")} · {plural(trip.photos.length, "photo")}
          </p>
          {companions.length > 0 && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs" style={{ color: "var(--text-muted)" }}>
              <Users size={12} aria-hidden="true" />
              {companions.join(", ")}
            </p>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => onEditTrip(trip)}
            disabled={Boolean(busy)}
            className="-m-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/10 disabled:opacity-40"
            aria-label={`Edit “${trip.title}”`}
            title="Edit trip"
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        )}
      </header>
      {trip.posts.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1">
          {trip.posts.map((post) => (
            <PostRow key={post.id} post={post} {...rowProps} />
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-1 flex gap-1.5 px-1 pb-1">
          <button type="button" onClick={() => onNewStory(trip)} disabled={Boolean(busy)} className={SMALL_ACTION} style={{ borderColor: "var(--border)" }}>
            <FilePlus2 size={13} aria-hidden="true" />
            Story
          </button>
          <button type="button" onClick={() => onAddPhotos(trip)} disabled={Boolean(busy)} className={SMALL_ACTION} style={{ borderColor: "var(--border)" }}>
            <ImagePlus size={13} aria-hidden="true" />
            Photos
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Floating preview for a location, opened by clicking its pin on the globe:
 * where it is, cover thumbnails, then everything under it — each trip with
 * its dates, companions, stories and photos, and any stories not in a trip.
 * Picking a story opens the full post. Editors can create/edit trips, start a
 * story or upload photos (inside a trip or not), and attach existing posts.
 * A card on the right of the globe on desktop, a bottom sheet on phones.
 *
 * @param {import("../../lib/pinStore").StoryPin} pin
 * @param {boolean} canEdit
 * @param {?string} busy - label of an action in flight ("Attaching…"), disables actions
 * @param {function(import("../../lib/pinStore").BlogPost): void} onOpenPost
 * @param {function(?import("../../types/hierarchy").Trip): void} onNewStory - in that trip, or none
 * @param {function(?import("../../types/hierarchy").Trip): void} onAddPhotos - into that trip, or none
 * @param {function(): void} onNewTrip
 * @param {function(import("../../types/hierarchy").TripNode): void} onEditTrip
 */
export default function PinQuickCard({
  pin,
  canEdit,
  busy = null,
  onClose,
  onOpenPost,
  onNewStory,
  onAddPhotos,
  onNewTrip,
  onEditTrip,
  onAttach,
  onDetach,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { posts, trips = [], photos = [] } = pin;
  const tripIds = new Set(trips.map((t) => t.id));
  const loosePosts = posts.filter((p) => !tripIds.has(p.tripId));
  const covers = [
    ...posts.map((p) => p.coverImage).filter((src) => src && src !== PLACEHOLDER_COVER),
    ...photos.filter((p) => p.type !== "video").map((p) => p.thumbUrl || p.url),
  ]
    .filter(Boolean)
    .slice(0, MAX_COVERS);
  const subtitle = pin.placeName && pin.placeName !== pin.title ? pin.placeName : formatCoords(pin.lat, pin.lng);
  const titleId = `pin-card-${pin.id}`;
  const counts = [
    trips.length > 0 && plural(trips.length, "trip"),
    plural(posts.length, "story", "stories"),
    photos.length > 0 && plural(photos.length, "photo"),
  ]
    .filter(Boolean)
    .join(" · ");
  const rowProps = { canDetach: canEdit && !pin.virtual, busy, onOpenPost, onDetach };

  return (
    <motion.aside
      role="dialog"
      aria-labelledby={titleId}
      className="glass-panel absolute inset-x-2 bottom-2 flex max-h-[72%] flex-col overflow-hidden rounded-2xl sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-auto sm:max-h-[calc(100%-2rem)] sm:w-[24rem]"
      style={{ zIndex: "var(--z-hud)", background: "var(--bg-panel-strong)", color: "var(--text)" }}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="flex items-start gap-3 p-4 pb-3">
        <MapPin className="red-pin-icon mt-0.5 shrink-0" size={26} strokeWidth={2} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate text-lg font-bold leading-tight">
            {pin.title}
          </h2>
          <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {subtitle} · {counts}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-m-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/10"
          aria-label="Close preview"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      {covers.length > 0 && (
        <div className="flex shrink-0 snap-x gap-2 overflow-x-auto px-4 pb-3 glass-scrollbar">
          {covers.map((src, i) => (
            <img
              key={`${src}-${i}`}
              src={src}
              alt=""
              loading="lazy"
              className={`shrink-0 snap-start rounded-xl object-cover ${covers.length === 1 ? "h-36 w-full" : "h-24 w-36"}`}
            />
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 glass-scrollbar">
        {posts.length === 0 && trips.length === 0 && (
          <p className="px-2 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
            {pin.note || "No trips or stories here yet."}
          </p>
        )}
        {trips.map((trip) => (
          <TripSection
            key={trip.id}
            trip={trip}
            canEdit={canEdit}
            busy={busy}
            rowProps={rowProps}
            onNewStory={onNewStory}
            onAddPhotos={onAddPhotos}
            onEditTrip={onEditTrip}
          />
        ))}
        {loosePosts.length > 0 && (
          <section aria-label={trips.length > 0 ? "Not in a trip" : "Stories"}>
            {trips.length > 0 && (
              <h3 className="px-2 pt-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Not in a trip
              </h3>
            )}
            <ul className="flex flex-col gap-1">
              {loosePosts.map((post) => (
                <PostRow key={post.id} post={post} {...rowProps} />
              ))}
            </ul>
          </section>
        )}
      </div>

      {canEdit && (
        <footer className="grid shrink-0 grid-cols-2 gap-2 border-t p-3" style={{ borderColor: "var(--glass-border)" }}>
          <button
            type="button"
            onClick={onNewTrip}
            disabled={Boolean(busy)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            style={{ background: "var(--pin-red)" }}
          >
            <Luggage size={16} aria-hidden="true" />
            New trip
          </button>
          <button
            type="button"
            onClick={() => onNewStory(null)}
            disabled={Boolean(busy)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border-2 text-sm font-bold transition hover:bg-black/5 disabled:opacity-50"
            style={{ borderColor: "var(--border-strong)", color: "var(--text-strong)" }}
          >
            <FilePlus2 size={16} aria-hidden="true" />
            New story
          </button>
          <button
            type="button"
            onClick={() => onAddPhotos(null)}
            disabled={Boolean(busy)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border-2 text-sm font-bold transition hover:bg-black/5 disabled:opacity-50"
            style={{ borderColor: "var(--border-strong)", color: "var(--text-strong)" }}
          >
            <ImagePlus size={16} aria-hidden="true" />
            Add photos
          </button>
          <button
            type="button"
            onClick={onAttach}
            disabled={Boolean(busy)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border-2 text-sm font-bold transition hover:bg-black/5 disabled:opacity-50"
            style={{ borderColor: "var(--border-strong)", color: "var(--text-strong)" }}
          >
            {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
            {busy ?? "Attach existing"}
          </button>
        </footer>
      )}
    </motion.aside>
  );
}
