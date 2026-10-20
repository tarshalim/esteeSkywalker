import { X } from "lucide-react";
import { EMPTY_FILTERS, VIBES } from "../../lib/blogTaxonomy";

function FilterSelect({ label, value, onChange, options }) {
  const active = Boolean(value);
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 max-w-[11rem] cursor-pointer appearance-none truncate rounded-full border-2 py-0 pr-7 pl-3 text-xs font-semibold shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 sm:text-sm"
        style={
          active
            ? { background: "var(--blue)", color: "#ffffff", borderColor: "var(--blue)" }
            : { background: "var(--bg-panel-strong, var(--bg-elevated))", color: "var(--text)", borderColor: "var(--border)" }
        }
      >
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px]" style={{ color: active ? "#fff" : "var(--text-muted)" }}>
        ▼
      </span>
    </label>
  );
}

const toOptions = (list) => list.map((o) => ({ value: o.id, label: o.label }));

/**
 * Location + category filters for the blog trail. Country/city options are
 * passed in (built from the user's own posts); city narrows to the selected
 * country. Scrolls sideways on phones instead of wrapping over the trail.
 *
 * @param {{
 *   filters: import("../../lib/blogTaxonomy").BlogFilters,
 *   onChange: (next: import("../../lib/blogTaxonomy").BlogFilters) => void,
 *   countries: { code: string, name: string }[],
 *   cities: { name: string, countryCode: string }[],
 * }} props
 */
export default function BlogFilterBar({ filters, onChange, countries, cities }) {
  const set = (key) => (value) => {
    const next = { ...filters, [key]: value };
    // A city from another country would silently match nothing.
    if (key === "country" && value && filters.city) {
      const stillValid = cities.some((c) => c.countryCode === value && c.name === filters.city);
      if (!stillValid) next.city = "";
    }
    onChange(next);
  };
  const visibleCities = filters.country ? cities.filter((c) => c.countryCode === filters.country) : cities;
  const hasActive = Object.values(filters).some(Boolean);

  return (
    <div
      role="group"
      aria-label="Filter stories"
      className="-mx-1 flex max-w-[calc(100vw-2rem)] gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] sm:max-w-[min(900px,calc(100vw-4rem))] sm:flex-wrap sm:overflow-visible"
    >
      {countries.length > 0 && (
        <FilterSelect
          label="Country"
          value={filters.country}
          onChange={set("country")}
          options={countries.map((c) => ({ value: c.code, label: c.name }))}
        />
      )}
      {visibleCities.length > 0 && (
        <FilterSelect
          label="City"
          value={filters.city}
          onChange={set("city")}
          options={visibleCities.map((c) => ({ value: c.name, label: c.name }))}
        />
      )}
      <FilterSelect label="Vibe" value={filters.vibe} onChange={set("vibe")} options={toOptions(VIBES)} />
      {hasActive && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-slate-900/70 px-3 text-xs font-semibold text-white sm:text-sm"
        >
          <X size={14} aria-hidden="true" />
          Clear
        </button>
      )}
    </div>
  );
}
