import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { getPhotos, createPhoto } from "../../lib/photoStore";
import { getBlogs } from "../../lib/blogStore";
import { getPins } from "../../lib/pinStore";
import { getTrips } from "../../lib/tripStore";
import {
  ATTACHMENT_FILTERS,
  attachmentOf,
  companionOptions,
  companionsForPhoto,
  companionsForPost,
  tripLabel,
  tripsReferencedBy,
} from "../../lib/hierarchy";
import { FilterSelect } from "../../components/BlogFilterBar/BlogFilterBar";
import { collectMedia } from "../../lib/media";
import { useAsync } from "../../hooks/useAsync";
import { useFilteredItems } from "../../hooks/useFilteredItems";
import FilterBar from "../../components/FilterBar/FilterBar";
import MediaView from "../../components/MediaView/MediaView";
import PhotoLightbox from "../../components/PhotoLightbox/PhotoLightbox";
import PhotoUploadModal from "../../components/PhotoUploadModal/PhotoUploadModal";
import { countryCodeToFlagEmoji } from "../../lib/countries";
import { formatDate } from "../../lib/dateFilters";
import { useAuth } from "../../lib/auth";
import { usePageSearch, useSearch } from "../../lib/search";
import { matchesQuery } from "../../lib/textMatch";
import "./Gallery.css";

// Module-level so useFilteredItems' memos aren't invalidated every render.
const MEDIA_ACCESSORS = {
  getCountryCode: (m) => m.countryCode,
  getCountryName: (m) => m.countryName,
  getDate: (m) => m.timestamp,
  getContinent: (m) => m.continent,
};

const MAX_SEARCH_RESULTS = 6;

const loadSources = async () => {
  const [photos, blogs, pins, trips] = await Promise.all([getPhotos(), getBlogs(), getPins(), getTrips()]);
  return { photos, blogs, pins, trips };
};

const EMPTY_SOURCES = { photos: [], blogs: [], pins: [], trips: [] };
const EMPTY_TRIP_FILTERS = { trip: "", attachment: "", companion: "", tag: "" };

/**
 * Media-only view: every uploaded photo/video plus images/videos inside
 * published posts. Filters drill down the hierarchy — place (continent,
 * country) -> trip -> standalone vs blog-attached — plus companions and tags.
 * `?upload=1&pin=…&trip=…` (from a globe pin's quick card) opens the upload
 * dialog already filed under that location/trip.
 */
export default function Gallery() {
  const { data: sources, loading, error, setData: setSources } = useAsync(loadSources, [], EMPTY_SOURCES);
  const [active, setActive] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { canEdit } = useAuth();
  const [showUpload, setShowUpload] = useState(() => canEdit && searchParams.get("upload") === "1");
  const [tripFilters, setTripFilters] = useState(() => ({ ...EMPTY_TRIP_FILTERS, trip: searchParams.get("trip") ?? "" }));
  // The session may resolve after mount; honour ?upload=1 once it does.
  const wantsUpload = searchParams.get("upload") === "1";
  useEffect(() => {
    if (canEdit && wantsUpload) setShowUpload(true);
  }, [canEdit, wantsUpload]);
  const navigate = useNavigate();
  // Typed live in the navbar (seeded from ?q= when arriving from another page).
  const { query: rawQuery } = useSearch();
  const query = useDeferredValue(rawQuery.trim());

  const media = useMemo(() => collectMedia(sources.photos, sources.blogs), [sources]);
  const tripsById = useMemo(() => new Map(sources.trips.map((t) => [t.id, t])), [sources.trips]);
  const blogsById = useMemo(() => new Map(sources.blogs.map((b) => [b.id, b])), [sources.blogs]);

  // Hierarchy facts per item, computed once: its trip, who was there, and tags.
  const facts = useMemo(() => {
    const map = new Map();
    for (const item of media) {
      const trip = item.tripId ? tripsById.get(item.tripId) ?? null : null;
      const blog = item.blogId ? blogsById.get(item.blogId) ?? null : null;
      const companions = blog ? companionsForPost(blog, trip) : companionsForPhoto(item, trip);
      map.set(item.id, { trip, blog, companions, tags: item.tags ?? [] });
    }
    return map;
  }, [media, tripsById, blogsById]);

  const {
    filtered,
    availableContinents,
    continentFilter,
    setContinentFilter,
    availableCountries,
    countryFilter,
    setCountryFilter,
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
  } = useFilteredItems(media, MEDIA_ACCESSORS);

  // Trip tier: only trips with media in the current place/date selection are
  // offered (the chosen one stays listed so it can be seen and cleared).
  const tripOptions = useMemo(() => {
    const referenced = tripsReferencedBy(sources.trips, filtered);
    const chosen = tripsById.get(tripFilters.trip);
    return chosen && !referenced.includes(chosen) ? [chosen, ...referenced] : referenced;
  }, [sources.trips, filtered, tripsById, tripFilters.trip]);

  const tripScoped = useMemo(() => {
    const { trip, attachment } = tripFilters;
    return filtered.filter((m) => (!trip || m.tripId === trip) && (!attachment || attachmentOf(m) === attachment));
  }, [filtered, tripFilters]);

  const companionChoices = useMemo(() => {
    const chosen = tripsById.get(tripFilters.trip);
    return companionOptions(chosen ? [chosen] : tripOptions);
  }, [tripsById, tripFilters.trip, tripOptions]);

  const tagChoices = useMemo(() => {
    const tags = new Set();
    for (const m of tripScoped) facts.get(m.id)?.tags.forEach((t) => tags.add(t));
    if (tripFilters.tag) tags.add(tripFilters.tag);
    return [...tags].sort();
  }, [tripScoped, facts, tripFilters.tag]);

  const hierarchyFiltered = useMemo(() => {
    const { companion, tag } = tripFilters;
    if (!companion && !tag) return tripScoped;
    return tripScoped.filter((m) => {
      const f = facts.get(m.id);
      return (!companion || f.companions.includes(companion)) && (!tag || f.tags.includes(tag));
    });
  }, [tripScoped, facts, tripFilters]);

  const setTripFilter = (key) => (value) =>
    setTripFilters((prev) => ({
      ...prev,
      [key]: value,
      // Companions belong to a trip; switching trips resets that choice.
      ...(key === "trip" && value !== prev.trip ? { companion: "" } : {}),
    }));
  const hasTripFilters = Object.values(tripFilters).some(Boolean);
  const clearAllFilters = () => {
    clearFilters();
    setTripFilters(EMPTY_TRIP_FILTERS);
  };

  // Navbar search reaches every tier: place names, trip titles and companions,
  // post titles/tags, and photo captions/tags.
  const filteredByQuery = useMemo(() => {
    if (!query) return hierarchyFiltered;
    return hierarchyFiltered.filter((m) => {
      const f = facts.get(m.id);
      return matchesQuery(
        query,
        m.locationName,
        m.countryName,
        m.continent,
        m.caption,
        f.tags,
        f.trip?.title,
        f.companions,
        f.blog?.title,
        f.blog?.tags
      );
    });
  }, [hierarchyFiltered, facts, query]);

  const searchResults = useMemo(
    () =>
      query
        ? filteredByQuery.slice(0, MAX_SEARCH_RESULTS).map((m) => ({
            id: m.id,
            kind: "photo",
            label: m.caption || m.locationName || m.countryName || "Untitled",
            sublabel: [facts.get(m.id).trip?.title ?? m.countryName, formatDate(m.timestamp, "short")].filter(Boolean).join(" · "),
            item: m,
          }))
        : [],
    [filteredByQuery, facts, query]
  );
  const openResult = useCallback((result) => setActive(result.item), []);
  usePageSearch({ placeholder: "Search photos & gallery…", results: searchResults, onSelect: openResult });

  const handleFlagClick = (e, countryCode) => {
    e.stopPropagation();
    setCountryFilter([countryCode]);
  };

  // Throws on failure so the modal can show the error and stay open.
  // The modal may have created a location/trip too, so those lists reload.
  const handleUploadSubmit = async (photoData) => {
    const created = await createPhoto(photoData);
    const [pins, trips] = await Promise.all([getPins(), getTrips()]);
    setSources((prev) => ({ ...prev, pins, trips, photos: [...prev.photos, created] }));
    closeUpload(`Added to your gallery · ${created.locationName ?? photoData.locationName}`);
  };

  // Drops the one-shot ?upload/pin/trip params so a reload doesn't reopen the
  // dialog; `flash` shows a success toast via FlashToast.
  const closeUpload = (flash) => {
    setShowUpload(false);
    if (searchParams.has("upload") || typeof flash === "string") {
      const next = new URLSearchParams(searchParams);
      ["upload", "pin", "trip"].forEach((key) => next.delete(key));
      setSearchParams(next, { replace: true, state: typeof flash === "string" ? { flash } : undefined });
    }
  };

  const count = filteredByQuery.length;
  const noun = `item${count === 1 ? "" : "s"}`;

  return (
    <div className="gallery-page">
      <div className="gallery-header">
        <p className="gallery-kicker">My Gallery</p>
        <h1>Snapshots from the road</h1>
        <p className="gallery-subtitle">
          {loading ? (
            "Loading…"
          ) : query ? (
            <>Showing results for &ldquo;{query}&rdquo; · {count} {noun}</>
          ) : (
            <>{count} photos &amp; videos collected across every waypoint</>
          )}
        </p>
        <button
          type="button"
          className="gallery-add-photo"
          onClick={() => (canEdit ? setShowUpload(true) : navigate("/account", { state: { from: "/gallery" } }))}
        >
          + Add Media
        </button>
      </div>

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
        hasActiveFilters={hasActiveFilters || hasTripFilters}
        onClearFilters={clearAllFilters}
        resultCount={count}
      />

      <div role="group" aria-label="Filter by trip" className="mb-4 flex flex-wrap items-center gap-2">
        {tripOptions.length > 0 && (
          <FilterSelect
            label="All trips"
            value={tripFilters.trip}
            onChange={setTripFilter("trip")}
            options={tripOptions.map((t) => ({ value: t.id, label: tripLabel(t) }))}
          />
        )}
        <FilterSelect
          label={ATTACHMENT_FILTERS[0].label}
          value={tripFilters.attachment}
          onChange={setTripFilter("attachment")}
          options={ATTACHMENT_FILTERS.slice(1).map((o) => ({ value: o.id, label: o.label }))}
        />
        {companionChoices.length > 0 && (
          <FilterSelect
            label="With anyone"
            value={tripFilters.companion}
            onChange={setTripFilter("companion")}
            options={companionChoices.map((name) => ({ value: name, label: `With ${name}` }))}
          />
        )}
        {tagChoices.length > 0 && (
          <FilterSelect
            label="Any tag"
            value={tripFilters.tag}
            onChange={setTripFilter("tag")}
            options={tagChoices.map((tag) => ({ value: tag, label: `#${tag}` }))}
          />
        )}
        {hasTripFilters && (
          <button
            type="button"
            onClick={() => setTripFilters(EMPTY_TRIP_FILTERS)}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-slate-900/70 px-3 text-xs font-semibold text-white sm:text-sm"
          >
            <X size={14} aria-hidden="true" />
            Clear trip filters
          </button>
        )}
      </div>

      {error && <p className="gallery-subtitle">Couldn&rsquo;t load the gallery: {error.message}</p>}
      {!loading && !error && count === 0 && <p className="gallery-subtitle">Nothing here yet.</p>}

      <div className="gallery-grid">
        {filteredByQuery.map((item, i) => (
          <motion.div
            key={item.id}
            layoutId={`photo-${item.id}`}
            className="gallery-item"
            role="button"
            tabIndex={0}
            onClick={() => setActive(item)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActive(item)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.5 }}
          >
            <MediaView item={item} alt={item.locationName} />
            {item.countryCode && (
              <button
                type="button"
                className="gallery-item-flag touch-hit"
                onClick={(e) => handleFlagClick(e, item.countryCode)}
                title={`Filter to ${item.countryName}`}
              >
                {countryCodeToFlagEmoji(item.countryCode)}
              </button>
            )}
            <span className="gallery-item-label">
              {item.locationName}
              <span className="gallery-item-date">{formatDate(item.timestamp, "short")}</span>
            </span>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>{active && <PhotoLightbox photo={active} onClose={() => setActive(null)} />}</AnimatePresence>

      <AnimatePresence>
        {showUpload && !loading && (
          <PhotoUploadModal
            pins={sources.pins}
            trips={sources.trips}
            blogs={sources.blogs}
            initialPinId={searchParams.get("pin")}
            initialTripId={searchParams.get("trip")}
            onClose={closeUpload}
            onSubmit={handleUploadSubmit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
