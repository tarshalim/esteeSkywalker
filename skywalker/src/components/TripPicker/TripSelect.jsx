import { CalendarRange, Luggage, Users } from "lucide-react";
import { NEW_TRIP, allCompanions, tripLabel } from "../../lib/hierarchy";
import { formatDateRange } from "../../utils/dateFilters";
import TripFields from "./TripFields";
import { FIELD_INPUT, fieldInputStyle } from "./fieldStyles";

/**
 * Step 2 of the cascade (Location -> Trip -> content): pick one of the
 * location's trips, or start a new one inline. Picking an existing trip shows
 * its dates and companions, which the content then inherits.
 *
 * @param {{
 *   trips: import("../../types/hierarchy").Trip[],   // already narrowed to the chosen location
 *   value: string,                                   // "" (no trip) | trip id | NEW_TRIP
 *   onChange: (value: string) => void,
 *   draft: import("../../types/hierarchy").TripDraft, // the new trip, when value === NEW_TRIP
 *   onDraftChange: (draft: import("../../types/hierarchy").TripDraft) => void,
 *   draftError?: ?string,
 *   disabledReason?: ?string,                        // e.g. "Pick a location first"
 *   noneLabel?: string,
 *   label?: string,
 * }} props
 */
export default function TripSelect({
  trips,
  value,
  onChange,
  draft,
  onDraftChange,
  draftError = null,
  disabledReason = null,
  noneLabel = "No trip",
  label = "Trip",
}) {
  const selected = trips.find((t) => t.id === value) ?? null;
  const companions = selected ? allCompanions(selected) : [];

  return (
    <div className="flex flex-col gap-2">
      <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
        <span className="inline-flex items-center gap-1.5">
          <Luggage size={14} aria-hidden="true" />
          {label}
        </span>
        <select
          className={FIELD_INPUT}
          style={fieldInputStyle}
          value={disabledReason ? "" : value}
          disabled={Boolean(disabledReason)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{disabledReason ?? noneLabel}</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {tripLabel(trip)}
            </option>
          ))}
          <option value={NEW_TRIP}>+ New trip…</option>
        </select>
      </label>

      {selected && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
          <span className="inline-flex items-center gap-1">
            <CalendarRange size={13} aria-hidden="true" />
            {formatDateRange(selected.startDate, selected.endDate)}
          </span>
          {companions.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users size={13} aria-hidden="true" />
              {companions.join(", ")}
            </span>
          )}
        </p>
      )}

      {value === NEW_TRIP && !disabledReason && (
        <div className="rounded-2xl border-2 border-dashed p-3" style={{ borderColor: "var(--border)" }}>
          <TripFields draft={draft} onChange={onDraftChange} error={draftError} />
        </div>
      )}
    </div>
  );
}
