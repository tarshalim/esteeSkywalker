import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Earth, LoaderCircle, Trash2, X } from "lucide-react";
import { draftFromTrip, emptyTripDraft, validateTrip, validateTripBasics } from "../../lib/hierarchy";
import { formatDateRange } from "../../utils/dateFilters";
import TripFields, { CompanionIntervalsEditor } from "./TripFields";
import TripStopsEditor from "./TripStopsEditor";

const WIZARD_STEPS = ["Basics", "Stops"];

/**
 * Create or edit a trip at a location (from a globe pin's quick card, or a
 * boarding pass in My Stories). `onSave` / `onDelete` throw on failure; the
 * error stays in the dialog.
 *
 * Three shapes:
 *   - new trip (`trip` null): a two-step wizard — name, cover and dates, then
 *     the itinerary (first stop seeded from `home`) and who came along;
 *   - `addStop`: just the itinerary, with a new blank stop focused;
 *   - otherwise the full edit form.
 *
 * @param {{
 *   trip?: ?import("../../types/hierarchy").Trip,   // null to create
 *   locationTitle: string,
 *   home?: ?{ title: string, lat: number, lng: number },   // the trip's pin, seeds the first stop
 *   addStop?: boolean,
 *   onSave: (draft: import("../../types/hierarchy").TripDraft) => Promise<void>,
 *   onDelete?: ?(() => Promise<void>),
 *   onCancel: () => void,
 * }} props
 */
export default function TripDialog({ trip = null, locationTitle, home = null, addStop = false, onSave, onDelete = null, onCancel }) {
  const creating = !trip;
  const [draft, setDraft] = useState(() => (trip ? draftFromTrip(trip) : emptyTripDraft()));
  const [step, setStep] = useState(0); // wizard step, creating only
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // "save" | "delete" | null
  const errorId = useId();
  const onBasics = creating && step === 0;

  const run = async (kind, action) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onBasics) {
      const invalid = validateTripBasics(draft);
      setError(invalid);
      if (!invalid) setStep(1);
      return;
    }
    const invalid = validateTrip(draft);
    if (invalid) return setError(invalid);
    run("save", () => onSave(draft));
  };

  const handleDelete = () => {
    const count = (trip.posts?.length ?? 0) + (trip.photos?.length ?? 0);
    const detail = count > 0 ? ` Its ${count} post${count === 1 ? "" : "s"}/photos stay, just no longer in this trip.` : "";
    if (window.confirm(`Delete “${trip.title}”?${detail}`)) run("delete", onDelete);
  };

  const heading = creating ? (onBasics ? "New trip" : "Add your stops") : addStop ? "Add a stop" : "Edit trip";
  const subheading = creating
    ? `Step ${step + 1} of ${WIZARD_STEPS.length} · at ${locationTitle}`
    : addStop
      ? `${trip.title} · ${formatDateRange(trip.startDate, trip.endDate)}`
      : `at ${locationTitle}`;

  const errorNote = error && (
    <p id={errorId} role="alert" className="text-xs font-semibold text-red-600">
      {error}
    </p>
  );

  const stopsEditor = (
    <TripStopsEditor
      value={draft.stops}
      onChange={(stops) => setDraft((d) => ({ ...d, stops }))}
      tripStart={draft.startDate}
      tripEnd={draft.endDate}
      seed={home}
      compact
      startWithNewStop={addStop || draft.stops.length === 0}
    />
  );

  let body;
  if (onBasics) {
    body = <TripFields draft={draft} onChange={setDraft} error={error} autoFocus cover companions={false} />;
  } else if (creating) {
    body = (
      <div className="flex flex-col gap-4">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Search each city or region you visited. Every stop becomes a pin, joined in date order by arcs on the globe.
        </p>
        {stopsEditor}
        <CompanionIntervalsEditor
          value={draft.companions}
          onChange={(companions) => setDraft((d) => ({ ...d, companions }))}
          tripStart={draft.startDate}
          tripEnd={draft.endDate}
        />
        {errorNote}
      </div>
    );
  } else if (addStop) {
    body = (
      <div className="flex flex-col gap-3">
        {stopsEditor}
        {errorNote}
      </div>
    );
  } else {
    body = <TripFields draft={draft} onChange={setDraft} error={error} cover itinerary home={home} />;
  }

  const secondaryButton = "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold hover:bg-black/5";

  return createPortal(
    <motion.div
      className="fixed inset-0 flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-6"
      style={{ zIndex: "var(--z-modal)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.form
        role="dialog"
        aria-labelledby="trip-dialog-title"
        onSubmit={handleSubmit}
        className="glass-panel flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-w-2xl sm:rounded-2xl"
        style={{ background: "var(--bg-panel-strong)", color: "var(--text)" }}
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 32, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 p-4 pb-2">
          <div className="min-w-0 flex-1">
            <h2 id="trip-dialog-title" className="text-lg font-bold">
              {heading}
            </h2>
            <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
              {subheading}
            </p>
            {creating && (
              <ol className="mt-2 flex gap-1.5" aria-label="Progress">
                {WIZARD_STEPS.map((label, i) => (
                  <li
                    key={label}
                    className="h-1 flex-1 rounded-full transition-colors"
                    style={{ background: i <= step ? "var(--blue)" : "var(--border)" }}
                    aria-current={i === step ? "step" : undefined}
                  >
                    <span className="sr-only">{label}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="-m-1 inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/10"
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {/* Keyed by step so each step opens scrolled to the top. */}
        <div key={step} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 glass-scrollbar">
          {body}
        </div>

        <footer className="flex gap-2 border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" style={{ borderColor: "var(--glass-border)" }}>
          {trip && onDelete && !addStop && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={Boolean(busy)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-red-600 hover:bg-red-500/10 disabled:opacity-40"
              aria-label="Delete trip"
              title="Delete trip"
            >
              {busy === "delete" ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
            </button>
          )}
          {creating && !onBasics ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep(0);
              }}
              disabled={Boolean(busy)}
              className={secondaryButton}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Back
            </button>
          ) : (
            <button type="button" onClick={onCancel} className={secondaryButton}>
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={Boolean(busy)}
            aria-describedby={error && !onBasics ? errorId : undefined}
            className="inline-flex h-10 flex-[1.4] items-center justify-center gap-1.5 rounded-full text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
            style={{ background: "var(--pin-red)" }}
          >
            {busy === "save" && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
            {onBasics ? (
              <>
                Next
                <ArrowRight size={16} aria-hidden="true" />
              </>
            ) : creating ? (
              <>
                {busy !== "save" && <Earth size={16} aria-hidden="true" />}
                Save &amp; View on Globe
              </>
            ) : addStop ? (
              "Save stops"
            ) : (
              "Save trip"
            )}
          </button>
        </footer>
      </motion.form>
    </motion.div>,
    document.body
  );
}
