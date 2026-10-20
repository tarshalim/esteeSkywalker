import { useEffect, useState } from "react";
import { LoaderCircle, LocateFixed, MousePointerClick } from "lucide-react";
import "./PinModeControls.css";

const MESSAGE_MS = 4000;

const GEOLOCATION_ERRORS = {
  1: "Location permission was denied.",
  2: "Couldn't determine your location.",
  3: "Finding your location timed out.",
};

/**
 * Precision-friendly alternatives to dragging the pin: a "Click mode" toggle
 * (the next tap on the globe anchors the pin) and "Use my location" (browser
 * Geolocation API). Sits under PinDropButton in GlobeExplorer's dock.
 *
 * @param {function(): boolean} canPlace - false when the viewer can't drop
 *   pins (the parent redirects to sign-in before returning).
 * @param {function({lat:number,lng:number})} onLocated
 */
export default function PinModeControls({ isClickMode, onToggleClickMode, canPlace, onLocated }) {
  const [isLocating, setIsLocating] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(timeout);
  }, [message]);

  const handleLocate = () => {
    if (isLocating || !canPlace()) return;
    if (!("geolocation" in navigator)) {
      setMessage("This browser can't share your location.");
      return;
    }
    setIsLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setIsLocating(false);
        onLocated({ lat: coords.latitude, lng: coords.longitude });
      },
      (err) => {
        setIsLocating(false);
        setMessage(GEOLOCATION_ERRORS[err.code] ?? "Couldn't determine your location.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  return (
    <div className="pin-mode-controls">
      <button
        type="button"
        className={`pin-mode-button${isClickMode ? " is-active" : ""}`}
        onClick={onToggleClickMode}
        aria-pressed={isClickMode}
        data-label={isClickMode ? "Click mode on" : "Click mode"}
        aria-label="Click mode: tap anywhere on the globe to drop the pin"
      >
        <MousePointerClick size={20} strokeWidth={2.25} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="pin-mode-button"
        onClick={handleLocate}
        disabled={isLocating}
        data-label={isLocating ? "Locating…" : "Use my location"}
        aria-label="Drop the pin at my current location"
      >
        {isLocating ? (
          <LoaderCircle className="pin-mode-spin" size={20} strokeWidth={2.25} aria-hidden="true" />
        ) : (
          <LocateFixed size={20} strokeWidth={2.25} aria-hidden="true" />
        )}
      </button>
      <span className="pin-mode-message" role="status" aria-live="polite">
        {message}
      </span>
    </div>
  );
}
