import { useCallback, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Bike, CalendarDays, Camera, LayoutGrid, MapPin, NotebookPen, Plane, Plus, Users } from "lucide-react";
import { getTripById } from "../../lib/tripStore";
import { getBlogs } from "../../lib/blogStore";
import { getPhotos } from "../../lib/photoStore";
import { getPins } from "../../lib/pinStore";
import { collectMedia, realCover } from "../../lib/media";
import { blogPreview } from "../../lib/blogPreview";
import { allCompanions, sortStops } from "../../lib/hierarchy";
import { formatDate, formatDateRange } from "../../lib/dateFilters";
import { countryCodeToFlagEmoji } from "../../lib/countries";
import { newBlogInTripPath, ticketCode } from "../../lib/tripPass";
import { useDataChanges } from "../../lib/liveSync";
import { useAuth } from "../../lib/auth";
import { useAsync } from "../../hooks/useAsync";
import { errorMessage } from "../../lib/errors";
import BlogCard from "../../components/BlogCard/BlogCard";
import TripJourney from "../../components/TripJourney/TripJourney";
import Barcode from "../../components/TripStories/Barcode";
import CoverPlaceholder from "../../components/CoverPlaceholder/CoverPlaceholder";
import MediaView from "../../components/MediaView/MediaView";
import PhotoLightbox from "../../components/PhotoLightbox/PhotoLightbox";
import LoadingSpinner from "../../components/LoadingSpinner/LoadingSpinner";
import "./TripDetail.css";

const VIEW_GRID = "grid";
const VIEW_JOURNEY = "journey";
const VIEWS = [
  { id: VIEW_GRID, label: "Grid", icon: LayoutGrid },
  { id: VIEW_JOURNEY, label: "Ride the journey", icon: Bike },
];

const EMPTY = { trip: null, blogs: [], photos: [], pins: [] };

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const postTime = (b) => new Date(b.postDate ?? b.startDate ?? b.date ?? 0).getTime();
const mediaTime = (m) => new Date(m.timestamp ?? 0).getTime() || 0;

/**
 * Stops to list on the pass: the trip's own, else (no stops yet) the distinct
 * places its stories were written, in the order they were visited.
 */
function routeStops(trip, posts) {
  const stops = sortStops(trip.stops ?? []);
  if (stops.length > 0) {
    return stops.map((s) => ({ key: s.id, name: s.locationName, countryCode: s.countryCode, dates: formatDateRange(s.startDate, s.endDate, "short") }));
  }
  const seen = new Set();
  const fromPosts = [];
  for (const post of posts) {
    const name = post.location?.name || post.countryName;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    fromPosts.push({ key: post.id, name, countryCode: post.countryCode, dates: "" });
  }
  return fromPosts;
}

/**
 * One trip's page, reached from its boarding pass: a pass-style summary
 * (dates, stops, counts, "Create New Blog" filed under the trip), its stories
 * as a card grid or ridden as a cyclist trail (`?view=journey`), and every
 * photo/video from the trip — gallery uploads plus media inside its posts.
 */
export default function TripDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, canEdit } = useAuth();
  // Same rule as TopNav's "Create Blog": signed-out visitors see it and get sent to log in.
  const canCreate = !user || canEdit;
  const view = searchParams.get("view") === VIEW_JOURNEY ? VIEW_JOURNEY : VIEW_GRID;
  const [activeMedia, setActiveMedia] = useState(null);

  const load = useCallback(async () => {
    const [trip, blogs, photos, pins] = await Promise.all([getTripById(id), getBlogs(), getPhotos(), getPins()]);
    return { trip, blogs, photos, pins };
  }, [id]);
  const { data, loading, error, reload } = useAsync(load, [load], EMPTY);
  useDataChanges(["trips", "trip_companions", "trip_stops", "blogs", "gallery_items", "locations"], reload);

  const { trip } = data;

  // Published stories in this trip, in the order they happened.
  const posts = useMemo(
    () => data.blogs.filter((b) => b.tripId === id && b.status === "published").sort((a, b) => postTime(a) - postTime(b)),
    [data.blogs, id]
  );
  const snippets = useMemo(() => new Map(posts.map((p) => [p.id, blogPreview(p).text])), [posts]);

  // Gallery uploads plus the covers/photos/videos inside the trip's posts.
  const media = useMemo(
    () => collectMedia(data.photos, data.blogs).filter((m) => m.tripId === id).sort((a, b) => mediaTime(a) - mediaTime(b)),
    [data.photos, data.blogs, id]
  );

  const setView = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === VIEW_GRID) params.delete("view");
    else params.set("view", next);
    setSearchParams(params, { replace: true });
  };

  // Also covers moving to another trip: don't show the previous one meanwhile.
  if (loading && trip?.id !== id) {
    return (
      <div className="trip-detail trip-detail--status">
        <LoadingSpinner size="lg" label="Loading trip…" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="trip-detail trip-detail--status">
        <p className="trip-detail-status-text">
          {error ? `Couldn’t load this trip: ${errorMessage(error)}` : "This trip doesn’t exist — it may have been deleted."}
        </p>
        <Link to="/" className="trip-detail-back">
          <ArrowLeft size={14} aria-hidden="true" /> Back to My Trips
        </Link>
      </div>
    );
  }

  const stops = routeStops(trip, posts);
  const homePin = data.pins.find((p) => p.id === trip.locationId);
  const destination = stops.at(-1)?.name || homePin?.title || "";
  const companions = allCompanions(trip);
  const cover = trip.coverImage || [...posts].reverse().map((p) => realCover(p.coverImage)).find(Boolean);
  const createHref = canCreate ? newBlogInTripPath(trip.id) : null;
  const addMediaHref = `/gallery?upload=1&trip=${encodeURIComponent(trip.id)}${trip.locationId ? `&pin=${encodeURIComponent(trip.locationId)}` : ""}`;

  return (
    <div className="trip-detail">
      <div className="trip-detail-container">
        <Link to="/" className="trip-detail-back">
          <ArrowLeft size={14} aria-hidden="true" /> My Trips
        </Link>

        <motion.header
          className="trip-detail-pass"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div className="trip-detail-pass-main">
            <div className="trip-detail-pass-strip">
              <Plane size={13} aria-hidden="true" />
              <span>Boarding pass</span>
              <span className="trip-detail-pass-code" title="Trip code">
                {ticketCode(trip, destination)}
              </span>
            </div>

            <div className="trip-detail-pass-body">
              {cover ? (
                <img className="trip-detail-pass-cover" src={cover} alt="" />
              ) : (
                <CoverPlaceholder variant="trip" seed={trip.id} compact className="trip-detail-pass-cover" />
              )}

              <div className="trip-detail-pass-info">
                <h1 className="trip-detail-title">{trip.title}</h1>
                <ul className="trip-detail-facts">
                  <li>
                    <CalendarDays size={14} aria-hidden="true" />
                    {formatDateRange(trip.startDate, trip.endDate)}
                  </li>
                  <li>
                    <NotebookPen size={14} aria-hidden="true" />
                    {plural(posts.length, "story", "stories")}
                  </li>
                  <li>
                    <Camera size={14} aria-hidden="true" />
                    {plural(media.length, "photo & video", "photos & videos")}
                  </li>
                  <li>
                    <Users size={14} aria-hidden="true" />
                    {companions.length > 0 ? `With ${companions.join(", ")}` : "Solo"}
                  </li>
                </ul>

                {stops.length > 0 ? (
                  <ol className="trip-detail-stops" aria-label={trip.stops?.length ? "Stops" : "Places from its stories"}>
                    {stops.map((stop) => (
                      <li key={stop.key} className="trip-detail-stop">
                        <MapPin size={12} aria-hidden="true" />
                        <span className="trip-detail-stop-name">
                          {stop.countryCode && <span aria-hidden="true">{countryCodeToFlagEmoji(stop.countryCode)} </span>}
                          {stop.name}
                        </span>
                        {stop.dates && <span className="trip-detail-stop-date">{stop.dates}</span>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  homePin && (
                    <p className="trip-detail-stops-empty">
                      <MapPin size={12} aria-hidden="true" /> Based at {homePin.title}
                    </p>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="trip-detail-pass-stub">
            {createHref && (
              <Link to={createHref} className="section-create trip-detail-create">
                <Plus size={14} aria-hidden="true" />
                Create New Blog
              </Link>
            )}
            <Barcode seed={trip.id} className="trip-detail-barcode" />
          </div>
        </motion.header>

        <div className="trip-detail-section-head">
          <h2>Stories from this trip</h2>
          <div className="trip-detail-views" role="group" aria-label="How to show this trip's stories">
            {VIEWS.map(({ id: viewId, label, icon: Icon }) => {
              const active = view === viewId;
              return (
                <button
                  key={viewId}
                  type="button"
                  className={`trip-detail-view${active ? " is-active" : ""}`}
                  aria-pressed={active}
                  onClick={() => setView(viewId)}
                >
                  {active && <motion.span layoutId="trip-detail-view-pill" className="trip-detail-view-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <Icon size={14} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {view === VIEW_GRID &&
          (posts.length > 0 ? (
            <div className="trip-detail-grid">
              {posts.map((post, i) => (
                <BlogCard key={post.id} blog={post} snippet={snippets.get(post.id)} delay={Math.min(i, 8) * 0.05} />
              ))}
            </div>
          ) : (
            <div className="trip-detail-empty">
              <p>No stories from this trip yet.</p>
              {createHref && (
                <Link to={createHref} className="section-create">
                  <Plus size={14} aria-hidden="true" />
                  Write the first one
                </Link>
              )}
            </div>
          ))}
      </div>

      {/* Full-bleed: the trail pins a full-screen stage while it's ridden. */}
      {view === VIEW_JOURNEY && <TripJourney tripTitle={trip.title} blogs={posts} createHref={createHref} />}

      <section className="trip-detail-container trip-detail-media" aria-labelledby="trip-detail-media-title">
        <div className="trip-detail-section-head">
          <h2 id="trip-detail-media-title">
            Photos &amp; Videos <span className="trip-detail-count">{media.length}</span>
          </h2>
          {canEdit && (
            <Link to={addMediaHref} className="trip-detail-add-media">
              <Plus size={14} aria-hidden="true" /> Add media
            </Link>
          )}
        </div>

        {media.length === 0 ? (
          <p className="trip-detail-empty">No photos or videos from this trip yet.</p>
        ) : (
          <div className="trip-detail-media-grid">
            {media.map((item, i) => (
              <motion.button
                key={item.id}
                type="button"
                layoutId={`photo-${item.id}`}
                className="trip-detail-media-item"
                onClick={() => setActiveMedia(item)}
                aria-label={`Open ${item.type === "video" ? "video" : "photo"}${item.locationName ? ` from ${item.locationName}` : ""}`}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ delay: Math.min(i % 12, 8) * 0.04, duration: 0.45 }}
              >
                <MediaView item={item} alt={item.locationName} />
                <span className="trip-detail-media-label">
                  {item.locationName}
                  {item.timestamp && <span className="trip-detail-media-date">{formatDate(item.timestamp, "short")}</span>}
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>{activeMedia && <PhotoLightbox photo={activeMedia} onClose={() => setActiveMedia(null)} />}</AnimatePresence>
    </div>
  );
}
