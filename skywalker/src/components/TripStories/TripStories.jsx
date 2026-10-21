import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarDays, LoaderCircle, MapPin, Pencil, Trash2 } from "lucide-react";
import TripDialog from "../TripPicker/TripDialog";
import { deleteTrip, getTrips, saveTrip } from "../../lib/tripStore";
import { getPins } from "../../lib/pinStore";
import { useDataChanges } from "../../lib/liveSync";
import { useAuth } from "../../lib/auth";
import { useAsync } from "../../hooks/useAsync";
import { formatBlogDate, formatDateRange } from "../../utils/dateFilters";
import "./TripStories.css";

/** At most this many post slips fan out of an envelope. */
const MAX_SLIPS = 3;
/** Where each slip's tab peeks out along the envelope's top edge (% of width). */
const TAB_LEFT = ["12%", "42%", "70%"];

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
 * out of the envelope on hover / keyboard focus. The envelope opens the trip
 * (its gallery); each slip opens its post. Editors get inline edit/delete.
 *
 * @param {{ blogs: Array }} props - every post (the homepage already loads them)
 */
export default function TripStories({ blogs }) {
  const { canEdit } = useAuth();
  const { data: trips, setData: setTrips, loading } = useAsync(getTrips, [], []);
  const { data: pins, setData: setPins } = useAsync(getPins, [], []);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useDataChanges(["trips", "trip_companions", "locations"], () => {
    getTrips().then(setTrips, console.error);
    getPins().then(setPins, console.error);
  });

  const pinTitles = useMemo(() => new Map(pins.map((p) => [p.id, p.title])), [pins]);

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
          {trips.length} {trips.length === 1 ? "trip" : "trips"} — hover an envelope to peek at its stories
        </p>
      </header>

      <div className="trip-stories-grid">
        {trips.map((trip) => (
          <TripEnvelope
            key={trip.id}
            trip={trip}
            posts={postsByTrip.get(trip.id) ?? []}
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
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function TripEnvelope({ trip, posts, destination, canEdit, deleting, onEdit, onDelete }) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const slips = posts.slice(0, MAX_SLIPS);
  const cover = posts.find((p) => p.coverImage)?.coverImage;
  const tripHref = `/gallery?trip=${encodeURIComponent(trip.id)}`;

  // Keyboard users get the same reveal as hover while focus is anywhere inside.
  const onBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
  };

  return (
    <motion.article
      className={`trip-env${open ? " is-open" : ""}`}
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      animate={open ? "open" : "rest"}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={onBlur}
    >
      {slips.length > 0 && (
        <ul className="trip-env-slips" aria-label={`Stories from ${trip.title}`}>
          {slips.map((post, i) => (
            <motion.li
              key={post.id}
              className={`trip-env-slip trip-env-slip--${i}`}
              style={{ zIndex: MAX_SLIPS - i }}
              variants={slipVariants(i, slips.length, reduceMotion)}
            >
              <span className="trip-env-slip-tab" style={{ left: TAB_LEFT[i] }} aria-hidden="true" />
              <Link to={`/blogs/${post.id}`} className="trip-env-slip-link">
                {post.coverImage && <img src={post.coverImage} alt="" loading="lazy" />}
                <span className="trip-env-slip-text">
                  <span className="trip-env-slip-title">{post.title || "Untitled story"}</span>
                  <span className="trip-env-slip-date">{formatBlogDate(post)}</span>
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}

      <div className="trip-env-front">
        <div className="trip-env-media">
          {cover && <img src={cover} alt="" loading="lazy" />}
          <span className="trip-env-flap" aria-hidden="true" />
          <span className="trip-env-count">
            {posts.length} {posts.length === 1 ? "story" : "stories"}
          </span>
        </div>
        <div className="trip-env-body">
          <h3 className="trip-env-title">
            {/* Stretched over the whole front so the card is one big target. */}
            <Link to={tripHref} className="trip-env-link">
              {trip.title}
            </Link>
          </h3>
          <div className="trip-env-meta">
            {destination && (
              <span>
                <MapPin size={13} aria-hidden="true" /> {destination}
              </span>
            )}
            <span>
              <CalendarDays size={13} aria-hidden="true" /> {formatDateRange(trip.startDate, trip.endDate)}
            </span>
          </div>
        </div>

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
    </motion.article>
  );
}
