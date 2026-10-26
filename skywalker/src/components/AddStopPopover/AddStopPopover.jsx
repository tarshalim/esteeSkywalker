import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MapPinPlus } from "lucide-react";
import { usePlaceName } from "../../hooks/usePlaceName";
import { formatCoords } from "../../lib/geo";
import Select from "../Select/Select";
import "./AddStopPopover.css";

// Keep the card this far inside the stage's left/right edges.
const EDGE_PX = 12;
// The dropped-pin marker stands this tall above its tip; the card clears it.
const MARKER_PX = 44;

/**
 * Mini "Add stop here?" prompt anchored to a spot clicked on the globe while
 * a location with trips is open (GlobeExplorer). Confirming hands the spot
 * and its resolved place name to the trip's add-stop dialog.
 *
 * It follows the spot as the globe turns without re-rendering: the parent
 * calls `trackRef.current()` on every camera change, which re-reads the
 * spot's screen point through `locate` and moves the card. Behind the globe
 * it hides.
 *
 * @param {{lat:number,lng:number}} coords
 * @param {import("../../types/hierarchy").TripNode[]} trips - the trips it can join; a picker shows for several
 * @param {?string} defaultTripId
 * @param {function(number, number): ?{x:number,y:number,visible:boolean}} locate - client point of a lat/lng
 * @param {{current: ?function(): void}} trackRef
 * @param {function({trip: import("../../types/hierarchy").TripNode, placeName: string}): void} onConfirm
 * @param {function(): void} onCancel
 */
export default function AddStopPopover({ coords, trips, defaultTripId = null, locate, trackRef, onConfirm, onCancel }) {
  const ref = useRef(null);
  const [tripId, setTripId] = useState(() => (trips.some((t) => t.id === defaultTripId) ? defaultTripId : trips[0]?.id));
  const trip = trips.find((t) => t.id === tripId) ?? trips[0];
  const { name, isResolving } = usePlaceName(coords);

  useLayoutEffect(() => {
    const reposition = () => {
      const el = ref.current;
      const stage = el?.offsetParent;
      const point = locate(coords.lat, coords.lng);
      if (!el || !stage || !point) return;
      const box = stage.getBoundingClientRect();
      const half = el.offsetWidth / 2;
      const x = Math.min(Math.max(point.x - box.left, EDGE_PX + half), Math.max(box.width - EDGE_PX - half, EDGE_PX + half));
      const y = point.y - box.top;
      // Near the top of the stage the card drops below the spot instead.
      el.classList.toggle("is-below", y < el.offsetHeight + MARKER_PX + EDGE_PX);
      el.classList.toggle("is-hidden", !point.visible);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };
    trackRef.current = reposition;
    reposition();
    return () => {
      if (trackRef.current === reposition) trackRef.current = null;
    };
  }, [coords, locate, trackRef]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  if (!trip) return null;
  // Mid-lookup, the local fallback (country / ocean) is still a usable name.
  const placeName = name ?? formatCoords(coords.lat, coords.lng);

  return (
    <div ref={ref} className="add-stop-popover" role="dialog" aria-labelledby="add-stop-popover-question">
      <div className="glass-panel add-stop-popover-card">
        <p id="add-stop-popover-question" className="add-stop-popover-question">
          <MapPinPlus size={16} aria-hidden="true" />
          Add stop here?
        </p>
        <p className="add-stop-popover-place" aria-live="polite" aria-busy={isResolving} title={placeName}>
          {isResolving ? <span className="pin-name-popover-skeleton">Finding place…</span> : placeName}
        </p>
        {trips.length > 1 ? (
          <Select value={trip.id} onChange={(e) => setTripId(e.target.value)} aria-label="Trip" className="add-stop-popover-trip">
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        ) : (
          <p className="add-stop-popover-trip-name">to {trip.title}</p>
        )}
        <div className="add-stop-popover-actions">
          <button type="button" className="add-stop-popover-cancel" onClick={onCancel}>
            Not now
          </button>
          <button type="button" className="add-stop-popover-confirm" onClick={() => onConfirm({ trip, placeName })} autoFocus>
            Add stop
          </button>
        </div>
      </div>
    </div>
  );
}
