import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, LoaderCircle, Pencil, Plane, Plus, Scissors, Trash2 } from "lucide-react";
import TripDialog from "../TripPicker/TripDialog";
import CoverPlaceholder from "../CoverPlaceholder/CoverPlaceholder";
import { blogPreview } from "../../lib/blogPreview";
import { collectMedia, realCover } from "../../lib/media";
import { deleteTrip, getTrips, saveTrip } from "../../lib/tripStore";
import { getPins } from "../../lib/pinStore";
import { getPhotos } from "../../lib/photoStore";
import { allCompanions, groupTripsByRegion, routeLabel, sortStops, tripRegions } from "../../lib/hierarchy";
import { useDataChanges } from "../../lib/liveSync";
import { useAuth } from "../../lib/auth";
import { useAsync } from "../../hooks/useAsync";
import { useCountriesGeoJson } from "../../hooks/useCountriesGeoJson";
import { formatBlogDate, formatDateRange } from "../../lib/dateFilters";
import { continentForCountryCode } from "../../lib/geo";
import { COUNTRY_TO_CONTINENT, countryCodeToFlagEmoji } from "../../lib/countries";
import { findArt } from "../../data/scrapbookArt";
import { errorMessage } from "../../lib/errors";
import "./TripStories.css";

/** At most this many post slips fan out of an envelope. */
const MAX_SLIPS = 3;
/** At most this many stops are listed on a pass; the rest fold into "+N more". */
const MAX_PASS_STOPS = 4;
/** Slip width (% of the pass) by how many are fanned; narrow enough that they barely overlap. */
const SLIP_WIDTH = [0, 64, 48, 36];
/** Travel sticker that marks each slip's tab: airplane, passport, globe. */
const TAB_ART = ["travel3-09", "travel3-04", "travel3-02"].map(findArt);

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const postTime = (b) => new Date(b.postDate ?? b.startDate ?? b.date ?? 0).getTime();

/** Fan position for slip `i` of `n`: -1 (left) … 0 … 1 (right). */
const fanOffset = (i, n) => (n === 1 ? 0 : (i / (n - 1)) * 2 - 1);

/** Side-by-side place of slip `i` of `n` along the pass, so each one's text can be read. */
function slipPlace(i, n) {
  const width = SLIP_WIDTH[n];
  const left = ((fanOffset(i, n) + 1) / 2) * (100 - width);
  return { left: `${left}%`, width: `${width}%` };
}

function slipVariants(i, n, reduceMotion) {
  const off = fanOffset(i, n);
  return {
    rest: { x: `${off * -14}%`, y: 4, rotate: 0, transition: { duration: reduceMotion ? 0 : 0.25, ease: "easeIn" } },
    open: {
      x: "0%",
      y: -152 + Math.abs(off) * 6,
      rotate: off * 2.5,
      transition: reduceMotion
        ? { duration: 0 }
        : { type: "spring", stiffness: 260, damping: 22, delay: i * 0.05 },
    },
  };
}
/**
 * "My Trips" on the homepage: one envelope per trip. Its published posts sit
 * tucked behind it as paper slips with a coloured tab peeking out, and fan up
 * out of the envelope on hover (or via the stories count on touch). The
 * envelope opens the trip (its gallery); each slip opens its post. Editors get
 * inline edit/delete.
 *
 * @param {{ blogs: Array, onCreateTrip?: ?function(): void }} props - every post
 *   (the homepage already loads them); `onCreateTrip` starts the new-trip flow
 *   from the "Create New Trip" button beside the heading.
 */
export default function TripStories({ blogs, onCreateTrip = null }) {
  const { user, canEdit } = useAuth();
  // Same rule as TopNav's "Create Blog": signed-out visitors see it and get sent to log in.
  const canCreate = Boolean(onCreateTrip) && (!user || canEdit);
  const { data: trips, setData: setTrips, loading } = useAsync(getTrips, [], []);
  const { data: pins, setData: setPins } = useAsync(getPins, [], []);
  const { data: photos, setData: setPhotos } = useAsync(getPhotos, [], []);
  // The trip whose edit dialog is open. Its stops aren't editable here — only on the 3D globe.
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  // Continent -> country filter: { continent, country } keys from groupTripsByRegion, null = all.
  const [region, setRegion] = useState({ continent: null, country: null });
  const countryFeatures = useCountriesGeoJson();

  useDataChanges(["trips", "trip_companions", "trip_stops", "locations"], () => {
    getTrips().then(setTrips, console.error);
    getPins().then(setPins, console.error);
  });
  useDataChanges(["gallery_items"], () => {
    getPhotos().then(setPhotos, console.error);
  });

  const pinTitles = useMemo(() => new Map(pins.map((p) => [p.id, p.title])), [pins]);
  const pinsById = useMemo(() => new Map(pins.map((p) => [p.id, p])), [pins]);

  // Gallery uploads plus the photos inside the trip's published posts (covers,
  // canvas images) — most trips' photos only ever live in their posts.
  const photoCounts = useMemo(() => {
    const map = new Map();
    for (const p of collectMedia(photos, blogs)) if (p.tripId) map.set(p.tripId, (map.get(p.tripId) ?? 0) + 1);
    return map;
  }, [photos, blogs]);

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

  // Where each trip went: its stops' countries, else its posts' and its pin's.
  const regionGroups = useMemo(() => {
    const regionsOf = (trip) => {
      const pin = pinsById.get(trip.locationId);
      const fallback = (postsByTrip.get(trip.id) ?? []).map((b) => ({
        continent: b.continent,
        country: b.countryName,
        countryCode: b.countryCode,
      }));
      if (pin?.countryCode) {
        fallback.push({
          continent: continentForCountryCode(pin.countryCode, countryFeatures, COUNTRY_TO_CONTINENT),
          country: pin.countryName || pin.countryCode,
          countryCode: pin.countryCode,
        });
      }
      return tripRegions(trip, fallback);
    };
    return groupTripsByRegion(trips, regionsOf);
  }, [trips, pinsById, postsByTrip, countryFeatures]);

  // A pick that no longer exists (trip deleted/edited) falls back to "all".
  const activeContinent = regionGroups.find((g) => g.continent === region.continent) ?? null;
  const activeCountry = activeContinent?.countries.find((c) => (c.countryCode || c.country) === region.country) ?? null;
  const visibleTrips = activeCountry?.trips ?? activeContinent?.trips ?? trips;
  const showRegionFilter = regionGroups.length > 1 || regionGroups.some((g) => g.countries.length > 1);

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
        window.alert(errorMessage(err));
      } finally {
        setDeletingId(null);
      }
    },
    [postsByTrip, setTrips]
  );

  // With no trips yet, only someone who can start one gets the (empty) section.
  if (loading || (trips.length === 0 && !canCreate)) return null;

  return (
    <section className="trip-stories" aria-labelledby="trip-stories-title" data-tour="trips">
      <header className="trip-stories-header">
        <div className="section-heading-row">
          <h2 id="trip-stories-title">My Trips</h2>
          {canCreate && (
            <button type="button" className="section-create" onClick={onCreateTrip}>
              <Plus size={14} aria-hidden="true" />
              Create New Trip
            </button>
          )}
        </div>
        <p>
          {trips.length > 0
            ? `${plural(trips.length, "trip")} — hover a boarding pass (or tap its stories count) to peek at its stories`
            : "No trips yet — pin a place on the globe to start your first one."}
        </p>
      </header>

      {showRegionFilter && (
        <nav className="trip-regions" aria-label="Browse trips by continent and country">
          <div className="trip-regions-row" role="group" aria-label="Continent">
            <RegionChip active={!activeContinent} count={trips.length} onClick={() => setRegion({ continent: null, country: null })}>
              All
            </RegionChip>
            {regionGroups.map((g) => (
              <RegionChip
                key={g.continent || "unknown"}
                active={activeContinent === g}
                count={g.trips.length}
                onClick={() => setRegion({ continent: g.continent, country: null })}
              >
                {g.continent || "Somewhere"}
              </RegionChip>
            ))}
          </div>
          {activeContinent && activeContinent.countries.length > 0 && (
            <div className="trip-regions-row trip-regions-row--countries" role="group" aria-label={`Countries in ${activeContinent.continent || "this group"}`}>
              <RegionChip active={!activeCountry} count={activeContinent.trips.length} onClick={() => setRegion((r) => ({ ...r, country: null }))}>
                All of {activeContinent.continent || "these"}
              </RegionChip>
              {activeContinent.countries.map((c) => (
                <RegionChip
                  key={c.countryCode || c.country}
                  active={activeCountry === c}
                  count={c.trips.length}
                  onClick={() => setRegion((r) => ({ ...r, country: c.countryCode || c.country }))}
                >
                  {c.countryCode && <span aria-hidden="true">{countryCodeToFlagEmoji(c.countryCode)} </span>}
                  {c.country}
                </RegionChip>
              ))}
            </div>
          )}
        </nav>
      )}

      <div className="trip-stories-grid">
        {visibleTrips.map((trip) => (
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
            itinerary={false}
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

function RegionChip({ active, count, onClick, children }) {
  return (
    <button type="button" className={`trip-region-chip${active ? " is-active" : ""}`} aria-pressed={active} onClick={onClick}>
      <span>{children}</span>
      <span className="trip-region-chip-count">{count}</span>
    </button>
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

/**
 * The pass's itinerary: each stop on a dotted timeline with its dates (and how
 * many of the trip's stories are filed under it), and — for editors — an
 * always-there "Add blogs" that starts a post in this trip. Stops themselves
 * are only added on the 3D globe.
 *
 * A trip with no stops yet but with stories falls back to a timeline of those
 * stories (where/when each was written), marked as stories rather than stops.
 */
function PassItinerary({ stops, posts, tripTitle, addBlogHref }) {
  if (stops.length > 0) {
    const shown = stops.slice(0, MAX_PASS_STOPS);
    const hidden = stops.length - shown.length;
    return (
      <div className="trip-pass-itinerary">
        <span className="trip-pass-label">Itinerary</span>
        <ol className="trip-pass-stops">
          {shown.map((stop) => {
            const storyCount = posts.filter((p) => p.stopId === stop.id).length;
            return (
              <li key={stop.id} className="trip-pass-stop">
                <span className="trip-pass-stop-name">
                  {stop.countryCode && <span aria-hidden="true">{countryCodeToFlagEmoji(stop.countryCode)} </span>}
                  {stop.locationName}
                </span>
                {storyCount > 0 && <span className="trip-pass-stop-stories">{storyCount === 1 ? "1 story" : `${storyCount} stories`}</span>}
                <span className="trip-pass-stop-date">{formatDateRange(stop.startDate, stop.endDate, "short")}</span>
              </li>
            );
          })}
          {hidden > 0 && <li className="trip-pass-stop trip-pass-stop--more">+{plural(hidden, "more stop")}</li>}
        </ol>
        <AddBlogLink href={addBlogHref} tripTitle={tripTitle} />
      </div>
    );
  }

  // No stops: walk the trip's stories oldest-first, as journey entries.
  const journey = [...posts].sort((a, b) => postTime(a) - postTime(b));
  const shown = journey.slice(0, MAX_PASS_STOPS);
  const hidden = journey.length - shown.length;
  return (
    <div className="trip-pass-itinerary">
      <span className="trip-pass-label">{journey.length > 0 ? "Itinerary · from stories" : "Itinerary"}</span>
      {journey.length > 0 ? (
        <ol className="trip-pass-stops">
          {shown.map((post) => (
            <li key={post.id} className="trip-pass-stop trip-pass-stop--story">
              <span className="trip-pass-stop-name">
                {post.countryCode && <span aria-hidden="true">{countryCodeToFlagEmoji(post.countryCode)} </span>}
                {post.location?.name || post.countryName || post.title || "Untitled story"}
              </span>
              <span className="trip-pass-stop-date">{formatBlogDate(post)}</span>
            </li>
          ))}
          {hidden > 0 && <li className="trip-pass-stop trip-pass-stop--more">+{hidden} more</li>}
        </ol>
      ) : (
        <p className="trip-pass-stops-empty">No stops or stories yet</p>
      )}
      {journey.length > 0 && addBlogHref && <p className="trip-pass-stops-empty">No stops yet — add them on the globe.</p>}
      <AddBlogLink href={addBlogHref} tripTitle={tripTitle} />
    </div>
  );
}

function AddBlogLink({ href, tripTitle }) {
  if (!href) return null;
  return (
    <Link to={href} className="trip-pass-add-blog" aria-label={`Add a blog to ${tripTitle}`}>
      <Plus size={12} aria-hidden="true" />
      Add blogs
    </Link>
  );
}

/**
 * One post's slip of notebook paper: its title and date, the opening words of
 * its story, and its cover (or first photo) as an avatar in the top-right
 * corner. Without a photo it's just the paper.
 */
function StorySlip({ post, open }) {
  const { text, isFallback, thumb } = useMemo(() => blogPreview(post), [post]);
  const [brokenThumb, setBrokenThumb] = useState("");
  return (
    <Link to={`/blogs/${post.id}`} className="trip-env-slip-link" tabIndex={open ? undefined : -1}>
      <span className="trip-env-slip-head">
        <span className="trip-env-slip-text">
          <span className="trip-env-slip-title">{post.title || "Untitled story"}</span>
          <span className="trip-env-slip-date">{formatBlogDate(post)}</span>
        </span>
        {thumb && thumb !== brokenThumb && (
          <img className="trip-env-slip-avatar" src={thumb} alt="" loading="lazy" onError={() => setBrokenThumb(thumb)} />
        )}
      </span>
      <span className={`trip-env-slip-snippet${isFallback ? " is-fallback" : ""}`}>{text}</span>
    </Link>
  );
}

function TripEnvelope({ trip, posts, photoCount, destination, canEdit, deleting, onEdit, onDelete }) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  // With more posts than slips, the last slip becomes "+N more" so the fan
  // always accounts for every story the stub counts.
  const overflow = posts.length > MAX_SLIPS;
  const slips = overflow ? [...posts.slice(0, MAX_SLIPS - 1), { id: "__more", more: posts.length - (MAX_SLIPS - 1) }] : posts;
  // The trip's own cover, else its newest post's.
  const cover = trip.coverImage || posts.map((p) => realCover(p.coverImage)).find(Boolean);
  const companions = allCompanions(trip);
  // Whoever published the trip's posts; stamped onto each post as `authorName` server-side.
  const passengerName = [...new Set(posts.map((p) => p.authorName).filter(Boolean))].join(", ");
  // A multi-stop trip reads first stop -> last stop; otherwise home -> its destination.
  const stops = sortStops(trip.stops ?? []);
  const route = routeLabel(trip);
  const from = stops.length > 1 ? stops[0].locationName : "Home";
  const to = stops.at(-1)?.locationName || destination || "Somewhere";
  const via = stops.length > 2 ? plural(stops.length - 2, "stop") : null;
  const tripHref = `/gallery?trip=${encodeURIComponent(trip.id)}`;
  // The editor starts inside this trip (and at its pin) from `trip` alone.
  const addBlogHref = `/blogs/new?trip=${encodeURIComponent(trip.id)}`;
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
              style={{ ...slipPlace(i, slips.length), "--slip-z": MAX_SLIPS - i }}
              variants={slipVariants(i, slips.length, reduceMotion)}
            >
              {TAB_ART[i] ? (
                <img
                  className="trip-env-slip-tab"
                  src={TAB_ART[i].src}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                />
              ) : (
                <span className="trip-env-slip-tab trip-env-slip-tab--plain" aria-hidden="true" />
              )}
              {/* Closed slips sit behind the pass; keep them out of the tab order until revealed. */}
              {post.more ? (
                <Link to={tripHref} className="trip-env-slip-link" tabIndex={open ? undefined : -1}>
                  <span className="trip-env-slip-head">
                    <span className="trip-env-slip-text">
                      <span className="trip-env-slip-title">{post.more} more stories</span>
                    </span>
                    <span className="trip-env-slip-more-count" aria-hidden="true">+{post.more}</span>
                  </span>
                  <span className="trip-env-slip-snippet is-fallback">See all {posts.length} in this trip</span>
                </Link>
              ) : (
                <StorySlip post={post} open={open} />
              )}
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

                <div className="trip-pass-route" title={route || undefined}>
                  <span className="trip-pass-field">
                    <span className="trip-pass-label">From</span>
                    <span className="trip-pass-value">{from}</span>
                  </span>
                  <span className="trip-pass-flight" aria-hidden="true">
                    <Plane size={12} />
                  </span>
                  <span className="trip-pass-field">
                    <span className="trip-pass-label">{via ? `To · via ${via}` : "To"}</span>
                    <span className="trip-pass-value">{to}</span>
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

                {(stops.length > 0 || posts.length > 0 || canEdit) && (
                  <PassItinerary stops={stops} posts={posts} tripTitle={trip.title} addBlogHref={canEdit ? addBlogHref : null} />
                )}
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
