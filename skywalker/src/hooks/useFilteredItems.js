import { useMemo, useState } from "react";
import { dateTime, dateYear, matchesDateFilter } from "../lib/dateFilters";

/**
 * Generic controlled continent+country+date/year filter/sort for a list of
 * items, behind the Gallery's FilterBar. The date tier uses the same
 * DateFilter shape (and matching rule) as the blog trail. `getContinent` is
 * optional — omit it and the continent tier simply has no data to show
 * (FilterBar hides that row), so existing callers don't need to change.
 *
 * @param {Array} items
 * @param {{getCountryCode: Function, getCountryName: Function, getDate: Function, getContinent?: Function}} accessors
 */
export function useFilteredItems(items, { getCountryCode, getCountryName, getDate, getContinent }) {
  const [continentFilter, setContinentFilterState] = useState(null); // string | null, single-select
  const [countryFilter, setCountryFilter] = useState([]); // array of codes; empty = all
  const [yearFilter, setYearFilter] = useState([]); // array of numbers; empty = all
  const [sortOrder, setSortOrder] = useState("newest"); // "newest" | "oldest"
  const [dateFilter, setDateFilter] = useState(null); // DateFilter (day / month / range) | null

  const getYear = (item) => dateYear(getDate(item));

  const availableContinents = useMemo(() => {
    if (!getContinent) return [];
    const byName = new Map();
    for (const item of items) {
      const continent = getContinent(item);
      if (!continent) continue;
      const entry = byName.get(continent) ?? { name: continent, count: 0 };
      entry.count += 1;
      byName.set(continent, entry);
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, getContinent]);

  const continentScoped = useMemo(() => {
    if (!continentFilter || !getContinent) return items;
    return items.filter((item) => getContinent(item) === continentFilter);
  }, [items, continentFilter, getContinent]);

  const availableCountries = useMemo(() => {
    const byCode = new Map();
    for (const item of continentScoped) {
      const code = getCountryCode(item);
      if (!code) continue;
      const entry = byCode.get(code) ?? { code, name: getCountryName(item) || code, count: 0 };
      entry.count += 1;
      byCode.set(code, entry);
    }
    return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [continentScoped, getCountryCode, getCountryName]);

  const availableYears = useMemo(() => {
    const byYear = new Map();
    for (const item of continentScoped) {
      if (countryFilter.length > 0 && !countryFilter.includes(getCountryCode(item))) continue;
      const year = getYear(item);
      if (!year) continue;
      const entry = byYear.get(year) ?? { year, count: 0 };
      entry.count += 1;
      byYear.set(year, entry);
    }
    return [...byYear.values()].sort((a, b) => b.year - a.year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continentScoped, countryFilter, getCountryCode, getDate]);

  const filtered = useMemo(() => {
    let next = items;
    if (continentFilter && getContinent) {
      next = next.filter((item) => getContinent(item) === continentFilter);
    }
    if (countryFilter.length > 0) {
      next = next.filter((item) => countryFilter.includes(getCountryCode(item)));
    }
    if (yearFilter.length > 0) {
      next = next.filter((item) => yearFilter.includes(getYear(item)));
    }
    if (dateFilter) {
      next = next.filter((item) => matchesDateFilter(getDate(item), null, dateFilter));
    }
    next = [...next].sort((a, b) => {
      const diff = dateTime(getDate(a)) - dateTime(getDate(b));
      return sortOrder === "newest" ? -diff : diff;
    });
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, continentFilter, countryFilter, yearFilter, dateFilter, sortOrder, getCountryCode, getDate, getContinent]);

  const toggleCountry = (code) => {
    setCountryFilter((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const toggleYear = (year) => {
    setYearFilter((prev) => (prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]));
  };

  const setContinentFilter = (continent) => {
    const next = continentFilter === continent ? null : continent;
    // Selecting/clearing a continent changes which countries+years are even
    // valid, so prune stale selections rather than leaving an invisible
    // filter active that silently zeroes out results. (Kept out of a state
    // updater: updaters must be pure, and StrictMode double-invokes them.)
    if (next) {
      setCountryFilter((codes) =>
        codes.filter((code) => items.some((item) => getCountryCode(item) === code && getContinent?.(item) === next))
      );
    }
    setYearFilter([]);
    setContinentFilterState(next);
  };

  const clearFilters = () => {
    setContinentFilterState(null);
    setCountryFilter([]);
    setYearFilter([]);
    setDateFilter(null);
    setSortOrder("newest");
  };

  const hasActiveFilters = Boolean(continentFilter) || countryFilter.length > 0 || yearFilter.length > 0 || Boolean(dateFilter);

  return {
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
    dateFilter,
    setDateFilter,
    clearFilters,
    hasActiveFilters,
  };
}
