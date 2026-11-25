import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useInView, useMotionValueEvent, useReducedMotion, useTransform } from "framer-motion";
import { useTrailScroll } from "../../hooks/useTrailScroll";
import { useHorizontalRide } from "../../hooks/useHorizontalRide";
import TrailBackdrop from "../BlogTrail/TrailBackdrop";
import TrailPath from "../BlogTrail/TrailPath";
import TrailSignpost from "../BlogTrail/TrailSignpost";
import CreateStorySignpost from "../BlogTrail/CreateStorySignpost";
import TrailCyclist from "../BlogTrail/TrailCyclist";
import TrailControls from "../BlogTrail/TrailControls";
import ExpeditionTransition from "../BlogTrail/ExpeditionTransition";
import { CREATE_SLOT_SPAN, createPostPercent, riderProgressAt, signpostPercent, worldWidthFor } from "../BlogTrail/trailLayout";

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
 * One trip ridden as a trail: the same scroll-driven cyclist as My Blog, but
 * its signposts are only this trip's posts, oldest first, so the ride follows
 * the trip in order. The section pins a full-screen stage while the page
 * scrolls through it, then lets go so the content below follows.
 *
 * @param {{ tripTitle: string, blogs: Array, createHref?: ?string }} props -
 *   `blogs` already in journey order; `createHref` adds the "write" post at the
 *   trailhead (a new post filed under this trip).
 */
export default function TripJourney({ tripTitle, blogs, createHref = null }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const viewportWidth = useViewportWidth();
  const sectionRef = useRef(null);
  const stageRef = useRef(null);
  // Arrow keys ride only while the trail is on screen, not while reading the gallery below.
  const stageInView = useInView(stageRef, { amount: 0.5 });

  const canCreate = Boolean(createHref);
  const createSpan = canCreate ? CREATE_SLOT_SPAN : 0;
  const slotCount = blogs.length + createSpan;
  const worldWidth = worldWidthFor(slotCount, viewportWidth);

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

  // The clicked pin zooms into an "adventure map" hand-off before opening the post.
  const [expedition, setExpedition] = useState(null);
  const expeditionRef = useRef(null);
  useHorizontalRide(stageRef, {
    scrollPerPx: SCROLL_PER_TRAIL_PX,
    enabled: stageInView && !expedition,
    reduceMotion,
  });
  const openBlog = useCallback(
    (blog, pinEl) => {
      if (expeditionRef.current) return;
      if (reduceMotion || !pinEl || !stageRef.current) {
        navigate(`/blogs/${blog.id}`);
        return;
      }
      const pin = pinEl.getBoundingClientRect();
      const stage = stageRef.current.getBoundingClientRect();
      const x = pin.left + pin.width / 2;
      const y = pin.top + pin.height / 2;
      expeditionRef.current = { blog, x, y, originX: x - stage.left, originY: y - stage.top };
      setExpedition(expeditionRef.current);
    },
    [navigate, reduceMotion]
  );
  const finishExpedition = useCallback(
    () => expedition && navigate(`/blogs/${expedition.blog.id}`),
    [expedition, navigate]
  );

  return (
    <section
      ref={sectionRef}
      className="relative"
      aria-label={`${tripTitle}, ridden as a trail`}
      style={{ height: `calc(100dvh + ${Math.round(worldWidth * SCROLL_PER_TRAIL_PX)}px)` }}
    >
      <motion.div
        ref={stageRef}
        className="sticky top-0 h-[100dvh] w-full touch-pan-y touch-pinch-zoom overflow-hidden bg-sky-200"
        style={{ transformOrigin: expedition ? `${expedition.originX}px ${expedition.originY}px` : "50% 50%" }}
        animate={expedition ? { scale: ZOOM_SCALE, filter: "blur(2px)" } : { scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: [0.7, 0, 0.3, 1] }}
      >
        <TrailBackdrop progress={progress} />

        <motion.div className="absolute inset-y-0 left-0 will-change-transform" style={{ x: cameraX, width: worldWidth }}>
          <TrailPath />
          {stops.map(({ id, blog, pct }, i) =>
            blog ? (
              <TrailSignpost key={id} blog={blog} index={i} leftPct={pct} isActive={activeId === id} onOpen={openBlog} />
            ) : (
              <CreateStorySignpost
                key={id}
                leftPct={pct}
                isFirstStory={blogs.length === 0}
                onCreate={() => navigate(createHref)}
              />
            )
          )}
        </motion.div>

        <TrailCyclist x={riderScreenX} isMoving={isMoving} direction={direction} />

        <header className="pointer-events-none absolute top-[calc(var(--nav-bottom)+12px)] right-4 left-4 z-40 text-white sm:right-8 sm:left-8">
          <p className="truncate text-2xl font-black tracking-tight [-webkit-text-stroke:2px_black] [paint-order:stroke_fill] drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] sm:text-3xl">
            {tripTitle}
          </p>
          <p className="truncate text-base font-bold [-webkit-text-stroke:1.5px_black] [paint-order:stroke_fill] drop-shadow sm:text-lg">
            {blogs.length} {blogs.length === 1 ? "stop" : "stops"} along the way
          </p>
        </header>

        {blogs.length === 0 && !canCreate && (
          <p className="absolute inset-x-4 top-1/2 z-40 text-center text-lg font-semibold text-white drop-shadow-md">
            No stories on this trip yet.
          </p>
        )}

        <motion.p
          style={{ opacity: hintOpacity }}
          className="pointer-events-none absolute bottom-12 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/70 px-3 py-1 text-xs font-medium text-white"
        >
          Scroll or swipe sideways to ride
        </motion.p>

        <TrailControls progress={progress} scrollProgress={scrollProgress} stops={stops} onSeek={seek} />
      </motion.div>

      <AnimatePresence>
        {expedition && <ExpeditionTransition trip={expedition} onComplete={finishExpedition} />}
      </AnimatePresence>
    </section>
  );
}
