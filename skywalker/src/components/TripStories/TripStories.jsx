import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, LoaderCircle, Pencil, Plane, Scissors, Trash2 } from "lucide-react";
import TripDialog from "../TripPicker/TripDialog";
import CoverPlaceholder from "../CoverPlaceholder/CoverPlaceholder";
import { realCover } from "../../lib/media";
import { deleteTrip, getTrips, saveTrip } from "../../lib/tripStore";
import { getPins } from "../../lib/pinStore";
import { getPhotos } from "../../lib/photoStore";
import { allCompanions } from "../../lib/hierarchy";
import { useDataChanges } from "../../lib/liveSync";
import { useAuth } from "../../lib/auth";
import { useAsync } from "../../hooks/useAsync";
import { formatBlogDate, formatDateRange } from "../../utils/dateFilters";
import { findArt } from "../../data/scrapbookArt";
import "./TripStories.css";

/** At most this many post slips fan out of an envelope. */
const MAX_SLIPS = 3;
/** Where each slip's tab peeks out along the envelope's top edge (% of width). */
const TAB_LEFT = ["12%", "42%", "70%"];
/** Travel sticker that marks each slip's tab: airplane, passport, globe. */
const TAB_ART = ["travel3-09", "travel3-04", "travel3-02"].map(findArt);

const postTime = (b) => new Date(b.postDate ?? b.startDate ?? b.date ?? 0).getTime();

/** Fan position for slip `i` of `n`: -1 (left) … 0 … 1 (right). */
const fanOffset = (i, n) => (n === 1 ? 0 : (i / (n - 1)) * 2 - 1);

function slipVariants(i, n, reduceMotion) {
  const off = fanOffset(i, n);
  return {
    rest: { x: 0, y: 4, rotate: 0, transition: { duration: reduceMotion ? 0 : 0.25, ease: "easeIn" } },
    open: {
      x: `${off * 34}%`,
      y: -82 + Math.abs(off) * 14,
      rotate: off * 9,
      transition: reduceMotion
        ? { duration: 0 }
        : { type: "spring", stiffness: 260, damping: 22, delay: i * 0.05 },
    },
  };
}

/**
 * "My Stories" on the homepage: one envelope per trip. Its published posts sit
 * tucked behind it as paper slips with a coloured tab peeking out, and fan up
 * out of the envelope on hover (or via the stories count on touch). The
 * envelope opens the trip (its gallery); each slip opens its post. Editors get
 * inline edit/delete.
 *
 * @param {{ blogs: Array }} props - every post (the homepage already loads them)
 */
export default function TripStories({ blogs }) {
  const { canEdit } = useAuth();
  const { data: trips, setData: setTrips, loading } = useAsync(getTrips, [], []);
  const { data: pins, setData: setPins } = useAsync(getPins, [], []);
  const { data: photos, setData: setPhotos } = useAsync(getPhotos, [], []);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useDataChanges(["trips", "trip_companions", "trip_stops", "locations"], () => {
    getTrips().then(setTrips, console.error);
    getPins().then(setPins, console.error);
  });
  useDataChanges(["gallery_items"], () => {
    getPhotos().then(setPhotos, console.error);
  });

  const pinTitles = useMemo(() => new Map(pins.map((p) => [p.id, p.title])), [pins]);

  const photoCounts = useMemo(() => {
    const map = new Map();
    for (const p of photos) if (p.tripId) map.set(p.tripId, (map.get(p.tripId) ?? 0) + 1);
    return map;
  }, [photos]);

  const postsByTrip = useMemo(() => {
    const map = new Map();
    for (const b of blogs) {
      if (!b.tripId || b.status !== "published") continue;
      if (!map.has(b.tripId)) map.set(b.tripId, []);
      map.get(b.tripId).push(b);
    }
    for (const list of map.values()) list.sort((a, b) => postTime(b) - postTime(a));
    return map;
  }, [blogs]);

  const destinationOf = useCallback(
    (trip) => {
      const post = postsByTrip.get(trip.id)?.[0];
      return pinTitles.get(trip.locationId) ?? post?.location?.name ?? post?.countryName ?? "";
    },
    [pinTitles, postsByTrip]
  );

  const handleSave = useCallback(
    async (draft) => {
      const saved = await saveTrip({ ...editing, ...draft });
      setTrips((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      setEditing(null);
    },
    [editing, setTrips]
  );

  const handleDelete = useCallback(
    async (trip) => {
      const count = postsByTrip.get(trip.id)?.length ?? 0;
      const detail = count > 0 ? ` Its ${count} post${count === 1 ? "" : "s"} stay, just no longer in this trip.` : "";
      if (!window.confirm(`Delete “${trip.title}”?${detail}`)) return;
      setDeletingId(trip.id);
      try {
        await deleteTrip(trip.id);
        setTrips((prev) => prev.filter((t) => t.id !== trip.id));
      } catch (err) {
        window.alert(err.message);
      } finally {
        setDeletingId(null);
      }
    },
    [postsByTrip, setTrips]
  );

  if (loading || trips.length === 0) return null;

  return (
    <section className="trip-stories" aria-labelledby="trip-stories-title">
      <header className="trip-stories-header">
        <h2 id="trip-stories-title">My Stories</h2>
        <p>
          {trips.length} {trips.length === 1 ? "trip" : "trips"} — hover a boarding pass (or tap its stories count) to peek at its stories
        </p>
      </header>

      <div className="trip-stories-grid">
        {trips.map((trip) => (
          <TripEnvelope
            key={trip.id}
            trip={trip}
            posts={postsByTrip.get(trip.id) ?? []}
            photoCount={photoCounts.get(trip.id) ?? 0}
            destination={destinationOf(trip)}
            canEdit={canEdit}
            deleting={deletingId === trip.id}
            onEdit={() => setEditing(trip)}
            onDelete={() => handleDelete(trip)}
          />
        ))}
      </div>

      <AnimatePresence>
        {editing && (
          <TripDialog
            trip={editing}
            locationTitle={destinationOf(editing) || "this location"}
            home={pins.find((p) => p.id === editing.locationId) ?? null}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

/** Small stable hash of a string (FNV-1a), for the ticket code and barcode. */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Airline-style code for a trip, e.g. "XIA-4F2": destination letters + a hash of its id. */
function ticketCode(trip, destination) {
  const letters = (destination || trip.title || "").replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  const suffix = hashString(trip.id).toString(36).slice(-3).toUpperCase().padStart(3, "0");
  return `${letters}-${suffix}`;
}

/** Decorative barcode whose bars come from the trip id, so each pass looks different. */
function Barcode({ seed }) {
  const bars = useMemo(() => {
    let h = hashString(seed);
    return Array.from({ length: 34 }, () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
      return { width: 1 + (h % 3), gap: 1 + ((h >>> 4) % 2) };
    });
  }, [seed]);
  return (
    <div className="trip-pass-barcode" aria-hidden="true">
      {bars.map((bar, i) => (
        <span key={i} style={{ width: bar.width, marginRight: bar.gap }} />
      ))}
    </div>
  );
}

function TripEnvelope({ trip, posts, photoCount, destination, canEdit, deleting, onEdit, onDelete }) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const slips = posts.slice(0, MAX_SLIPS);
  const cover = posts.map((p) => realCover(p.coverImage)).find(Boolean);
  const companions = allCompanions(trip);
  // Whoever published the trip's posts; stamped onto each post as `authorName` server-side.
  const passengerName = [...new Set(posts.map((p) => p.authorName).filter(Boolean))].join(", ");
  const tripHref = `/gallery?trip=${encodeURIComponent(trip.id)}`;
  const slipsId = `trip-slips-${trip.id}`;

  // While open, a click/tap outside the envelope or Esc tucks the slips back in.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Tabbing out of an open envelope closes it too.
  const onBlur = (e) => {
    if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setOpen(false);
  };

  // A mouse hover fans the slips out (touch has no hover, so it relies on the click below).
  const hasSlips = slips.length > 0;
  const onPointerEnter = (e) => {
    if (hasSlips && e.pointerType === "mouse") setOpen(true);
  };
  const onPointerLeave = (e) => {
    if (e.pointerType === "mouse") setOpen(false);
  };

  return (
    <motion.article
      ref={rootRef}
      className={`trip-env${open ? " is-open" : ""}`}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      animate={open ? "open" : "rest"}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onBlur={onBlur}
    >
      {slips.length > 0 && (
        <ul id={slipsId} className="trip-env-slips" aria-label={`Stories from ${trip.title}`}>
          {slips.map((post, i) => (
            <motion.li
              key={post.id}
              className={`trip-env-slip trip-env-slip--${i}`}
              style={{ zIndex: MAX_SLIPS - i }}
              variants={slipVariants(i, slips.length, reduceMotion)}
            >
              {TAB_ART[i] ? (
                <img
                  className="trip-env-slip-tab"
                  src={TAB_ART[i].src}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  style={{ left: TAB_LEFT[i] }}
                />
              ) : (
                <span className="trip-env-slip-tab trip-env-slip-tab--plain" style={{ left: TAB_LEFT[i] }} aria-hidden="true" />
              )}
              {/* Closed slips sit behind the pass; keep them out of the tab order until revealed. */}
              <Link to={`/blogs/${post.id}`} className="trip-env-slip-link" tabIndex={open ? undefined : -1}>
                {realCover(post.coverImage) ? (
                  <img src={post.coverImage} alt="" loading="lazy" />
                ) : (
                  <CoverPlaceholder variant="blog" seed={post.id} compact className="trip-env-slip-thumb" />
                )}
                <span className="trip-env-slip-text">
                  <span className="trip-env-slip-title">{post.title || "Untitled story"}</span>
                  <span className="trip-env-slip-date">{formatBlogDate(post)}</span>
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}

      {/* The front is a boarding pass: main stub + tear-away stub. */}
      <div className="trip-env-front">
        <div className="trip-pass">
          <div className="trip-pass-main">
            <header className="trip-pass-header">
              <Plane size={13} aria-hidden="true" />
              <span>Boarding pass</span>
            </header>

            <div className="trip-pass-body">
              {cover ? (
                <img className="trip-pass-thumb" src={cover} alt="" loading="lazy" />
              ) : (
                <CoverPlaceholder variant="trip" seed={trip.id} compact className="trip-pass-thumb" />
              )}
              <div className="trip-pass-fields">
                {passengerName && (
                  <span className="trip-pass-field trip-pass-passenger">
                    <span className="trip-pass-label">Passenger name</span>
                    <span className="trip-pass-value">{passengerName}</span>
                  </span>
                )}
                <span className="trip-pass-label">Route</span>
                <h3 className="trip-env-title">
                  {/* Stretched over the whole front so the card is one big target. */}
                  <Link to={tripHref} className="trip-env-link">
                    {trip.title}
                  </Link>
                </h3>

                <div className="trip-pass-route">
                  <span className="trip-pass-field">
                    <span className="trip-pass-label">From</span>
                    <span className="trip-pass-value">Home</span>
                  </span>
                  <span className="trip-pass-flight" aria-hidden="true">
                    <Plane size={12} />
                  </span>
                  <span className="trip-pass-field">
                    <span className="trip-pass-label">To</span>
                    <span className="trip-pass-value">{destination || "Somewhere"}</span>
                  </span>
                </div>

                <div className="trip-pass-row">
                  <span className="trip-pass-field">
                    <span className="trip-pass-label">Date</span>
                    <span className="trip-pass-value">{formatDateRange(trip.startDate, trip.endDate)}</span>
                  </span>
                  <span className="trip-pass-field">
                    <span className="trip-pass-label">Travelling with</span>
                    <span className="trip-pass-value">{companions.length > 0 ? companions.join(", ") : "Solo"}</span>
                  </span>
                </div>
              </div>
            </div>

            <Barcode seed={trip.id} />
          </div>

          <div className="trip-pass-stub">
            <Scissors size={12} className="trip-pass-scissors" aria-hidden="true" />
            <span className="trip-pass-code" title="Trip code">
              {ticketCode(trip, destination)}
            </span>
            {hasSlips ? (
              <button
                type="button"
                className="trip-pass-field trip-pass-toggle"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-controls={slipsId}
                title={open ? "Tuck stories away" : "Peek at stories"}
              >
                <span className="trip-pass-label">Stories</span>
                <span className="trip-pass-count">{posts.length}</span>
                <ChevronDown size={12} className="trip-pass-toggle-icon" aria-hidden="true" />
              </button>
            ) : (
              <span className="trip-pass-field">
                <span className="trip-pass-label">Stories</span>
                <span className="trip-pass-count">{posts.length}</span>
              </span>
            )}
            <span className="trip-pass-field">
              <span className="trip-pass-label">Photos</span>
              <span className="trip-pass-count">{photoCount}</span>
            </span>

            {canEdit && (
              <div className="trip-env-actions">
                <button type="button" onClick={onEdit} aria-label={`Edit ${trip.title}`} title="Edit trip">
                  <Pencil size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting}
                  className="is-danger"
                  aria-label={`Delete ${trip.title}`}
                  title="Delete trip"
                >
                  {deleting ? (
                    <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 size={14} aria-hidden="true" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
