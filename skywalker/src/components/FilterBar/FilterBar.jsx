import { useId, useState } from "react";
import { ChevronDown, Globe, SlidersHorizontal, X } from "lucide-react";
import { DateFilter } from "../FilterControls/FilterControls";
import { countryCodeToFlagEmoji } from "../../lib/countries";
import "./FilterBar.css";

/**
 * Glassmorphic top control bar: continent single-select pills (narrows which
 * country pills show) + country multi-select pills + year multi-select
 * pills + a newest/oldest sort toggle + the shared DateFilter (day, month
 * or range; the same picker as the blog trail's BlogFilterBar).
 * Purely presentational — all state comes from useFilteredItems. Used by
 * Gallery.jsx. `availableContinents`/`availableYears`
 * are optional — omit them (or pass empty arrays) and those rows just don't
 * render, so a caller that hasn't wired up the continent tier still works.
 *
 * On phones the controls collapse behind a "Filters" toggle (a drawer), so
 * a long list of pills can't bury the page it sits over.
 */
export default function FilterBar({
  availableContinents = [],
  continentFilter,
  onSelectContinent,
  availableCountries,
  countryFilter,
  onToggleCountry,
  availableYears = [],
  yearFilter = [],
  onToggleYear,
  sortOrder,
  onSortOrderChange,
  dateFilter,
  onDateFilterChange,
  hasActiveFilters,
  onClearFilters,
  resultCount,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const bodyId = useId();

  if (availableCountries.length === 0) return null;

  return (
    <div className={`filter-bar glass-panel${drawerOpen ? " is-open" : ""}`}>
      {/* Mobile-only (hidden by CSS on wider screens). */}
      <button
        type="button"
        className="filter-bar-toggle"
        aria-expanded={drawerOpen}
        aria-controls={bodyId}
        onClick={() => setDrawerOpen((prev) => !prev)}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        Filters
        {hasActiveFilters && <span className="filter-bar-toggle-dot" title="Filters active" />}
        {typeof resultCount === "number" && <span className="filter-bar-count">{resultCount} shown</span>}
        <ChevronDown size={16} className="filter-bar-toggle-chevron" aria-hidden="true" />
      </button>

      <div id={bodyId} className="filter-bar-body">
        {availableContinents.length > 0 && (
          <div className="filter-bar-pills filter-bar-continents">
            {availableContinents.map((continent) => {
              const active = continentFilter === continent.name;
              return (
                <button
                  key={continent.name}
                  type="button"
                  className={`filter-bar-pill ${active ? "is-active" : ""}`}
                  onClick={() => onSelectContinent(continent.name)}
                >
                  <Globe size={13} className="filter-bar-pill-globe" />
                  {continent.name}
                  <span className="filter-bar-pill-count">{continent.count}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="filter-bar-pills">
          {availableCountries.map((country) => {
            const active = countryFilter.includes(country.code);
            return (
              <button
                key={country.code}
                type="button"
                className={`filter-bar-pill ${active ? "is-active" : ""}`}
                onClick={() => onToggleCountry(country.code)}
              >
                <span className="filter-bar-pill-flag">{countryCodeToFlagEmoji(country.code)}</span>
                {country.name}
                <span className="filter-bar-pill-count">{country.count}</span>
              </button>
            );
          })}
        </div>

        <div className="filter-bar-controls">
          {availableYears.length > 0 && (
            <div className="filter-bar-years">
              {availableYears.map((yearEntry) => {
                const active = yearFilter.includes(yearEntry.year);
                return (
                  <button
                    key={yearEntry.year}
                    type="button"
                    className={`filter-bar-year-pill ${active ? "is-active" : ""}`}
                    onClick={() => onToggleYear(yearEntry.year)}
                  >
                    {yearEntry.year}
                  </button>
                );
              })}
            </div>
          )}

          <div className="filter-bar-sort">
            <button
              type="button"
              className={`filter-bar-sort-btn ${sortOrder === "newest" ? "is-active" : ""}`}
              onClick={() => onSortOrderChange("newest")}
            >
              Newest<span className="hidden sm:inline"> first</span>
            </button>
            <button
              type="button"
              className={`filter-bar-sort-btn ${sortOrder === "oldest" ? "is-active" : ""}`}
              onClick={() => onSortOrderChange("oldest")}
            >
              Oldest<span className="hidden sm:inline"> first</span>
            </button>
          </div>

          <DateFilter value={dateFilter} onChange={onDateFilterChange} triggerClassName="filter-bar-range-toggle" />

          {hasActiveFilters && (
            <button type="button" className="filter-bar-clear" onClick={onClearFilters}>
              <X size={14} />
              Clear<span className="hidden sm:inline"> filters</span>
            </button>
          )}

          {typeof resultCount === "number" && <span className="filter-bar-count">{resultCount} shown</span>}
        </div>
      </div>
    </div>
  );
}
