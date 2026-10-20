import { useId, useState } from "react";
import { CalendarRange, ChevronDown, Globe, SlidersHorizontal, X } from "lucide-react";
import { countryCodeToFlagEmoji } from "../../utils/countries";
import "./FilterBar.css";

/**
 * Glassmorphic top control bar: continent single-select pills (narrows which
 * country pills show) + country multi-select pills + year multi-select
 * pills + a newest/oldest sort toggle + an expandable custom date range.
 * Purely presentational — all state comes from useFilteredItems. Shared by
 * Gallery.jsx and BlogsJourney.jsx. `availableContinents`/`availableYears`
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
  dateRange,
  onDateRangeChange,
  hasActiveFilters,
  onClearFilters,
  resultCount,
}) {
  const [rangeOpen, setRangeOpen] = useState(false);
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

          <div className="filter-bar-range">
            <button
              type="button"
              className={`filter-bar-range-toggle ${dateRange ? "is-active" : ""}`}
              onClick={() => setRangeOpen((prev) => !prev)}
            >
              <CalendarRange size={14} />
              Date range
            </button>
            {rangeOpen && (
              <div className="filter-bar-range-popover glass-panel">
                <label>
                  From
                  <input
                    type="date"
                    value={dateRange?.start ?? ""}
                    onChange={(e) => onDateRangeChange({ start: e.target.value, end: dateRange?.end ?? "" })}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={dateRange?.end ?? ""}
                    onChange={(e) => onDateRangeChange({ start: dateRange?.start ?? "", end: e.target.value })}
                  />
                </label>
                {dateRange && (
                  <button type="button" className="filter-bar-range-clear" onClick={() => onDateRangeChange(null)}>
                    Clear range
                  </button>
                )}
              </div>
            )}
          </div>

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
