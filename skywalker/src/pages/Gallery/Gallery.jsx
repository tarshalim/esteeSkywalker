import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { getPhotos, createPhoto } from "../../lib/photoStore";
import { getBlogs } from "../../lib/blogStore";
import { collectMedia } from "../../lib/media";
import { useAsync } from "../../hooks/useAsync";
import { useFilteredItems } from "../../hooks/useFilteredItems";
import FilterBar from "../../components/FilterBar/FilterBar";
import MediaView from "../../components/MediaView/MediaView";
import PhotoLightbox from "../../components/PhotoLightbox/PhotoLightbox";
import PhotoUploadModal from "../../components/PhotoUploadModal/PhotoUploadModal";
import { countryCodeToFlagEmoji } from "../../utils/countries";
import { formatDate } from "../../utils/dateFilters";
import { useAuth } from "../../lib/auth";
import "./Gallery.css";

// Module-level so useFilteredItems' memos aren't invalidated every render.
const MEDIA_ACCESSORS = {
  getCountryCode: (m) => m.countryCode,
  getCountryName: (m) => m.countryName,
  getDate: (m) => m.timestamp,
  getContinent: (m) => m.continent,
};

const loadSources = async () => {
  const [photos, blogs] = await Promise.all([getPhotos(), getBlogs()]);
  return { photos, blogs };
};

/** Media-only view: every uploaded photo/video plus images/videos inside published posts. */
export default function Gallery() {
  const { data: sources, loading, error, setData: setSources } = useAsync(loadSources, [], { photos: [], blogs: [] });
  const [active, setActive] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [searchParams] = useSearchParams();
  const { canEdit } = useAuth();
  const navigate = useNavigate();
  const query = (searchParams.get("q") || searchParams.get("location") || "").toLowerCase();

  const media = useMemo(() => collectMedia(sources.photos, sources.blogs), [sources]);

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

  const filteredByQuery = useMemo(() => {
    if (!query) return filtered;
    return filtered.filter((m) => `${m.locationName ?? ""} ${m.countryName ?? ""}`.toLowerCase().includes(query));
  }, [filtered, query]);

  const handleFlagClick = (e, countryCode) => {
    e.stopPropagation();
    setCountryFilter([countryCode]);
  };

  // Throws on failure so the modal can show the error and stay open.
  const handleUploadSubmit = async (photoData) => {
    const created = await createPhoto(photoData);
    setSources((prev) => ({ ...prev, photos: [...prev.photos, created] }));
    setShowUpload(false);
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
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        resultCount={count}
      />

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
        {showUpload && <PhotoUploadModal onClose={() => setShowUpload(false)} onSubmit={handleUploadSubmit} />}
      </AnimatePresence>
    </div>
  );
}
