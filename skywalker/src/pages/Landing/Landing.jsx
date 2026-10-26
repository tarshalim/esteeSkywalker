import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import GlobeExplorer from "../../components/GlobeExplorer/GlobeExplorer";
import BlogFeed from "../../components/BlogFeed/BlogFeed";
import TripStories from "../../components/TripStories/TripStories";
import TourBanner from "../../components/Tour/TourBanner";
import HeroCarousel from "../../components/HeroCarousel/HeroCarousel";
import { getBlogs } from "../../lib/blogStore";
import { useAsync } from "../../hooks/useAsync";
import { hasCoords } from "../../lib/geo";
import { GLOBE_HASH } from "../../lib/routes";
import "./Landing.css";

export default function Landing() {
  // Blog -> globe deep link: BlogDetail navigates to /#globe with router state
  // ({ focusLat, focusLng, focusBlogId }) so the globe can fly straight to
  // that post's coordinate on arrival. Keyed on the primitives because every
  // hash sync below hands back a freshly deserialised state object.
  const location = useLocation();
  const navigate = useNavigate();
  const focusLat = location.state?.focusLat;
  const focusLng = location.state?.focusLng;
  const focusBlogId = location.state?.focusBlogId;
  const focusRequest = useMemo(
    // hasCoords, not truthiness — latitude 0 is a real place.
    () => (hasCoords({ lat: focusLat, lng: focusLng }) ? { lat: focusLat, lng: focusLng, blogId: focusBlogId } : null),
    [focusLat, focusLng, focusBlogId]
  );

  const [scrollRoot, setScrollRoot] = useState(null);
  const globeRef = useRef(null);
  const { data: blogs, loading: blogsLoading } = useAsync(getBlogs, [], []);
  const [globeFilter, setGlobeFilter] = useState(null);
  const [clearSignal, setClearSignal] = useState(0);
  // null until the observer first reports, so we never overwrite an incoming
  // /#globe before we've had a chance to scroll there.
  const [inGlobe, setInGlobe] = useState(null);

  const scrollToGlobe = useCallback((behavior = "smooth") => {
    globeRef.current?.scrollIntoView({ behavior, block: "start" });
  }, []);
  const scrollToTop = useCallback(() => scrollRoot?.scrollTo({ top: 0, behavior: "smooth" }), [scrollRoot]);

  // The globe section counts as the active view once it fills most of the screen.
  useEffect(() => {
    const el = globeRef.current;
    if (!el || !scrollRoot) return;
    const observer = new IntersectionObserver(([entry]) => setInGlobe(entry.intersectionRatio >= 0.5), {
      root: scrollRoot,
      threshold: [0, 0.5, 1],
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  // Scroll position -> URL. Replace, not push, so scrolling doesn't fill the
  // back stack; TopNav reads the hash to light up its globe icon.
  const writtenHash = useRef(null);
  const latest = useRef(location);
  latest.current = location;
  useEffect(() => {
    if (inGlobe === null) return;
    const hash = inGlobe ? GLOBE_HASH : "";
    if (latest.current.hash === hash) return;
    writtenHash.current = hash;
    navigate({ hash }, { replace: true, state: latest.current.state });
  }, [inGlobe, navigate]);

  // URL -> scroll position, for hash changes we didn't write ourselves:
  // arriving at /#globe (BlogDetail, a shared link) or the logo taking us
  // back to "/" from the globe.
  const pendingInitialGlobe = useRef(false);
  useEffect(() => {
    if (!scrollRoot || location.hash === writtenHash.current) return;
    const firstRun = writtenHash.current === null;
    writtenHash.current = location.hash;
    if (location.hash === GLOBE_HASH) {
      // Jump instantly on arrival; animate when already on the page.
      scrollToGlobe(firstRun ? "instant" : "smooth");
      pendingInitialGlobe.current = firstRun;
    } else if (!firstRun) {
      scrollToTop();
    }
  }, [location.hash, location.key, scrollRoot, scrollToGlobe, scrollToTop]);

  // The feed above the globe fills in after the first jump; re-anchor once
  // it has, for browsers without CSS scroll anchoring.
  useEffect(() => {
    if (blogsLoading || !pendingInitialGlobe.current) return;
    pendingInitialGlobe.current = false;
    scrollToGlobe("instant");
  }, [blogsLoading, scrollToGlobe]);

  const handleClearGlobeFilter = useCallback(() => setClearSignal((n) => n + 1), []);

  return (
    <div className="landing-page" ref={setScrollRoot}>
      <section
        className="landing-feed"
        aria-labelledby="landing-feed-title"
        data-tour="stories"
        style={{ paddingTop: "calc(var(--nav-bottom) + 20px)" }}
      >
        <HeroCarousel title="The next horizon is calling" titleId="landing-feed-title" />

        <TripStories blogs={blogs} />

        <BlogFeed
          blogs={blogs}
          globeFilter={globeFilter}
          onClearGlobeFilter={handleClearGlobeFilter}
          scrollRoot={scrollRoot}
          tabsTop="calc(var(--nav-bottom) + 12px)"
        />
      </section>

      <section id="globe" className="landing-globe" ref={globeRef} aria-label="Interactive globe">
        <GlobeExplorer
          variant="embedded"
          focusRequest={focusRequest}
          showGallery={false}
          onFilterChange={setGlobeFilter}
          clearSignal={clearSignal}
          searchActive={Boolean(inGlobe)}
        />
      </section>

      {/* The globe canvas eats wheel/touch drags for zooming, so give an
          explicit way back up to the stories. */}
      <AnimatePresence>
        {inGlobe && (
          <motion.button
            type="button"
            className="landing-back-to-stories"
            onClick={scrollToTop}
            aria-label="Back to stories"
            title="Back to stories"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.25 }}
          >
            <ArrowUp size={18} aria-hidden="true" /> <span className="hidden sm:inline">Back to stories</span>
          </motion.button>
        )}
      </AnimatePresence>

      <TourBanner />
    </div>
  );
}
