import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, MapPin } from "lucide-react";
import { usePlaceName } from "../../hooks/usePlaceName";
import { formatCoords, isWaterName } from "../../utils/geo";
import "./PinNamePopover.css";

/**
 * Shown right after a pin is dropped onto the globe (GlobeExplorer's
 * `pendingPin`), however it got there — drag, click mode, search or
 * geolocation. The resolved place leads the dialog so it's unambiguous where
 * the story is being pinned. Positioned centrally rather than pixel-exact at
 * the drop point; the red marker on the globe shows the exact spot. Portaled
 * to <body> so it layers above TopNav rather than sliding under it when the
 * globe stage is shorter than the form.
 *
 * @param {{lat:number,lng:number}} coords
 * @param {?string} placeName - already-known name (drag HUD / search pick);
 *   when absent it's resolved here.
 * @param {function({title:string,note:string,placeName:?string,startTrip:boolean})} onConfirm -
 *   `startTrip` when "Start a trip here" was ticked: the caller opens the
 *   new-trip wizard on the saved pin (step 2 of the cascade).
 * @param {?(import("../../lib/pinStore").StoryPin & {distanceKm:number})} nearbyPin -
 *   an existing pin close enough to be the same place; offered instead of a
 *   duplicate so its stories stay together.
 * @param {?function(): void} onUseExisting
 */
export default function PinNamePopover({ coords, placeName = null, nearbyPin = null, onConfirm, onCancel, onUseExisting }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [withTrip, setWithTrip] = useState(false);
  const resolved = usePlaceName(placeName ? null : coords);
  // Saving mid-lookup still stores the local fallback (country / ocean).
  const place = placeName ?? resolved.name;
  const isResolving = !placeName && resolved.isResolving;
  const coordsLabel = formatCoords(coords.lat, coords.lng);
  const isCoordsOnly = place === coordsLabel;
  const preposition = isCoordsOnly ? "at" : isWaterName(place) ? "in the" : "in";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onConfirm({ title: title.trim(), note: note.trim(), placeName: place, startTrip: withTrip });
  };

  return createPortal(
    <div className="pin-name-popover-backdrop" onClick={onCancel}>
      <form
        className="glass-panel pin-name-popover"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        aria-labelledby="pin-name-popover-place"
        data-tour="pin-name"
      >
        <div className="pin-name-popover-place">
          <MapPin className="red-pin-icon" size={28} strokeWidth={2} aria-hidden="true" />
          <div className="pin-name-popover-place-text">
            <h2 id="pin-name-popover-place" className="pin-name-popover-title" aria-live="polite" aria-busy={isResolving}>
              {/* Lead-in and place are separate lines so a long place name
                  wraps on its own instead of reflowing the whole sentence. */}
              <span className="pin-name-popover-eyebrow">
                Pinning your story {isResolving ? "at" : preposition}
              </span>{" "}
              {isResolving ? (
                <span className="pin-name-popover-skeleton">Fetching location…</span>
              ) : (
                <span className="pin-name-popover-place-name" title={place}>
                  {place}
                </span>
              )}
            </h2>
            {/* Before the country polygons load, the title already is the coordinates. */}
            {(isResolving || !isCoordsOnly) && <span className="pin-name-popover-coords">{coordsLabel}</span>}
          </div>
        </div>

        {nearbyPin && (
          <button type="button" className="pin-name-popover-existing" onClick={onUseExisting}>
            <span>
              <strong>{nearbyPin.title}</strong> is already pinned{" "}
              {nearbyPin.distanceKm < 1 ? "here" : `${Math.round(nearbyPin.distanceKm)} km away`}
              {nearbyPin.posts.length > 0 &&
                ` with ${nearbyPin.posts.length} ${nearbyPin.posts.length === 1 ? "story" : "stories"}`}
              . Add a story there instead
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        )}

        <h3>{nearbyPin ? "…or name a new pin" : "Name this pin"}</h3>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Best pho of the trip"
          aria-label="Pin name"
          autoFocus
          required
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note…"
          aria-label="Note"
          rows={3}
        />
        <label className="pin-name-popover-trip-toggle">
          <input type="checkbox" checked={withTrip} onChange={(e) => setWithTrip(e.target.checked)} />
          Start a trip here
        </label>
        {withTrip && <p className="pin-name-popover-trip-hint">Next: name the trip, then add its stops along the way.</p>}
        <div className="pin-name-popover-actions">
          <button type="button" className="pin-name-popover-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="pin-name-popover-save">
            {withTrip ? "Save pin & plan trip" : "Save pin"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
