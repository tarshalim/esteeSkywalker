import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { dateFilterLabel } from "../../lib/dateFilters";
import Select from "../Select/Select";
import { FIELD_INPUT, FIELD_LABEL, fieldInputStyle, fieldLabelStyle } from "../TripPicker/fieldStyles";

/*
 * Filter primitives shared by the blog trail's BlogFilterBar and the Gallery
 * (its FilterBar and trip filter row). The two bars stay separate components
 * because they filter differently: the Gallery uses multi-select pills with
 * counts (continent, country, year) plus sorting, while the trail drills down
 * single-select tiers (country -> city -> trip -> companion).
 */

const FILTER_PILL =
  "inline-flex h-(--control-h-sm) shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-2 px-3 text-xs font-semibold shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 sm:text-sm";
const filterPillStyle = (active) =>
  active
    ? { background: "var(--blue)", color: "#ffffff", borderColor: "var(--blue)" }
    : { background: "var(--bg-panel-strong, var(--bg-elevated))", color: "var(--text)", borderColor: "var(--border)" };

/** Pill-shaped native select; `label` doubles as the "any" option. */
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

/** On/off pill (e.g. "Favorites"); `children` is its icon and label. */
export function FilterToggle({ pressed, onToggle, children }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={() => onToggle(!pressed)} className={FILTER_PILL} style={filterPillStyle(pressed)}>
      {children}
    </button>
  );
}

/** Dark "× Clear" pill shown while a filter row has something selected. */
export function ClearFiltersButton({ onClick, children = "Clear" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-slate-900/70 px-3 text-xs font-semibold text-white sm:text-sm"
    >
      <X size={14} aria-hidden="true" />
      {children}
    </button>
  );
}

const DATE_MODES = [
  { id: "day", label: "Day" },
  { id: "month", label: "Month" },
  { id: "range", label: "Range" },
];

/**
 * Date pill + popover: a single day, a whole month, or a start/end range
 * (either end may be left open). Edits apply as you make them. Closes on
 * Escape or a click outside.
 *
 * By default the trigger is a FILTER_PILL; pass `triggerClassName` to style
 * it from CSS instead (it gets `is-active` while a date is set).
 *
 * @param {{
 *   value: ?import("../../lib/dateFilters").DateFilter,
 *   onChange: (next: ?import("../../lib/dateFilters").DateFilter) => void,
 *   triggerClassName?: string,
 * }} props
 */
export function DateFilter({ value, onChange, triggerClassName }) {
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

  const trigger = triggerClassName
    ? { className: `${triggerClassName}${label ? " is-active" : ""}` }
    : { className: `${FILTER_PILL} max-w-[14rem]`, style: filterPillStyle(Boolean(label)) };

  return (
    // `static` on phones so the panel anchors to the whole (full-width) filter bar, not this pill.
    <div ref={rootRef} className="static shrink-0 md:relative">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)} {...trigger}>
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
            <label className={FIELD_LABEL} style={fieldLabelStyle}>
              On
              <input type="date" className={FIELD_INPUT} style={fieldInputStyle} value={current.start} onChange={(e) => update({ start: e.target.value })} />
            </label>
          )}
          {mode === "month" && (
            <label className={FIELD_LABEL} style={fieldLabelStyle}>
              During
              <input type="month" className={FIELD_INPUT} style={fieldInputStyle} value={current.start} onChange={(e) => update({ start: e.target.value })} />
            </label>
          )}
          {mode === "range" && (
            <div className="grid grid-cols-2 gap-2">
              <label className={FIELD_LABEL} style={fieldLabelStyle}>
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
              <label className={FIELD_LABEL} style={fieldLabelStyle}>
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
