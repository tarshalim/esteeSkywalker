import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, CalendarDays, ArrowRight, X } from "lucide-react";
import "./BlogFeed.css";

const PAGE_SIZE = 6;
const ALL_TAB = "All";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Homepage blog feed: continent tabs over a continuously loading card grid.
 * A sentinel below the grid (IntersectionObserver) reveals the next page as
 * the reader nears the end, so the feed reads as one unbroken scroll.
 *
 * @param {Array} blogs
 * @param {?{countryCode:string,label:string}} globeFilter - selection made on the globe above
 * @param {?function} onClearGlobeFilter
 * @param {?Element} scrollRoot - the scrolling ancestor, used as the observer root
 */
export default function BlogFeed({ blogs, globeFilter = null, onClearGlobeFilter, scrollRoot = null, tabsTop = 0 }) {
  const [activeTab, setActiveTab] = useState(ALL_TAB);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  const published = useMemo(
    () =>
      blogs
        .filter((b) => b.status === "published")
        .sort((a, b) => new Date(b.postDate ?? b.date) - new Date(a.postDate ?? a.date)),
    [blogs]
  );

  const tabs = useMemo(
    () => [ALL_TAB, ...new Set(published.map((b) => b.continent).filter(Boolean))],
    [published]
  );

  const filtered = useMemo(
    () =>
      published.filter(
        (b) =>
          (activeTab === ALL_TAB || b.continent === activeTab) &&
          (!globeFilter || b.countryCode === globeFilter.countryCode)
      ),
    [published, activeTab, globeFilter]
  );

  useEffect(() => setVisibleCount(PAGE_SIZE), [activeTab, globeFilter]);

  const hasMore = visibleCount < filtered.length;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisibleCount((n) => n + PAGE_SIZE),
      { root: scrollRoot, rootMargin: "0px 0px 400px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, scrollRoot, visibleCount]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="blog-feed">
      <div className="blog-feed-tabs glass-panel" style={{ top: tabsTop }} role="tablist" aria-label="Filter stories by continent">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={tab === activeTab}
            className={`blog-feed-tab${tab === activeTab ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
        {globeFilter && (
          <button type="button" className="blog-feed-chip" onClick={onClearGlobeFilter}>
            <MapPin size={13} /> {globeFilter.label}
            <X size={13} aria-label="Clear globe filter" />
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="blog-feed-empty">
          No stories here yet{globeFilter ? ` for ${globeFilter.label}` : ""}.
        </p>
      ) : (
        <div className="blog-feed-grid">
          {visible.map((blog, i) => (
            <motion.article
              key={blog.id}
              className="blog-card"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: (i % PAGE_SIZE) * 0.06, ease: "easeOut" }}
            >
              <Link to={`/blogs/${blog.id}`} className="blog-card-link">
                <div className="blog-card-media">
                  {blog.coverImage && <img src={blog.coverImage} alt="" loading="lazy" />}
                  {blog.continent && <span className="blog-card-badge">{blog.continent}</span>}
                </div>
                <div className="blog-card-body">
                  <div className="blog-card-meta">
                    <span>
                      <MapPin size={13} /> {blog.location?.name ?? blog.countryName}
                    </span>
                    <span>
                      <CalendarDays size={13} /> {formatDate(blog.postDate ?? blog.date)}
                    </span>
                  </div>
                  <h3 className="blog-card-title">{blog.title}</h3>
                  {blog.excerpt && <p className="blog-card-excerpt">{blog.excerpt}</p>}
                  <span className="blog-card-cta">
                    Read story <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            </motion.article>
          ))}
        </div>
      )}

      {hasMore && <div ref={sentinelRef} className="blog-feed-sentinel" aria-hidden="true" />}

      <div className="blog-feed-footer">
        <Link to="/blogs" className="blog-feed-journey-btn">
          Ride the full journey <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
