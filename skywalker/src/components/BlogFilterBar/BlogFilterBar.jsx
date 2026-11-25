import { Heart } from "lucide-react";
import { EMPTY_FILTERS, hasActiveFilters } from "../../lib/blogTaxonomy";
import { ClearFiltersButton, DateFilter, FilterSelect, FilterToggle } from "../FilterControls/FilterControls";

/**
 * Filters for the blog trail, drilling down the hierarchy: country, city
 * (only when the chosen country has real sub-cities — city-states never get
 * one), trip (those with posts in the chosen place), companion (people on
 * those trips), then date and favorites. Options are passed in, built from
 * the user's own posts. Wraps onto extra rows on narrow screens rather than
 * overflowing.
 *
 * @param {{
 *   filters: import("../../lib/blogTaxonomy").BlogFilters,
 *   onChange: (next: import("../../lib/blogTaxonomy").BlogFilters) => void,
 *   countries: { code: string, name: string }[],
 *   cities: { name: string, countryCode: string }[],
 *   trips?: import("../../types/hierarchy").Trip[],   // already narrowed to the chosen place
 *   companions?: string[],                           // people on those trips (or the chosen one)
 *   children?: import("react").ReactNode,   // extra trailing controls (e.g. a Drafts link)
 * }} props
 */
export default function BlogFilterBar({ filters, onChange, countries, cities, trips = [], companions = [], children }) {
  const set = (key) => (value) => {
    const next = { ...filters, [key]: value };
    // Each tier narrows the next: country -> city -> trip -> companion.
    // Changing a tier resets the ones below it.
    const resets = { country: ["city", "trip", "companion"], city: ["trip", "companion"], trip: ["companion"] }[key] ?? [];
    if (value !== filters[key]) for (const below of resets) next[below] = "";
    onChange(next);
  };
  const countryCities = filters.country ? cities.filter((c) => c.countryCode === filters.country) : [];

  return (
    <div role="group" aria-label="Filter stories" className="relative flex flex-wrap items-center gap-2 md:justify-end">
      {countries.length > 0 && (
        <FilterSelect
          label="Country"
          value={filters.country}
          onChange={set("country")}
          options={countries.map((c) => ({ value: c.code, label: c.name }))}
        />
      )}
      {countryCities.length > 0 && (
        <FilterSelect
          label="City"
          value={filters.city}
          onChange={set("city")}
          options={countryCities.map((c) => ({ value: c.name, label: c.name }))}
        />
      )}
      {trips.length > 0 && (
        <FilterSelect
          label="Trip"
          value={filters.trip}
          onChange={set("trip")}
          options={trips.map((t) => ({ value: t.id, label: t.title }))}
        />
      )}
      {companions.length > 0 && (
        <FilterSelect
          label="With anyone"
          value={filters.companion}
          onChange={set("companion")}
          options={companions.map((name) => ({ value: name, label: `With ${name}` }))}
        />
      )}
      <DateFilter value={filters.date} onChange={set("date")} />
      <FilterToggle pressed={filters.favoritesOnly} onToggle={set("favoritesOnly")}>
        <Heart size={14} aria-hidden="true" fill={filters.favoritesOnly ? "currentColor" : "none"} />
        Favorites
      </FilterToggle>
      {hasActiveFilters(filters) && <ClearFiltersButton onClick={() => onChange(EMPTY_FILTERS)} />}
      {children}
    </div>
  );
}
