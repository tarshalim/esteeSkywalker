import { CalendarRange, Luggage, Plus, Users } from "lucide-react";
import { NEW_TRIP, allCompanions, tripLabel } from "../../lib/hierarchy";
import { formatDateRange } from "../../lib/dateFilters";
import TripFields from "./TripFields";
import Select from "../Select/Select";

const CARD = "flex min-w-0 flex-col gap-2 rounded-2xl border-2 p-3 text-left transition-[border-color,box-shadow]";
const cardStyle = (active) => ({
  background: "var(--bg-elevated)",
  borderColor: active ? "var(--blue)" : "var(--border)",
  boxShadow: active ? "0 0 0 3px color-mix(in srgb, var(--blue) 18%, transparent)" : "none",
});
const CARD_TITLE = "inline-flex items-center gap-1.5 text-sm font-bold";
const titleStyle = { color: "var(--text-strong, var(--text))" };
const mutedStyle = { color: "var(--text-muted)" };

/**
 * Step 2 of the cascade (Location -> Trip -> content): two side-by-side
 * cards — pick an existing trip, or start a new one inline. The chosen
 * location's trips are listed first; picking one from elsewhere is the
 * caller's cue to move the content to that trip's location. Picking an
 * existing trip shows its dates and companions, which the content then
 * inherits.
 *
 * @param {{
 *   trips: import("../../types/hierarchy").Trip[],   // all of the user's trips
 *   locationId?: ?string,                            // the chosen location, whose trips come first
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
const tripOption = (trip) => (
  <option key={trip.id} value={trip.id}>
    {tripLabel(trip)}
  </option>
);

export default function TripSelect({
  trips,
  locationId = null,
  value,
  onChange,
  draft,
  onDraftChange,
  draftError = null,
  disabledReason = null,
  noneLabel = "No trip",
  label = "Trip",
}) {
  const disabled = Boolean(disabledReason);
  const creating = value === NEW_TRIP && !disabled;
  const selected = trips.find((t) => t.id === value) ?? null;
  const companions = selected ? allCompanions(selected) : [];
  const here = locationId ? trips.filter((t) => t.locationId === locationId) : [];
  const elsewhere = trips.filter((t) => !here.includes(t));
  const countHint =
    trips.length === 0
      ? "No trips yet"
      : `${trips.length} trip${trips.length === 1 ? "" : "s"}` + (here.length > 0 ? ` · ${here.length} here` : "");

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={mutedStyle}>
        <Luggage size={14} aria-hidden="true" />
        {label}
        {disabledReason && <span className="font-normal">· {disabledReason}</span>}
      </span>

      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${disabled ? "opacity-50" : ""}`}>
        <div className={CARD} style={cardStyle(!creating && !disabled)}>
          <span className={CARD_TITLE} style={titleStyle}>
            <Luggage size={16} aria-hidden="true" />
            Select existing trip
          </span>
          <Select
            aria-label="Existing trip"
            value={disabled || creating ? "" : value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{noneLabel}</option>
            {here.length > 0 && elsewhere.length > 0 ? (
              <>
                <optgroup label="At this location">{here.map(tripOption)}</optgroup>
                <optgroup label="Other trips">{elsewhere.map(tripOption)}</optgroup>
              </>
            ) : (
              trips.map(tripOption)
            )}
          </Select>
          {selected ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={mutedStyle}>
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
          ) : (
            <p className="text-xs" style={mutedStyle}>
              {countHint}
            </p>
          )}
        </div>

        <button
          type="button"
          className={`${CARD} enabled:cursor-pointer enabled:hover:border-[var(--blue)] disabled:cursor-not-allowed`}
          style={cardStyle(creating)}
          disabled={disabled}
          aria-pressed={creating}
          onClick={() => onChange(NEW_TRIP)}
        >
          <span className={CARD_TITLE} style={titleStyle}>
            <Plus size={16} aria-hidden="true" />
            Create new trip
          </span>
          <span className="text-xs" style={mutedStyle}>
            {creating ? "Fill in the trip details below." : "Name it, set its dates and who came along."}
          </span>
        </button>
      </div>

      {creating && (
        <div className="rounded-2xl border-2 p-3" style={cardStyle(true)}>
          <TripFields draft={draft} onChange={onDraftChange} error={draftError} />
        </div>
      )}
    </div>
  );
}
