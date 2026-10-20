import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { ChevronDown, Globe2 } from "lucide-react";
import GlobeExplorer from "../../components/GlobeExplorer/GlobeExplorer";
import BlogFeed from "../../components/BlogFeed/BlogFeed";
import { getBlogs } from "../../lib/blogStore";
import { useNavbarHeight } from "../../hooks/useNavbarHeight";
import { useAsync } from "../../hooks/useAsync";
import { hasCoords } from "../../utils/geo";
import "./Landing.css";

export default function Landing() {
  // Blog -> globe deep link: BlogDetail navigates here with router state
  // ({ focusLat, focusLng, focusBlogId }) so the globe can fly straight to
  // that post's coordinate on arrival.
  const location = useLocation();
  const focusRequest = useMemo(() => {
    const state = location.state;
    // hasCoords, not truthiness — latitude 0 is a real place.
    if (!hasCoords({ lat: state?.focusLat, lng: state?.focusLng })) return null;
    return { lat: state.focusLat, lng: state.focusLng, blogId: state.focusBlogId };
  }, [location.state]);

  const navbarHeight = useNavbarHeight();
  const [scrollRoot, setScrollRoot] = useState(null);
  const globeRef = useRef(null);
  const feedRef = useRef(null);
  const { data: blogs } = useAsync(getBlogs, [], []);
  const [globeFilter, setGlobeFilter] = useState(null);
  const [clearSignal, setClearSignal] = useState(0);
  const [inFeed, setInFeed] = useState(false);

  // Once the globe is mostly scrolled away, the reader is "in" the feed:
  // swap the peek prompt for a floating way back up.
  useEffect(() => {
    const el = globeRef.current;
    if (!el || !scrollRoot) return;
    const observer = new IntersectionObserver(([entry]) => setInFeed(entry.intersectionRatio < 0.35), {
      root: scrollRoot,
      threshold: [0, 0.35, 1],
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  const scrollToFeed = () => feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToGlobe = () => scrollRoot?.scrollTo({ top: 0, behavior: "smooth" });

  const handleClearGlobeFilter = useCallback(() => setClearSignal((n) => n + 1), []);

  return (
    <div
      className="landing-page"
      ref={setScrollRoot}
      style={{ scrollPaddingTop: navbarHeight + 16 }}
    >
      <section className="landing-globe" ref={globeRef}>
        <GlobeExplorer
          variant="embedded"
          focusRequest={focusRequest}
          showGallery={false}
          onFilterChange={setGlobeFilter}
          clearSignal={clearSignal}
        />
      </section>

      <section className="landing-feed" ref={feedRef} aria-labelledby="landing-feed-title">
        <button type="button" className="landing-feed-peek" onClick={scrollToFeed}>
          <span id="landing-feed-title">Stories from the road</span>
          <ChevronDown size={18} className="landing-feed-peek-icon" />
        </button>

        <BlogFeed
          blogs={blogs}
          globeFilter={globeFilter}
          onClearGlobeFilter={handleClearGlobeFilter}
          scrollRoot={scrollRoot}
          tabsTop={navbarHeight + 24}
        />
      </section>

      <AnimatePresence>
        {inFeed && (
          <motion.button
            type="button"
            className="landing-back-to-globe"
            onClick={scrollToGlobe}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.25 }}
          >
            <Globe2 size={16} /> Back to globe
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
