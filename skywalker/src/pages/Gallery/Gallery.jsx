import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { getPhotos, createPhoto } from "../../lib/photoStore";
import { useFilteredItems } from "../../hooks/useFilteredItems";
import FilterBar from "../../components/FilterBar/FilterBar";
import PhotoUploadModal from "../../components/PhotoUploadModal/PhotoUploadModal";
import { countryCodeToFlagEmoji } from "../../utils/countries";
import { formatDate } from "../../utils/dateFilters";
import { useAuth } from "../../lib/auth";
import "./Gallery.css";

export default function Gallery() {
  const [photos, setPhotos] = useState([]);
  const [active, setActive] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [searchParams] = useSearchParams();
  const { canEdit } = useAuth();
  const navigate = useNavigate();
  const query = (searchParams.get("q") || searchParams.get("location") || "").toLowerCase();

  useEffect(() => {
    getPhotos().then(setPhotos);
  }, []);

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
  } = useFilteredItems(photos, {
    getCountryCode: (p) => p.countryCode,
    getCountryName: (p) => p.countryName,
    getDate: (p) => p.timestamp,
    getContinent: (p) => p.continent,
  });

  const filteredByQuery = useMemo(() => {
    if (!query) return filtered;
    return filtered.filter((p) => p.locationName.toLowerCase().includes(query));
  }, [filtered, query]);

  const handleFlagClick = (e, countryCode) => {
    e.stopPropagation();
    setCountryFilter([countryCode]);
  };

  const handleUploadSubmit = async (photoData) => {
    const created = await createPhoto(photoData);
    setPhotos((prev) => [...prev, created]);
    setShowUpload(false);
  };

  return (
    <div className="gallery-page">
      <div className="gallery-header">
        <p className="gallery-kicker">My Gallery</p>
        <h1>Snapshots from the road</h1>
        <p className="gallery-subtitle">
          {query ? (
            <>Showing results for &ldquo;{query}&rdquo; · {filteredByQuery.length} photo{filteredByQuery.length === 1 ? "" : "s"}</>
          ) : (
            <>{filteredByQuery.length} photos collected across every waypoint</>
          )}
        </p>
        <button type="button" className="gallery-add-photo" onClick={() => (canEdit ? setShowUpload(true) : navigate("/account", { state: { from: "/gallery" } }))}
        >
          + Add Photo
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
        resultCount={filteredByQuery.length}
      />

      <div className="gallery-grid">
        {filteredByQuery.map((photo, i) => (
          <motion.div
            key={photo.id}
            layoutId={`photo-${photo.id}`}
            className="gallery-item"
            role="button"
            tabIndex={0}
            onClick={() => setActive(photo)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActive(photo)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.5 }}
          >
            <img src={photo.thumbUrl} alt={photo.locationName} loading="lazy" />
            <button
              type="button"
              className="gallery-item-flag"
              onClick={(e) => handleFlagClick(e, photo.countryCode)}
              title={`Filter to ${photo.countryName}`}
            >
              {countryCodeToFlagEmoji(photo.countryCode)}
            </button>
            <span className="gallery-item-label">
              {photo.locationName}
              <span className="gallery-item-date">{formatDate(photo.timestamp, "short")}</span>
            </span>
            {photo.continent && (
              <span className="gallery-item-exif">
                🌐 {photo.continent} · {countryCodeToFlagEmoji(photo.countryCode)} {photo.countryName} · 📅 {photo.year}
              </span>
            )}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            className="gallery-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
          >
            <motion.div layoutId={`photo-${active.id}`} className="gallery-lightbox-card" onClick={(e) => e.stopPropagation()}>
              <img src={active.url} alt={active.locationName} />
              <div className="gallery-lightbox-meta">
                <strong>
                  {countryCodeToFlagEmoji(active.countryCode)} {active.locationName}
                </strong>
                <span>{formatDate(active.timestamp, "long")}</span>
              </div>
              <button className="gallery-lightbox-close" onClick={() => setActive(null)} aria-label="Close">
                ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUpload && <PhotoUploadModal onClose={() => setShowUpload(false)} onSubmit={handleUploadSubmit} />}
      </AnimatePresence>
    </div>
  );
}
