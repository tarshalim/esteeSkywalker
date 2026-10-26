import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileClock } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useTransform } from "framer-motion";
import { getBlogs, upsertBlog } from "../../lib/blogStore";
import { getTrips } from "../../lib/tripStore";
import { companionOptions, companionsForPost, tripsReferencedBy } from "../../lib/hierarchy";
import { useAuth } from "../../lib/auth";
import { useVibes } from "../../lib/vibes";
import { useAsync } from "../../hooks/useAsync";
import { useTrailScroll } from "../../hooks/useTrailScroll";
import TrailBackdrop from "../../components/BlogTrail/TrailBackdrop";
import TrailPath from "../../components/BlogTrail/TrailPath";
import TrailSignpost from "../../components/BlogTrail/TrailSignpost";
import CreateStorySignpost from "../../components/BlogTrail/CreateStorySignpost";
import TrailCyclist from "../../components/BlogTrail/TrailCyclist";
import TrailControls from "../../components/BlogTrail/TrailControls";
import ExpeditionTransition from "../../components/BlogTrail/ExpeditionTransition";
import { CREATE_SLOT_SPAN, createPostPercent, riderProgressAt, signpostPercent, worldWidthFor } from "../../components/BlogTrail/trailLayout";
import BlogFilterBar from "../../components/BlogFilterBar/BlogFilterBar";
import {
  EMPTY_FILTERS,
  cityOf,
  filterHeading,
  hasActiveFilters,
  labelFor,
  locationOptions,
  matchesFilters,
} from "../../lib/blogTaxonomy";
import { formatWeather } from "../../lib/weather";
import { usePageSearch, useSearch } from "../../lib/search";
import { matchesQuery } from "../../lib/textMatch";

/** Vertical scroll distance per px of horizontal trail — lower rides faster. */
const SCROLL_PER_TRAIL_PX = 0.9;
/** How close (fraction of viewport width) the rider must be for a stop to light up. */
const ACTIVE_RANGE = 0.12;
const ZOOM_SCALE = 2.6;
const CREATE_STOP_ID = "__create__";
const MAX_SEARCH_RESULTS = 8;

const stripHtml = (html) => (html ?? "").replace(/<[^>]*>/g, " ");

/**
 * Everything the navbar search matches a post on: title, places, its trip and
 * who was along, tags, excerpt and the story text.
 */
function searchFields(blog, vibes, trip) {
  return [
    blog.title,
    trip?.title,
    companionsForPost(blog, trip),
    blog.excerpt,
    blog.location?.name,
    blog.countryName,
    cityOf(blog),
    blog.continent,
    blog.tags,
    (blog.vibes ?? []).map((v) => labelFor(vibes, v)).filter(Boolean),
    formatWeather(blog.weather),
    (blog.blocks ?? []).map((b) => stripHtml(b.html)),
  ];
}

function useViewportWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

/**
 * "My Blog" tab: scrolling the page pedals the cyclist along a trail of signposts,
 * one per post, each topped by a floating cover-image pin. The trailhead holds a blank
 * post for writing a new story. Clicking a stop plays an adventure-map zoom into the post.
 */
export default function MyBlog() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const viewportWidth = useViewportWidth();
  const { user, canEdit } = useAuth();
  // Same rule as TopNav's "Create Blog": signed-out visitors see it and get sent to log in.
  const canCreate = !user || canEdit;
  const sectionRef = useRef(null);
  const stageRef = useRef(null);
  const { data: allBlogs, loading, setData: setAllBlogs } = useAsync(getBlogs, [], []);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const { data: tripList } = useAsync(getTrips, [], []);
  const tripsById = useMemo(() => new Map(tripList.map((t) => [t.id, t])), [tripList]);

  // Drafts live on their own page; the trail is published stories only. Filter
  // options still come from both, so a place you're drafting is already listed.
  const { countries, cities } = useMemo(() => locationOptions(allBlogs), [allBlogs]);
  const published = useMemo(() => allBlogs.filter((b) => b.status !== "draft"), [allBlogs]);
  const draftCount = allBlogs.length - published.length;
  // Trip tier: trips with a published post in the chosen place/dates. People:
  // everyone on the chosen trip, else on any of those trips.
  const tripOptions = useMemo(() => {
    const placeOnly = { ...filters, trip: "", companion: "", favoritesOnly: false };
    return tripsReferencedBy(tripList, published.filter((b) => matchesFilters(b, placeOnly)));
  }, [tripList, published, filters]);
  const companionChoices = useMemo(() => {
    const chosen = tripsById.get(filters.trip);
    return companionOptions(chosen ? [chosen] : tripOptions);
  }, [tripsById, filters.trip, tripOptions]);
  const blogs = useMemo(() => published.filter((b) => matchesFilters(b, filters, tripsById)), [published, filters, tripsById]);
  const hasFilters = hasActiveFilters(filters);
  const heading = filterHeading(
    filters,
    countries.find((c) => c.code === filters.country)?.name ?? "",
    tripsById.get(filters.trip)?.title ?? ""
  );

  const createSpan = canCreate ? CREATE_SLOT_SPAN : 0;
  const slotCount = blogs.length + createSpan;
  const worldWidth = worldWidthFor(slotCount, viewportWidth);

  // Every stop on the trail (the create post first), with its slot and the scroll progress that reaches it.
  const stops = useMemo(() => {
    const firstPct = canCreate ? createPostPercent(worldWidth, viewportWidth) : undefined;
    const toStop = (id, slot, blog) => {
      const pct = signpostPercent(slot, slotCount, firstPct);
      return { id, blog, pct, progress: riderProgressAt((worldWidth * pct) / 100, worldWidth, viewportWidth) };
    };
    return [
      ...(canCreate ? [toStop(CREATE_STOP_ID, 0, null)] : []),
      ...blogs.map((blog, i) => toStop(blog.id, i + createSpan, blog)),
    ];
  }, [blogs, canCreate, createSpan, slotCount, worldWidth, viewportWidth]);

  const { scrollProgress, progress, riderX, cameraX, riderScreenX, isMoving, direction } = useTrailScroll(
    sectionRef,
    worldWidth,
    viewportWidth
  );

  const [activeId, setActiveId] = useState(null);
  useMotionValueEvent(riderX, "change", (x) => {
    const near = stops.find(({ pct }) => Math.abs((worldWidth * pct) / 100 - x) < viewportWidth * ACTIVE_RANGE);
    setActiveId(near?.id ?? null);
  });

  const hintOpacity = useTransform(progress, [0, 0.04], [1, 0]);

  const seek = useCallback(
    (p, smooth) => {
      const section = sectionRef.current;
      if (!section) return;
      const top = section.getBoundingClientRect().top + window.scrollY;
      const scrollable = section.offsetHeight - window.innerHeight;
      window.scrollTo({ top: top + p * scrollable, behavior: smooth && !reduceMotion ? "smooth" : "instant" });
    },
    [reduceMotion]
  );

  // A new filter rebuilds the trail with a different length; start back at the trailhead.
  const changeFilters = useCallback(
    (next) => {
      setFilters(next);
      seek(0, false);
    },
    [seek]
  );

  // Optimistic: the heart flips at once and flips back if the save fails.
  // Stable (setAllBlogs is a state-setter wrapper) so memoised signposts don't re-render.
  const setAllBlogsRef = useRef(setAllBlogs);
  setAllBlogsRef.current = setAllBlogs;
  const toggleFavorite = useCallback(async (blog) => {
    const favorite = !blog.favorite;
    const apply = (value) =>
      setAllBlogsRef.current((prev) => prev.map((b) => (b.id === blog.id ? { ...b, favorite: value } : b)));
    apply(favorite);
    try {
      await upsertBlog({ id: blog.id, favorite });
    } catch (err) {
      console.error("Couldn't update favorite", err);
      apply(!favorite);
    }
  }, []);

  const [trip, setTrip] = useState(null);
  const tripRef = useRef(null);
  // Stable so memoised signposts don't re-render when the rider's state changes.
  const openBlog = useCallback(
    (blog, pinEl) => {
      if (tripRef.current) return;
      if (reduceMotion || !pinEl || !stageRef.current) {
        navigate(`/blogs/${blog.id}`);
        return;
      }
      const pin = pinEl.getBoundingClientRect();
      const stage = stageRef.current.getBoundingClientRect();
      const x = pin.left + pin.width / 2;
      const y = pin.top + pin.height / 2;
      tripRef.current = { blog, x, y, originX: x - stage.left, originY: y - stage.top };
      setTrip(tripRef.current);
    },
    [navigate, reduceMotion]
  );
  // Navbar search: matching signposts glow, the rest fade back; picking a
  // result rides there. Highlighting rather than removing stops keeps the
  // trail (and scroll position) from rebuilding on every keystroke.
  const { query, setQuery } = useSearch();
  const searchQuery = useDeferredValue(query.trim());
  const { vibes } = useVibes();
  const searchIndex = useMemo(
    () => new Map(blogs.map((b) => [b.id, searchFields(b, vibes, tripsById.get(b.tripId))])),
    [blogs, vibes, tripsById]
  );
  const matchIds = useMemo(
    () => (searchQuery ? new Set(blogs.filter((b) => matchesQuery(searchQuery, searchIndex.get(b.id))).map((b) => b.id)) : null),
    [blogs, searchIndex, searchQuery]
  );
  const searchResults = useMemo(
    () =>
      matchIds
        ? blogs
            .filter((b) => matchIds.has(b.id))
            .slice(0, MAX_SEARCH_RESULTS)
            .map((b) => ({
              id: b.id,
              kind: "signpost",
              label: b.title,
              sublabel: [tripsById.get(b.tripId)?.title, b.location?.name || b.countryName, b.excerpt].filter(Boolean).join(" · "),
            }))
        : [],
    [blogs, matchIds, tripsById]
  );
  const rideToStop = useCallback(
    (result) => {
      const stop = stops.find((s) => s.id === result.id);
      if (stop) seek(stop.progress, true);
      setQuery(result.label);
    },
    [stops, seek, setQuery]
  );
  usePageSearch({ placeholder: "Search signposts & stories…", results: searchResults, onSelect: rideToStop });

  const draftsLink = canEdit && (
    <Link
      to="/blogs/drafts"
      className="inline-flex h-7 w-fit shrink-0 items-center gap-1 rounded-full bg-slate-900/70 px-2.5 text-[11px] font-semibold text-white hover:bg-slate-900/85 sm:text-xs"
    >
      <FileClock size={12} aria-hidden="true" />
      Saved Drafts{draftCount > 0 && ` (${draftCount})`}
    </Link>
  );

  const finishTrip = useCallback(() => trip && navigate(`/blogs/${trip.blog.id}`), [trip, navigate]);

  return (
    <section
      ref={sectionRef}
      className="relative"
      style={{ height: `calc(100dvh + ${Math.round(worldWidth * SCROLL_PER_TRAIL_PX)}px)` }}
    >
      <motion.div
        ref={stageRef}
        className="sticky top-0 h-[100dvh] w-full overflow-hidden bg-sky-200"
        style={{ transformOrigin: trip ? `${trip.originX}px ${trip.originY}px` : "50% 50%" }}
        animate={trip ? { scale: ZOOM_SCALE, filter: "blur(2px)" } : { scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: [0.7, 0, 0.3, 1] }}
      >
        <TrailBackdrop progress={progress} />

        <motion.div
          className="absolute inset-y-0 left-0 will-change-transform"
          style={{ x: cameraX, width: worldWidth }}
        >
          <TrailPath />
          {stops.map(({ id, blog, pct }, i) =>
            blog ? (
              <TrailSignpost
                key={id}
                blog={blog}
                index={i}
                leftPct={pct}
                isActive={activeId === id}
                searchMatch={matchIds ? matchIds.has(id) : null}
                onOpen={openBlog}
                onToggleFavorite={canEdit ? toggleFavorite : undefined}
              />
            ) : (
              <CreateStorySignpost
                key={id}
                leftPct={pct}
                isFirstStory={!loading && allBlogs.length === 0}
                onCreate={() => navigate("/blogs/new")}
              />
            )
          )}
        </motion.div>

        <TrailCyclist x={riderScreenX} isMoving={isMoving} direction={direction} />

        <header
          data-tour="journey-header"
          className="absolute top-[calc(var(--nav-bottom)+12px)] right-4 left-4 z-40 flex flex-col gap-3 text-white sm:right-8 sm:left-8 md:flex-row md:items-center md:justify-between md:gap-4"
        >
          <div className="min-w-0 md:shrink">
            <div className="flex min-w-0 items-center gap-2">
              <h1
                aria-live="polite"
                className="truncate text-2xl font-black tracking-tight [-webkit-text-stroke:2px_black] [paint-order:stroke_fill] drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] sm:text-3xl"
              >
                {heading.title}
              </h1>
              {draftsLink && <div className="ml-auto md:hidden">{draftsLink}</div>}
            </div>
            <p className="truncate text-base font-bold [-webkit-text-stroke:1.5px_black] [paint-order:stroke_fill] drop-shadow sm:text-lg">
              {loading
                ? "Packing the saddlebags…"
                : [heading.subtitle, `${blogs.length} ${blogs.length === 1 ? "stop" : "stops"} on the trail`]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
          </div>
          {!loading && allBlogs.length > 0 ? (
            <BlogFilterBar
              filters={filters}
              onChange={changeFilters}
              countries={countries}
              cities={cities}
              trips={tripOptions}
              companions={companionChoices}
            >
              {draftsLink && <div className="hidden md:block">{draftsLink}</div>}
            </BlogFilterBar>
          ) : (
            draftsLink && <div className="hidden md:block">{draftsLink}</div>
          )}
        </header>

        {!loading && blogs.length === 0 && (hasFilters || !canCreate) && (
          <p className="absolute inset-x-4 top-1/2 z-40 text-center text-lg font-semibold text-white drop-shadow-md">
            {hasFilters ? "No published stories match these filters." : "No posts on the trail yet."}
          </p>
        )}

        {matchIds && matchIds.size === 0 && blogs.length > 0 && (
          <p className="absolute inset-x-4 top-1/2 z-40 text-center text-lg font-semibold text-white drop-shadow-md">
            No signposts match &ldquo;{searchQuery}&rdquo;.
          </p>
        )}

        <motion.p
          style={{ opacity: hintOpacity }}
          className="pointer-events-none absolute bottom-12 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/70 px-3 py-1 text-xs font-medium text-white"
        >
          Scroll or use the arrows to ride
        </motion.p>

        <TrailControls progress={progress} scrollProgress={scrollProgress} stops={stops} onSeek={seek} />
      </motion.div>

      <AnimatePresence>{trip && <ExpeditionTransition trip={trip} onComplete={finishTrip} />}</AnimatePresence>
    </section>
  );
}
