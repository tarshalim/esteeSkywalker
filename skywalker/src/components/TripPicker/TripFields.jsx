import { useId } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { parseNames } from "../../lib/hierarchy";
import { FIELD_INPUT, FIELD_LABEL, fieldInputStyle, fieldLabelStyle as labelStyle } from "./fieldStyles";
import TripStopsEditor from "./TripStopsEditor";

let rowSeq = 0;
const newRowId = () => `new-${Date.now().toString(36)}-${rowSeq++}`;

/**
 * "People I was with", per phase of the trip. Each row is a date interval
 * inside the trip plus the names of everyone along for it; intervals may
 * overlap. Rows keep the raw names text while typing (`namesText`) so a
 * trailing comma doesn't vanish; `names` is always the parsed list.
 *
 * @param {{
 *   value: import("../../types/hierarchy").TripCompanionInterval[],
 *   onChange: (next: import("../../types/hierarchy").TripCompanionInterval[]) => void,
 *   tripStart: string,
 *   tripEnd: string,
 * }} props
 */
export function CompanionIntervalsEditor({ value, onChange, tripStart, tripEnd }) {
  const update = (id, patch) => onChange(value.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const add = () => onChange([...value, { id: newRowId(), startDate: tripStart, endDate: tripEnd, names: [], namesText: "" }]);
  const remove = (id) => onChange(value.filter((row) => row.id !== id));

  return (
    <fieldset className="@container flex flex-col gap-2">
      <legend className="mb-1 flex items-center gap-1.5 text-xs font-semibold" style={labelStyle}>
        <Users size={14} aria-hidden="true" />
        People I was with
      </legend>
      {value.length === 0 && (
        <p className="text-xs" style={labelStyle}>
          Solo so far. Add who came along. Use several rows if people joined for different parts of the trip.
        </p>
      )}
      {value.map((row, i) => (
        <div
          key={row.id}
          className="grid grid-cols-2 gap-2 rounded-xl border p-2 @lg:grid-cols-[1fr_9.5rem_9.5rem_auto] @lg:items-end"
          style={{ borderColor: "var(--border)" }}
        >
          <label className={`${FIELD_LABEL} col-span-2 @lg:col-span-1`} style={labelStyle}>
            Names
            <input
              className={FIELD_INPUT}
              style={fieldInputStyle}
              placeholder="e.g. Aiko, Ben"
              value={row.namesText ?? row.names.join(", ")}
              onChange={(e) => update(row.id, { namesText: e.target.value, names: parseNames(e.target.value) })}
              aria-label={`Companions, phase ${i + 1}`}
            />
          </label>
          <label className={FIELD_LABEL} style={labelStyle}>
            From
            <input
              type="date"
              className={FIELD_INPUT}
              style={fieldInputStyle}
              min={tripStart}
              max={row.endDate || tripEnd}
              value={row.startDate}
              onChange={(e) => update(row.id, { startDate: e.target.value })}
            />
          </label>
          <label className={FIELD_LABEL} style={labelStyle}>
            To
            <input
              type="date"
              className={FIELD_INPUT}
              style={fieldInputStyle}
              min={row.startDate || tripStart}
              max={tripEnd}
              value={row.endDate}
              onChange={(e) => update(row.id, { endDate: e.target.value })}
            />
          </label>
          <button
            type="button"
            onClick={() => remove(row.id)}
            className="col-span-2 inline-flex h-10 items-center justify-center gap-1 rounded-xl text-xs font-semibold hover:bg-red-500/10 hover:text-red-600 @lg:col-span-1 @lg:w-10"
            aria-label={`Remove phase ${i + 1}`}
            title="Remove"
          >
            <Trash2 size={15} aria-hidden="true" />
            <span className="@lg:hidden">Remove</span>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={!tripStart || !tripEnd}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border-2 px-3 text-xs font-bold disabled:opacity-40"
        style={{ borderColor: "var(--border-strong, var(--border))", color: "var(--text-strong, var(--text))" }}
      >
        <Plus size={14} aria-hidden="true" />
        Add companions
      </button>
    </fieldset>
  );
}

/**
 * The trip form: name, start/end dates, an optional note, companion
 * intervals and — with `itinerary` — the multi-location stop builder.
 * Controlled — `draft` is a TripDraft.
 *
 * @param {{
 *   draft: import("../../types/hierarchy").TripDraft,
 *   onChange: (next: import("../../types/hierarchy").TripDraft) => void,
 *   error?: ?string,
 *   autoFocus?: boolean,
 *   itinerary?: boolean,
 *   home?: ?{ title: string, lat: number, lng: number },  // the trip's pin, seeds the first stop
 * }} props
 */
export default function TripFields({ draft, onChange, error = null, autoFocus = false, itinerary = false, home = null }) {
  const errorId = useId();
  const set = (key) => (e) => {
    const value = e.target.value;
    const next = { ...draft, [key]: value };
    // Keep the trip valid while dragging its dates around.
    if (key === "startDate" && next.endDate && next.endDate < value) next.endDate = value;
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <label className={FIELD_LABEL} style={labelStyle}>
        Trip name
        <input
          className={FIELD_INPUT}
          style={fieldInputStyle}
          placeholder="e.g. Summer Kyoto Food Tour 2026"
          value={draft.title}
          onChange={set("title")}
          autoFocus={autoFocus}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={FIELD_LABEL} style={labelStyle}>
          Start date
          <input type="date" className={FIELD_INPUT} style={fieldInputStyle} value={draft.startDate} onChange={set("startDate")} />
        </label>
        <label className={FIELD_LABEL} style={labelStyle}>
          End date
          <input
            type="date"
            className={FIELD_INPUT}
            style={fieldInputStyle}
            min={draft.startDate}
            value={draft.endDate}
            onChange={set("endDate")}
          />
        </label>
      </div>
      <CompanionIntervalsEditor
        value={draft.companions}
        onChange={(companions) => onChange({ ...draft, companions })}
        tripStart={draft.startDate}
        tripEnd={draft.endDate}
      />
      {itinerary && (
        <TripStopsEditor
          value={draft.stops ?? []}
          onChange={(stops) => onChange({ ...draft, stops })}
          tripStart={draft.startDate}
          tripEnd={draft.endDate}
          seed={home}
        />
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
