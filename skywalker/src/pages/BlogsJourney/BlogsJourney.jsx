import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getBlogs } from "../../lib/blogStore";
import CyclistSprite from "../../components/CyclistSprite/CyclistSprite";
import Signpost from "../../components/Signpost/Signpost";
import FilterBar from "../../components/FilterBar/FilterBar";
import { useFilteredItems } from "../../hooks/useFilteredItems";
import { useNavbarHeight } from "../../hooks/useNavbarHeight";
import { useAsync } from "../../hooks/useAsync";
import "./BlogsJourney.css";

const CYCLIST_SCREEN_RATIO = 0.18;
const NEAR_THRESHOLD_PX = 90;
const END_BUFFER_PX = 900;
const IDLE_TIMEOUT_MS = 160;

// Module-level so useFilteredItems' memos survive the per-scroll re-renders.
const BLOG_ACCESSORS = {
  getCountryCode: (b) => b.countryCode,
  getCountryName: (b) => b.countryName,
  getDate: (b) => b.postDate ?? b.date,
  getContinent: (b) => b.continent,
};

export default function BlogsJourney() {
  const navigate = useNavigate();
  const trackRef = useRef(null);
  const { data: blogs } = useAsync(getBlogs, [], []);
  const [progress, setProgress] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [direction, setDirection] = useState(1);
  const [smooth, setSmooth] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const idleTimer = useRef(null);
  const dragState = useRef(null);
  const navbarHeight = useNavbarHeight();

  const {
    filtered: filteredBlogs,
    availableContinents,
    continentFilter,
    setContinentFilter,
    availableCountries,
    countryFilter,
    toggleCountry,
    availableYears,
    yearFilter,
    toggleYear,
    sortOrder,
    setSortOrder,
    dateRange,
    setDateRange,
    hasActiveFilters,
    clearFilters,
  } = useFilteredItems(blogs, BLOG_ACCESSORS);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const trackWidth = useMemo(() => {
    if (blogs.length === 0) return viewportWidth;
    return Math.max(...blogs.map((b) => b.trackX)) + END_BUFFER_PX;
  }, [blogs, viewportWidth]);

  const cyclistScreenX = viewportWidth * CYCLIST_SCREEN_RATIO;

  const registerActivity = useCallback((dir) => {
    setIsMoving(true);
    setDirection(dir);
    setSmooth(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIsMoving(false), IDLE_TIMEOUT_MS);
  }, []);

  const nudge = useCallback(
    (delta) => {
      registerActivity(delta >= 0 ? 1 : -1);
      setProgress((p) => Math.min(Math.max(p + delta, 0), trackWidth));
    },
    [registerActivity, trackWidth]
  );

  // React's synthetic wheel listener is passive by default, so preventDefault()
  // silently no-ops there — a native, non-passive listener is required to stop
  // the page from also scrolling vertically while we drive horizontal progress.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      nudge(delta);
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [nudge]);

  const handlePointerDown = (e) => {
    dragState.current = { startX: e.clientX, startProgress: progress };
  };
  const handlePointerMove = (e) => {
    if (!dragState.current) return;
    const delta = dragState.current.startX - e.clientX;
    registerActivity(delta >= 0 ? 1 : -1);
    setProgress(Math.min(Math.max(dragState.current.startProgress + delta, 0), trackWidth));
  };
  const endDrag = () => {
    dragState.current = null;
  };

  const jumpTo = (targetTrackX) => {
    setSmooth(true);
    setDirection(targetTrackX > progress ? 1 : -1);
    setProgress(Math.min(Math.max(targetTrackX - cyclistScreenX + 60, 0), trackWidth));
  };

  const goToNearest = (dir) => {
    const candidates = filteredBlogs.map((b) => b.trackX - cyclistScreenX + 60);
    const next =
      dir > 0
        ? candidates.filter((x) => x > progress + 4).sort((a, b) => a - b)[0]
        : candidates.filter((x) => x < progress - 4).sort((a, b) => b - a)[0];
    if (next != null) jumpTo(next);
  };

  const percentComplete = trackWidth > 0 ? Math.min((progress / trackWidth) * 100, 100) : 0;

  return (
    <div className="journey-page">
      <div className="journey-filterbar" style={{ top: navbarHeight + 16 }}>
        <FilterBar
          availableContinents={availableContinents}
          continentFilter={continentFilter}
          onSelectContinent={setContinentFilter}
          availableCountries={availableCountries}
          countryFilter={countryFilter}
          onToggleCountry={toggleCountry}
          availableYears={availableYears}
          yearFilter={yearFilter}
          onToggleYear={toggleYear}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          resultCount={filteredBlogs.length}
        />
      </div>

      <div
        className="journey-track"
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <div
          className="journey-parallax-far"
          style={{ transform: `translateX(${-progress * 0.15}px)` }}
        />
        <div
          className="journey-parallax-near"
          style={{ transform: `translateX(${-progress * 0.4}px)` }}
        />

        <div
          className="journey-world"
          style={{
            transform: `translateX(${-progress}px)`,
            transition: smooth ? "transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)" : "none",
          }}
          onTransitionEnd={() => setSmooth(false)}
        >
          <div className="journey-road" style={{ width: trackWidth }} />
          {filteredBlogs.map((blog) => {
            const screenX = blog.trackX - progress;
            const isNear = Math.abs(screenX - cyclistScreenX) < NEAR_THRESHOLD_PX;
            return (
              <Signpost
                key={blog.id}
                blog={blog}
                trackX={blog.trackX}
                laneOffset={blog.laneOffset}
                isNear={isNear}
                onSelect={(id) => navigate(`/blogs/${id}`)}
              />
            );
          })}
        </div>

        <CyclistSprite isMoving={isMoving} direction={direction} />
      </div>

      <div className="journey-hud">
        <button className="journey-arrow" onClick={() => goToNearest(-1)} aria-label="Previous waypoint">
          ‹
        </button>
        <div className="journey-progress-track">
          <motion.div className="journey-progress-fill" animate={{ width: `${percentComplete}%` }} transition={{ duration: 0.2 }} />
          {filteredBlogs.map((blog) => (
            <button
              key={blog.id}
              className="journey-progress-mark"
              style={{ left: `${(blog.trackX / trackWidth) * 100}%` }}
              onClick={() => jumpTo(blog.trackX - cyclistScreenX + 60)}
              title={blog.title}
            />
          ))}
        </div>
        <button className="journey-arrow" onClick={() => goToNearest(1)} aria-label="Next waypoint">
          ›
        </button>
      </div>

      <p className="journey-hint">Scroll, drag, or use the arrows to ride down the timeline</p>
    </div>
  );
}
