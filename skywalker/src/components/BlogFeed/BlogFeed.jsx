import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  CalendarDays,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
  ChevronDown,
  Earth,
  Flag,
  LayoutGrid,
  Plus,
  X,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { getTrips } from "../../lib/tripStore";
import { useDataChanges } from "../../lib/liveSync";
import { useAsync } from "../../hooks/useAsync";
import { useCountriesGeoJson } from "../../hooks/useCountriesGeoJson";
import { countryCodeToFlagEmoji } from "../../lib/countries";
import { dateTime, dateYear } from "../../lib/dateFilters";
import {
  EMPTY_PLACE_FILTER,
  blogPlaces,
  buildGazetteer,
  hasPlaceFilter,
  matchesPlaceFilter,
  placeFilterCrumbs,
  placeFilterOptions,
  resolvePlaceFilter,
  selectContinent,
  selectCountry,
  toggleCity,
} from "../../lib/blogPlaces";
import JourneyPortal from "../JourneyPortal/JourneyPortal";
import BlogCard from "../BlogCard/BlogCard";
import Select from "../Select/Select";
import LoadingSpinner from "../LoadingSpinner/LoadingSpinner";
import "./BlogFeed.css";

const PAGE_SIZE = 6;
const ALL_YEARS = "all";

const blogTime = (b) => dateTime(b.postDate ?? b.date);
const blogYear = (b) => dateYear(b.postDate ?? b.date);

/**
 * Multi-select City / Region dropdown for the chosen country, as a trigger
 * `button` and its `panel`. They're returned separately because the button
 * sits in the horizontally scrolling filter row, which would clip a popover;
 * the caller renders the panel outside that row, at `panelLeft` px from the
 * left edge of `containerRef` (lined up under the button).
 */
function useCityPicker({ cities, selected, onToggle, onClear, containerRef }) {
  const [open, setOpen] = useState(false);
  const [panelLeft, setPanelLeft] = useState(0);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();
  const names = selected.map((key) => cities.find((c) => c.key === key)?.name).filter(Boolean);
  const label = names.length === 0 ? "City / Region" : names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;

  // The country changed (or lost its cities): nothing left to pick from.
  useEffect(() => {
    if (cities.length === 0) setOpen(false);
  }, [cities.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (!panelRef.current?.contains(e.target) && !anchorRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    // The row scrolling sideways would leave the panel under the wrong button.
    const row = anchorRef.current?.closest(".blog-feed-tabs");
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    row?.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      row?.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggleOpen = () => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    const box = containerRef.current?.getBoundingClientRect();
    if (anchor && box) setPanelLeft(Math.max(0, anchor.left - box.left));
    setOpen((o) => !o);
  };

  return {
    button: (
      <button
        ref={anchorRef}
        type="button"
        className={`blog-feed-sort blog-feed-city-btn${names.length > 0 ? " is-active" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggleOpen}
      >
        <MapPin size={12} aria-hidden="true" />
        <span className="blog-feed-city-label">{label}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>
    ),
    panel: open && (
      <div
        ref={panelRef}
        id={panelId}
        className="blog-feed-city-panel glass-panel"
        style={{ "--panel-left": `${panelLeft}px` }}
        role="group"
        aria-label="Filter by city or region"
      >
        <ul>
          {cities.map((city) => {
            const checked = selected.includes(city.key);
            return (
              <li key={city.key}>
                <label className={`blog-feed-city-option${checked ? " is-checked" : ""}`}>
                  <input type="checkbox" checked={checked} onChange={() => onToggle(city.key)} />
                  <span className="blog-feed-city-check" aria-hidden="true">
                    {checked && <Check size={11} />}
                  </span>
                  <span className="blog-feed-city-name">{city.name}</span>
                  <span className="blog-feed-count">{city.count}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="blog-feed-city-actions">
          <button type="button" onClick={onClear} disabled={selected.length === 0}>
            Any city
          </button>
          <button type="button" className="is-primary" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      </div>
    ),
  };
}

/**
 * Homepage blog feed: a cascading Continent -> Country -> City/Region filter
 * over a continuously loading card grid. Each post is filed under every place
 * it belongs to (its own city, its trip stops, where its photos were taken —
 * lib/blogPlaces), and only destinations that have a story are offered.
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
  // While the blogs are still being fetched: spinner instead of the empty state.
  loading = false,
}) {
  const { user, canEdit } = useAuth();
  // Same rule as TopNav's "Create Blog": signed-out visitors see it and get sent to log in.
  const canCreate = !user || canEdit;
  const [placeFilter, setPlaceFilter] = useState(EMPTY_PLACE_FILTER);
  const [activeYear, setActiveYear] = useState(ALL_YEARS);
  const [sortOrder, setSortOrder] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);
  const filtersRef = useRef(null);

  // Trips give a post its stops; country outlines place photos by GPS.
  const { data: trips, reload: reloadTrips } = useAsync(getTrips, [], []);
  useDataChanges(["trips", "trip_stops"], reloadTrips);
  const countryFeatures = useCountriesGeoJson();

  const published = useMemo(
    () => blogs.filter((b) => b.status === "published").sort((a, b) => blogTime(b) - blogTime(a)),
    [blogs]
  );

  // Every place each post belongs to (lib/blogPlaces), keyed by post id.
  const placesById = useMemo(() => {
    const tripsById = new Map(trips.map((t) => [t.id, t]));
    const gazetteer = buildGazetteer(published, trips, countryFeatures);
    return new Map(
      published.map((b) => [b.id, blogPlaces(b, { trip: tripsById.get(b.tripId) ?? null, gazetteer, countryFeatures })])
    );
  }, [published, trips, countryFeatures]);

  const placeOptions = useMemo(() => placeFilterOptions([...placesById.values()].map((places) => ({ places }))), [placesById]);
  // A pick that's no longer on offer (post deleted/edited) quietly falls away.
  // Memoised: a stale pick resolves to a new object, and the page-size reset
  // below is keyed on it, so an unmemoised one would undo every "load more".
  const place = useMemo(() => resolvePlaceFilter(placeFilter, placeOptions), [placeFilter, placeOptions]);
  const countryOptions = place.continent ? placeOptions.countries.filter((c) => c.continent === place.continent) : placeOptions.countries;
  const cityOptions = place.country ? placeOptions.cities.filter((c) => c.countryCode === place.country) : [];
  const crumbs = placeFilterCrumbs(place, placeOptions);
  const placeActive = hasPlaceFilter(place);

  const years = useMemo(
    () => [...new Set(published.map(blogYear).filter((y) => !Number.isNaN(y)))].sort((a, b) => b - a),
    [published]
  );

  const filtered = useMemo(() => {
    const matches = published.filter((b) => {
      const places = placesById.get(b.id) ?? [];
      return (
        matchesPlaceFilter(places, place) &&
        (activeYear === ALL_YEARS || blogYear(b) === Number(activeYear)) &&
        (!globeFilter || places.some((p) => p.countryCode === globeFilter.countryCode))
      );
    });
    // `published` is already newest-first.
    return sortOrder === "oldest" ? matches.reverse() : matches;
  }, [published, placesById, place, activeYear, sortOrder, globeFilter]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [place, activeYear, sortOrder, globeFilter]);

  const city = useCityPicker({
    cities: cityOptions,
    selected: place.cities,
    onToggle: (key) => setPlaceFilter(toggleCity(place, key)),
    onClear: () => setPlaceFilter({ ...place, cities: [] }),
    containerRef: filtersRef,
  });

  const hasActiveFilters = placeActive || activeYear !== ALL_YEARS || Boolean(globeFilter);
  const clearFilters = () => {
    setPlaceFilter(EMPTY_PLACE_FILTER);
    setActiveYear(ALL_YEARS);
    if (globeFilter) onClearGlobeFilter?.();
  };

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

      <div ref={filtersRef} className="blog-feed-filters" style={{ top: tabsTop }}>
        <div className="blog-feed-tabs glass-panel" role="group" aria-label="Filter stories">
          <div className="blog-feed-tab-group" role="group" aria-label="Continent">
            <button
              type="button"
              aria-pressed={!place.continent}
              className={`blog-feed-tab${!place.continent ? " is-active" : ""}`}
              onClick={() => setPlaceFilter(selectContinent(""))}
            >
              <LayoutGrid size={12} aria-hidden="true" /> All
            </button>
            {placeOptions.continents.map((c) => {
              const active = place.continent === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  aria-pressed={active}
                  className={`blog-feed-tab${active ? " is-active" : ""}`}
                  // Clicking the active continent again goes back to All.
                  onClick={() => setPlaceFilter(selectContinent(active ? "" : c.name))}
                >
                  <Earth size={12} aria-hidden="true" /> {c.name}
                  <span className="blog-feed-count">{c.count}</span>
                </button>
              );
            })}
          </div>

          {countryOptions.length > 0 && (
            <>
              <span className="blog-feed-divider" aria-hidden="true" />
              <Select
                variant="pill"
                icon={Flag}
                active={Boolean(place.country)}
                className="blog-feed-select blog-feed-select--country"
                value={place.country}
                onChange={(e) => setPlaceFilter(selectCountry(place, e.target.value, placeOptions))}
                aria-label="Filter stories by country"
              >
                <option value="">{place.continent ? `All of ${place.continent}` : "All countries"}</option>
                {countryOptions.map((c) => (
                  <option key={c.code} value={c.code}>
                    {countryCodeToFlagEmoji(c.code)} {c.name} ({c.count})
                  </option>
                ))}
              </Select>
            </>
          )}

          {cityOptions.length > 0 && city.button}

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
        </div>

        {cityOptions.length > 0 && city.panel}

        {hasActiveFilters && (
          <div className="blog-feed-active" aria-label="Active filters">
            {placeActive && (
              <button
                type="button"
                className="blog-feed-chip"
                onClick={() => setPlaceFilter(EMPTY_PLACE_FILTER)}
                aria-label={`Clear place filter: ${crumbs.join(", ")}`}
              >
                <MapPin size={13} className="shrink-0" aria-hidden="true" />
                <span className="blog-feed-chip-label">{crumbs.join(" › ")}</span>
                <X size={13} className="shrink-0" aria-hidden="true" />
              </button>
            )}
            {globeFilter && (
              <button type="button" className="blog-feed-chip" onClick={onClearGlobeFilter} aria-label={`Clear globe filter: ${globeFilter.label}`}>
                <Earth size={13} className="shrink-0" aria-hidden="true" />
                <span className="blog-feed-chip-label">Globe: {globeFilter.label}</span>
                <X size={13} className="shrink-0" aria-hidden="true" />
              </button>
            )}
            <button type="button" className="blog-feed-clear" onClick={clearFilters}>
              <X size={12} aria-hidden="true" /> Clear filters
            </button>
            <span className="blog-feed-result-count" aria-live="polite">
              {filtered.length} {filtered.length === 1 ? "story" : "stories"}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingSpinner size="lg" label="Loading stories…" />
      ) : visible.length === 0 ? (
        <p className="blog-feed-empty">
          No stories here yet
          {placeActive ? ` for ${crumbs.at(-1)}` : globeFilter ? ` for ${globeFilter.label}` : ""}.
          {hasActiveFilters && (
            <>
              {" "}
              <button type="button" className="blog-feed-empty-reset" onClick={clearFilters}>
                Clear filters
              </button>
            </>
          )}
        </p>
      ) : (
        <div className="blog-feed-grid">
          {visible.map((blog, i) => (
            <BlogCard key={blog.id} blog={blog} delay={(i % PAGE_SIZE) * 0.06} />
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
