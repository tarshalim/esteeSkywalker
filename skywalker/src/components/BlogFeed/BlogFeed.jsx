import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MapPin,
  CalendarDays,
  ArrowRight,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Earth,
  LayoutGrid,
  Plus,
  X,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { formatBlogDate } from "../../lib/dateFilters";
import JourneyPortal from "../JourneyPortal/JourneyPortal";
import CoverPlaceholder from "../CoverPlaceholder/CoverPlaceholder";
import Select from "../Select/Select";
import { realCover } from "../../lib/media";
import "./BlogFeed.css";

const PAGE_SIZE = 6;
const ALL_TAB = "All";
const ALL_YEARS = "all";

const blogTime = (b) => new Date(b.postDate ?? b.date).getTime();
const blogYear = (b) => new Date(b.postDate ?? b.date).getFullYear();

/**
 * Homepage blog feed: continent tabs over a continuously loading card grid.
 * A sentinel below the grid (IntersectionObserver) reveals the next page as
 * the reader nears the end, so the feed reads as one unbroken scroll.
 *
 * @param {Array} blogs
 * @param {?{countryCode:string,label:string}} globeFilter - selection made on the globe above
 * @param {?function} onClearGlobeFilter
 * @param {?Element} scrollRoot - the scrolling ancestor, used as the observer root
 * @param {boolean} autoLoad - false pauses the infinite loader
 */
export default function BlogFeed({
  blogs,
  globeFilter = null,
  onClearGlobeFilter,
  scrollRoot = null,
  tabsTop = 0,
  autoLoad = true,
}) {
  const { user, canEdit } = useAuth();
  // Same rule as TopNav's "Create Blog": signed-out visitors see it and get sent to log in.
  const canCreate = !user || canEdit;
  const [activeTab, setActiveTab] = useState(ALL_TAB);
  const [activeYear, setActiveYear] = useState(ALL_YEARS);
  const [sortOrder, setSortOrder] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  const published = useMemo(
    () => blogs.filter((b) => b.status === "published").sort((a, b) => blogTime(b) - blogTime(a)),
    [blogs]
  );

  const tabs = useMemo(
    () => [ALL_TAB, ...new Set(published.map((b) => b.continent).filter(Boolean))],
    [published]
  );

  const years = useMemo(
    () => [...new Set(published.map(blogYear).filter((y) => !Number.isNaN(y)))].sort((a, b) => b - a),
    [published]
  );

  const filtered = useMemo(() => {
    const matches = published.filter(
      (b) =>
        (activeTab === ALL_TAB || b.continent === activeTab) &&
        (activeYear === ALL_YEARS || blogYear(b) === Number(activeYear)) &&
        (!globeFilter || b.countryCode === globeFilter.countryCode)
    );
    // `published` is already newest-first.
    return sortOrder === "oldest" ? matches.reverse() : matches;
  }, [published, activeTab, activeYear, sortOrder, globeFilter]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [activeTab, activeYear, sortOrder, globeFilter]);

  const SortIcon = sortOrder === "newest" ? ArrowDownWideNarrow : ArrowUpNarrowWide;

  const hasMore = visibleCount < filtered.length;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || !autoLoad) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisibleCount((n) => n + PAGE_SIZE),
      { root: scrollRoot, rootMargin: "0px 0px 400px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, scrollRoot, visibleCount, autoLoad]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <section className="blog-feed" aria-labelledby="blog-feed-title">
      <header className="blog-feed-header section-heading-row">
        <h2 id="blog-feed-title">My Blogs</h2>
        {canCreate && (
          <Link to="/blogs/new" className="section-create">
            <Plus size={14} aria-hidden="true" />
            Create New Blog
          </Link>
        )}
      </header>

      <div className="blog-feed-tabs glass-panel" style={{ top: tabsTop }}>
        <div className="blog-feed-tab-group" role="tablist" aria-label="Filter stories by continent">
          {tabs.map((tab) => {
            const Icon = tab === ALL_TAB ? LayoutGrid : Earth;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={tab === activeTab}
                className={`blog-feed-tab${tab === activeTab ? " is-active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                <Icon size={12} aria-hidden="true" /> {tab}
              </button>
            );
          })}
        </div>

        <span className="blog-feed-divider" aria-hidden="true" />

        {years.length > 1 && (
          <Select
            variant="pill"
            icon={CalendarDays}
            active={activeYear !== ALL_YEARS}
            className="blog-feed-select"
            value={activeYear}
            onChange={(e) => setActiveYear(e.target.value)}
            aria-label="Filter stories by year"
          >
            <option value={ALL_YEARS}>All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        )}

        <button
          type="button"
          className="blog-feed-sort"
          onClick={() => setSortOrder((s) => (s === "newest" ? "oldest" : "newest"))}
          aria-label={`Sorted ${sortOrder} first — switch to ${sortOrder === "newest" ? "oldest" : "newest"} first`}
          title={`Sorted ${sortOrder} first`}
        >
          <SortIcon size={12} aria-hidden="true" /> {sortOrder === "newest" ? "Newest" : "Oldest"}
        </button>

        {globeFilter && (
          <button type="button" className="blog-feed-chip" onClick={onClearGlobeFilter} aria-label={`Clear globe filter: ${globeFilter.label}`}>
            <MapPin size={13} className="shrink-0" /> <span className="blog-feed-chip-label">{globeFilter.label}</span>
            <X size={13} className="shrink-0" aria-hidden="true" />
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
                  {realCover(blog.coverImage) ? (
                    <img src={blog.coverImage} alt="" loading="lazy" />
                  ) : (
                    <CoverPlaceholder variant="blog" seed={blog.id} />
                  )}
                  {blog.continent && <span className="blog-card-badge">{blog.continent}</span>}
                </div>
                <div className="blog-card-body">
                  <div className="blog-card-meta">
                    <span>
                      <MapPin size={13} /> {blog.location?.name ?? blog.countryName}
                    </span>
                    <span>
                      <CalendarDays size={13} /> {formatBlogDate(blog)}
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
        <JourneyPortal storyCount={published.length} />
      </div>
    </section>
  );
}
