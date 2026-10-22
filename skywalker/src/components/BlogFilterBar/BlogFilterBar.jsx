import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, Heart, X } from "lucide-react";
import { EMPTY_FILTERS, dateFilterLabel, hasActiveFilters } from "../../lib/blogTaxonomy";
import Select from "../Select/Select";
import { FIELD_INPUT, fieldInputStyle } from "../TripPicker/fieldStyles";

const PILL =
  "inline-flex h-(--control-h-sm) shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-2 px-3 text-xs font-semibold shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 sm:text-sm";
const pillStyle = (active) =>
  active
    ? { background: "var(--blue)", color: "#ffffff", borderColor: "var(--blue)" }
    : { background: "var(--bg-panel-strong, var(--bg-elevated))", color: "var(--text)", borderColor: "var(--border)" };

/** Pill-shaped native select; `label` doubles as the "any" option. Shared with the Gallery's trip filters. */
export function FilterSelect({ label, value, onChange, options }) {
  return (
    <Select variant="pill" active={Boolean(value)} aria-label={label} className="max-w-[11rem] shrink-0" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

const DATE_MODES = [
  { id: "day", label: "Day" },
  { id: "month", label: "Month" },
  { id: "range", label: "Range" },
];

/**
 * Date pill + popover: a single day, a whole month, or a start/end range
 * (either end may be left open). Edits apply as you make them.
 *
 * @param {{
 *   value: ?import("../../lib/blogTaxonomy").DateFilter,
 *   onChange: (next: ?import("../../lib/blogTaxonomy").DateFilter) => void,
 * }} props
 */
function DateFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  // Remembered separately so picking a tab before any date keeps the tab.
  const [mode, setMode] = useState(value?.mode ?? "day");
  const rootRef = useRef(null);
  const panelId = useId();
  const label = dateFilterLabel(value);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pickMode = (next) => {
    setMode(next);
    if (value && value.mode !== next) onChange(null);
  };
  const update = (patch) => {
    const next = { mode, start: "", end: "", ...(value?.mode === mode ? value : {}), ...patch };
    onChange(next.start || next.end ? next : null);
  };
  const current = value?.mode === mode ? value : { start: "", end: "" };

  return (
    // `static` on phones so the panel anchors to the whole (full-width) filter bar, not this pill.
    <div ref={rootRef} className="static shrink-0 md:relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`${PILL} max-w-[14rem]`}
        style={pillStyle(Boolean(label))}
      >
        <CalendarDays size={14} aria-hidden="true" />
        <span className="truncate">{label || "Date"}</span>
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Filter by date"
          className="absolute top-full right-0 left-0 z-50 mt-2 flex flex-col gap-3 rounded-2xl border-2 p-3 shadow-xl md:left-auto md:w-80"
          style={{ background: "var(--bg-panel-strong, var(--bg-elevated))", color: "var(--text)", borderColor: "var(--border)" }}
        >
          <div role="tablist" aria-label="Date filter type" className="grid grid-cols-3 gap-1 rounded-full p-1" style={{ background: "var(--bg-elevated)" }}>
            {DATE_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                onClick={() => pickMode(m.id)}
                className="h-8 rounded-full text-xs font-semibold"
                style={mode === m.id ? { background: "var(--blue)", color: "#fff" } : { color: "var(--text-muted)" }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === "day" && (
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              On
              <input type="date" className={FIELD_INPUT} style={fieldInputStyle} value={current.start} onChange={(e) => update({ start: e.target.value })} />
            </label>
          )}
          {mode === "month" && (
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              During
              <input type="month" className={FIELD_INPUT} style={fieldInputStyle} value={current.start} onChange={(e) => update({ start: e.target.value })} />
            </label>
          )}
          {mode === "range" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                From
                <input
                  type="date"
                  className={FIELD_INPUT}
                  style={fieldInputStyle}
                  max={current.end || undefined}
                  value={current.start}
                  onChange={(e) => update({ start: e.target.value })}
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                To
                <input
                  type="date"
                  className={FIELD_INPUT}
                  style={fieldInputStyle}
                  min={current.start || undefined}
                  value={current.end}
                  onChange={(e) => update({ end: e.target.value })}
                />
              </label>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={!value}
              onClick={() => onChange(null)}
              className="text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-40"
              style={{ color: "var(--text-muted)" }}
            >
              Clear date
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-full px-4 text-xs font-bold text-white" style={{ background: "var(--blue)" }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
      <button
        type="button"
        aria-pressed={filters.favoritesOnly}
        onClick={() => set("favoritesOnly")(!filters.favoritesOnly)}
        className={PILL}
        style={pillStyle(filters.favoritesOnly)}
      >
        <Heart size={14} aria-hidden="true" fill={filters.favoritesOnly ? "currentColor" : "none"} />
        Favorites
      </button>
      {hasActiveFilters(filters) && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-slate-900/70 px-3 text-xs font-semibold text-white sm:text-sm"
        >
          <X size={14} aria-hidden="true" />
          Clear
        </button>
      )}
      {children}
    </div>
  );
}
