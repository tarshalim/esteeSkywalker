import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileClock } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useTransform } from "framer-motion";
import { getBlogs } from "../../lib/blogStore";
import { useAuth } from "../../lib/auth";
import { useAsync } from "../../hooks/useAsync";
import { useTrailScroll } from "../../hooks/useTrailScroll";
import TrailBackdrop from "../../components/BlogTrail/TrailBackdrop";
import TrailPath from "../../components/BlogTrail/TrailPath";
import TrailSignpost from "../../components/BlogTrail/TrailSignpost";
import CreateStorySignpost from "../../components/BlogTrail/CreateStorySignpost";
import TrailCyclist from "../../components/BlogTrail/TrailCyclist";
import TrailControls from "../../components/BlogTrail/TrailControls";
import ExpeditionTransition from "../../components/BlogTrail/ExpeditionTransition";
import { riderProgressAt, signpostPercent, worldWidthFor } from "../../components/BlogTrail/trailLayout";
import BlogFilterBar from "../../components/BlogFilterBar/BlogFilterBar";
import { EMPTY_FILTERS, filterHeading, locationOptions, matchesFilters } from "../../lib/blogTaxonomy";

/** Vertical scroll distance per px of horizontal trail — lower rides faster. */
const SCROLL_PER_TRAIL_PX = 0.9;
/** How close (fraction of viewport width) the rider must be for a stop to light up. */
const ACTIVE_RANGE = 0.12;
const ZOOM_SCALE = 2.6;
const CREATE_STOP_ID = "__create__";

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
  const { data: allBlogs, loading } = useAsync(getBlogs, [], []);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Drafts live on their own page; the trail is published stories only. Filter
  // options still come from both, so a place you're drafting is already listed.
  const { countries, cities } = useMemo(() => locationOptions(allBlogs), [allBlogs]);
  const published = useMemo(() => allBlogs.filter((b) => b.status !== "draft"), [allBlogs]);
  const draftCount = allBlogs.length - published.length;
  const blogs = useMemo(() => published.filter((b) => matchesFilters(b, filters)), [published, filters]);
  const hasFilters = Object.values(filters).some(Boolean);
  const heading = filterHeading(filters, countries.find((c) => c.code === filters.country)?.name ?? "");

  const slotCount = blogs.length + (canCreate ? 1 : 0);
  const worldWidth = worldWidthFor(slotCount, viewportWidth);

  // Every stop on the trail (the create post first), with its slot and the scroll progress that reaches it.
  const stops = useMemo(() => {
    const offset = canCreate ? 1 : 0;
    const toStop = (id, slot, blog) => {
      const pct = signpostPercent(slot, slotCount);
      return { id, blog, pct, progress: riderProgressAt((worldWidth * pct) / 100, worldWidth, viewportWidth) };
    };
    return [
      ...(canCreate ? [toStop(CREATE_STOP_ID, 0, null)] : []),
      ...blogs.map((blog, i) => toStop(blog.id, i + offset, blog)),
    ];
  }, [blogs, canCreate, slotCount, worldWidth, viewportWidth]);

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
                onOpen={openBlog}
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
          className="absolute top-[calc(var(--nav-bottom)+12px)] right-4 left-4 z-40 flex flex-col gap-2 text-white sm:right-8 sm:left-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <h1
                aria-live="polite"
                className="truncate text-2xl font-black tracking-tight [-webkit-text-stroke:2px_black] [paint-order:stroke_fill] drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] sm:text-3xl"
              >
                {heading.title}
              </h1>
              <p className="text-base font-bold [-webkit-text-stroke:1.5px_black] [paint-order:stroke_fill] drop-shadow sm:text-lg">
                {loading
                  ? "Packing the saddlebags…"
                  : [heading.subtitle, `${blogs.length} ${blogs.length === 1 ? "stop" : "stops"} on the trail`]
                      .filter(Boolean)
                      .join(" · ")}
              </p>
            </div>
            {canEdit && (
              <Link
                to="/blogs/drafts"
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-slate-900/70 px-2.5 text-xs font-semibold text-white hover:bg-slate-900/85"
              >
                <FileClock size={12} aria-hidden="true" />
                Saved Drafts{draftCount > 0 && ` (${draftCount})`}
              </Link>
            )}
          </div>
          {!loading && allBlogs.length > 0 && (
            <BlogFilterBar filters={filters} onChange={changeFilters} countries={countries} cities={cities} />
          )}
        </header>

        {!loading && blogs.length === 0 && (hasFilters || !canCreate) && (
          <p className="absolute inset-x-4 top-1/2 z-40 text-center text-lg font-semibold text-white drop-shadow-md">
            {hasFilters ? "No published stories match these filters." : "No posts on the trail yet."}
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
