import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin } from "lucide-react";
import { usePlaceName } from "../../hooks/usePlaceName";
import { formatCoords } from "../../utils/geo";
import "./PinDropButton.css";

// Movement (px) before a press counts as a drag rather than a tap.
const DRAG_THRESHOLD = 6;
const HINT_SEEN_KEY = "skywalker-pin-hint-seen";
const HINT_INTRO_MS = 4000;

function hasSeenHint() {
  try {
    return window.localStorage.getItem(HINT_SEEN_KEY) === "true";
  } catch {
    return true;
  }
}

/**
 * Floating red pin on the globe stage. Drag it onto the globe to drop an
 * annotation there — a HUD beside the dragged pin names the place under it
 * live — or tap it to enter click mode (also the keyboard path). Pointer
 * events rather than HTML5 drag-and-drop, so the same drag works with touch,
 * pen and mouse.
 *
 * @param {function(number, number, ?string): boolean} onDropAt - client x/y
 *   of the release plus the place name shown in the HUD; returns whether it
 *   landed on the globe (false snaps back).
 * @param {function(number, number): ?{lat:number,lng:number}} coordsAt - the
 *   globe coordinate under a client point, or null when off the globe.
 */
export default function PinDropButton({ isPlacingPin, onTogglePlacingPin, onDropAt, coordsAt }) {
  const [drag, setDrag] = useState(null); // { x, y, coords } while dragging
  const [isSnappingBack, setIsSnappingBack] = useState(false);
  // First visit: show the tooltip briefly so the affordance is discoverable.
  const [showIntroHint, setShowIntroHint] = useState(() => !hasSeenHint());
  const pressRef = useRef(null); // { id, x, y, dragging }
  const suppressClickRef = useRef(false);
  const { name: placeName, isResolving } = usePlaceName(drag?.coords ?? null);
  // Read at release time, so the drop hands over exactly what the HUD showed —
  // unless that was still the interim fallback, in which case the pin dialog
  // finishes the lookup itself rather than settling for "Japan".
  const placeNameRef = useRef(placeName);
  placeNameRef.current = isResolving ? null : placeName;

  useEffect(() => {
    if (!showIntroHint) return;
    const timeout = setTimeout(() => setShowIntroHint(false), HINT_INTRO_MS);
    try {
      window.localStorage.setItem(HINT_SEEN_KEY, "true");
    } catch {
      // Storage blocked — the intro hint just shows again next visit.
    }
    return () => clearTimeout(timeout);
  }, [showIntroHint]);

  useEffect(() => {
    if (!isSnappingBack) return;
    const timeout = setTimeout(() => setIsSnappingBack(false), 450);
    return () => clearTimeout(timeout);
  }, [isSnappingBack]);

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    suppressClickRef.current = false;
    pressRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
    // Keeps move/up events coming here even over the globe canvas, which
    // also stops OrbitControls from rotating under the drag.
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    const press = pressRef.current;
    if (!press || press.id !== e.pointerId) return;
    if (!press.dragging && Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_THRESHOLD) return;
    press.dragging = true;
    setShowIntroHint(false);
    setDrag({ x: e.clientX, y: e.clientY, coords: coordsAt(e.clientX, e.clientY) });
  };

  const endPress = (e, cancelled) => {
    const press = pressRef.current;
    if (!press || press.id !== e.pointerId) return;
    pressRef.current = null;
    if (!press.dragging) return; // a tap — onClick handles it
    suppressClickRef.current = true;
    setDrag(null);
    const landed = !cancelled && onDropAt(e.clientX, e.clientY, placeNameRef.current);
    if (!landed) setIsSnappingBack(true);
  };

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onTogglePlacingPin();
  };

  // Secondary line under the place name; skipped when the name already fell
  // back to raw coordinates (open ocean) so they don't show twice.
  const hudCoords = drag?.coords ? formatCoords(drag.coords.lat, drag.coords.lng) : null;
  const hint = isPlacingPin ? "Click mode on — tap the globe…" : "Drag me onto the globe!";

  return (
    <div
      className={`pin-drop${isPlacingPin ? " is-placing" : ""}${drag ? " is-dragging" : ""}${
        showIntroHint ? " show-hint" : ""
      }`}
      data-tour="annotate"
    >
      <button
        type="button"
        className={`pin-drop-button${isSnappingBack ? " is-snapping-back" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => endPress(e, false)}
        onPointerCancel={(e) => endPress(e, true)}
        onClick={handleClick}
        onKeyDown={(e) => e.key === "Escape" && isPlacingPin && onTogglePlacingPin()}
        aria-pressed={isPlacingPin}
        aria-label={isPlacingPin ? "Cancel dropping a pin" : "Drop a pin: drag onto the globe, or press to tap a spot"}
      >
        <span className="pin-drop-pulse" aria-hidden="true" />
        <MapPin className="pin-drop-icon red-pin-icon" size={20} strokeWidth={2} aria-hidden="true" />
      </button>
      <span className="pin-drop-hint" role="status">
        {hint}
      </span>

      {drag &&
        createPortal(
          <div
            className={`pin-drop-ghost${drag.coords ? " is-over-globe" : ""}`}
            style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}
          >
            <MapPin className="red-pin-icon" size={36} strokeWidth={2} aria-hidden="true" />
            <span className="pin-drop-ghost-shadow" aria-hidden="true" />
            <span className={`pin-drop-hud${isResolving ? " is-resolving" : ""}`} role="status" aria-live="polite">
              <span className="pin-drop-hud-text">
                <strong className="pin-drop-hud-name">{drag.coords ? placeName : "Drop me on the globe"}</strong>
                {hudCoords && hudCoords !== placeName && <span className="pin-drop-hud-coords">{hudCoords}</span>}
              </span>
            </span>
          </div>,
          document.body
        )}
    </div>
  );
}
