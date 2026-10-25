import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { LoaderCircle, Trash2, X } from "lucide-react";
import { draftFromTrip, emptyTripDraft, validateTrip } from "../../lib/hierarchy";
import TripFields from "./TripFields";

/**
 * Create or edit a trip at a location (from a globe pin's quick card).
 * `onSave` / `onDelete` throw on failure; the error stays in the dialog.
 *
 * @param {{
 *   trip?: ?import("../../types/hierarchy").Trip,   // null to create
 *   locationTitle: string,
 *   home?: ?{ title: string, lat: number, lng: number },   // the trip's pin, seeds the first stop
 *   onSave: (draft: import("../../types/hierarchy").TripDraft) => Promise<void>,
 *   onDelete?: ?(() => Promise<void>),
 *   onCancel: () => void,
 * }} props
 */
export default function TripDialog({ trip = null, locationTitle, home = null, onSave, onDelete = null, onCancel }) {
  const [draft, setDraft] = useState(() => (trip ? draftFromTrip(trip) : emptyTripDraft()));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // "save" | "delete" | null

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
    const invalid = validateTrip(draft);
    if (invalid) return setError(invalid);
    run("save", () => onSave(draft));
  };

  const handleDelete = () => {
    const count = (trip.posts?.length ?? 0) + (trip.photos?.length ?? 0);
    const detail = count > 0 ? ` Its ${count} post${count === 1 ? "" : "s"}/photos stay, just no longer in this trip.` : "";
    if (window.confirm(`Delete “${trip.title}”?${detail}`)) run("delete", onDelete);
  };

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
              {trip ? "Edit trip" : "New trip"}
            </h2>
            <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
              at {locationTitle}
            </p>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 glass-scrollbar">
          <TripFields draft={draft} onChange={setDraft} error={error} autoFocus={!trip} itinerary home={home} />
        </div>

        <footer className="flex gap-2 border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" style={{ borderColor: "var(--glass-border)" }}>
          {trip && onDelete && (
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
          <button type="button" onClick={onCancel} className="h-10 flex-1 rounded-full text-sm font-semibold hover:bg-black/5">
            Cancel
          </button>
          <button
            type="submit"
            disabled={Boolean(busy)}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
            style={{ background: "var(--pin-red)" }}
          >
            {busy === "save" && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
            {trip ? "Save trip" : "Create trip"}
          </button>
        </footer>
      </motion.form>
    </motion.div>,
    document.body
  );
}
