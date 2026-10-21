import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { LoaderCircle, LocateFixed, MapPin, X } from "lucide-react";
import PhotoGlobe from "../../components/PhotoGlobe/PhotoGlobe";
import ErrorBoundary from "../../components/ErrorBoundary/ErrorBoundary";
import { usePlaceName } from "../../hooks/usePlaceName";
import { useGlobePrefs } from "../../lib/globePrefs";
import { CountryDropdown, GlobeModeToggle, GlobePlaceSearch } from "./GlobePickerControls";

const NO_PHOTOS = [];
const noop = () => {};

// Where the globe settles when GPS is denied or unavailable.
const FALLBACK_CENTER = { lat: 1.35, lng: 103.82 }; // Singapore
const INITIAL_VIEW = { ...FALLBACK_CENTER, altitude: 2.1 };
const FALLBACK_ALTITUDE = 1.4;
const LOCATED_ALTITUDE = 0.35;
const SEARCH_ALTITUDE = 0.35;
const GEOLOCATION_OPTIONS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 };

const MODE_HINTS = {
  explore: "Drag to spin · scroll or pinch to zoom",
  pin: "Tap the globe to drop the pin",
};

/**
 * Manual location pick for the editor. Two modes: Explore (spin and zoom,
 * clicks never drop a pin) and Pin (rotation locked, a tap drops or moves
 * the red pin). A place search and a country list fly the camera; with no
 * starting point, the globe asks for GPS on open and suggests that spot,
 * else settles on Singapore. Existing pins are shown so a story can be
 * dropped right onto one.
 *
 * @param {?{lat:number,lng:number}} initial
 * @param {function({lat:number,lng:number,placeName:?string}): void} onConfirm
 */
export default function GlobePickerModal({ initial, pins, onConfirm, onCancel }) {
  const { prefs } = useGlobePrefs();
  const [mode, setMode] = useState("explore");
  // { lat, lng, placeName?, suggested? } — placeName when search named it.
  const [point, setPoint] = useState(initial);
  const [flyTo, setFlyTo] = useState(initial);
  const [countryCode, setCountryCode] = useState(null);
  // "locating" | "found" | "fallback" | null (had a starting point)
  const [geoStatus, setGeoStatus] = useState(initial ? null : "locating");
  const place = usePlaceName(point);
  const placeName = point?.placeName ?? place.name;

  // Mount only: a post that already has coordinates keeps them in view.
  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    const fallback = () => {
      if (cancelled) return;
      setGeoStatus("fallback");
      setFlyTo({ ...FALLBACK_CENTER, altitude: FALLBACK_ALTITUDE });
    };
    if (!("geolocation" in navigator)) {
      fallback();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (cancelled) return;
        const here = { lat: coords.latitude, lng: coords.longitude };
        setGeoStatus("found");
        setFlyTo({ ...here, altitude: LOCATED_ALTITUDE });
        // Don't override a spot the user already picked while GPS was slow.
        setPoint((prev) => prev ?? { ...here, suggested: true });
      },
      fallback,
      GEOLOCATION_OPTIONS
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSelect = (result) => {
    const target = { lat: result.lat, lng: result.lng };
    setCountryCode(null);
    setPoint({ ...target, placeName: result.placeName });
    setFlyTo({ ...target, altitude: SEARCH_ALTITUDE });
  };

  const handleCountrySelect = (country) => {
    setCountryCode(country.code);
    setFlyTo({ lat: country.lat, lng: country.lng, altitude: country.altitude });
  };

  const isSuggested = point?.suggested;
  const status =
    geoStatus === "locating"
      ? { icon: <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />, text: "Finding your location…" }
      : isSuggested
      ? { icon: <LocateFixed size={14} aria-hidden="true" />, text: "Suggested: your current location" }
      : { icon: null, text: MODE_HINTS[mode] };

  return createPortal(
    <motion.div
      className="fixed inset-0 flex items-center justify-center bg-slate-900/55 p-2 sm:p-6"
      style={{ zIndex: "var(--z-modal)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        role="dialog"
        aria-label="Pick a location on the globe"
        className="glass-panel relative flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--bg-panel-strong)", color: "var(--text)" }}
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 px-4 py-3">
          <p className="min-w-0 flex-1 text-sm font-semibold">Where did this story happen?</p>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/10"
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="globe-picker-toolbar">
          <GlobePlaceSearch onSelect={handleSearchSelect} />
          <CountryDropdown value={countryCode} onSelect={handleCountrySelect} />
        </div>

        <div className="relative min-h-0 flex-1">
          <ErrorBoundary fallback={<p className="p-6 text-sm">The 3D globe couldn&rsquo;t load on this device.</p>}>
            <PhotoGlobe
              photos={NO_PHOTOS}
              customPins={pins}
              selectedCountryCode={countryCode}
              selectedLocationId={null}
              selectedCustomPinId={null}
              labelMode={prefs.labelMode}
              showBorders={prefs.showBorders}
              showGrid={prefs.showGrid}
              showAtmosphere={prefs.showAtmosphere}
              autoRotate={false}
              initialView={INITIAL_VIEW}
              isPlacingPin={mode === "pin"}
              lockRotation={mode === "pin"}
              panOnly={mode === "explore"}
              pendingPin={point}
              flyToTarget={flyTo}
              onViewportChange={noop}
              onCountryClick={noop}
              onCountryHover={noop}
              onPinClick={noop}
              onPinHover={noop}
              onCustomPinClick={noop}
              onPinDropAt={setPoint}
            />
          </ErrorBoundary>
          <GlobeModeToggle mode={mode} onChange={setMode} />
          <p className="globe-picker-status glass-panel" aria-live="polite">
            {status.icon}
            {status.text}
          </p>
        </div>

        <footer className="flex flex-col gap-2 border-t p-3 sm:flex-row sm:items-center" style={{ borderColor: "var(--glass-border)" }}>
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm" aria-live="polite">
            <MapPin className="red-pin-icon shrink-0" size={20} aria-hidden="true" />
            <span className="truncate">
              {!point
                ? geoStatus === "fallback"
                  ? "Couldn't get your location — search, pick a country, or switch to Pin"
                  : "No spot picked yet"
                : !point.placeName && place.isResolving
                ? "Finding the place…"
                : placeName}
            </span>
          </p>
          <button
            type="button"
            disabled={!point}
            onClick={() => onConfirm({ lat: point.lat, lng: point.lng, placeName })}
            className="h-10 rounded-full px-6 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
            style={{ background: "var(--pin-red)" }}
          >
            Use this spot
          </button>
        </footer>
      </motion.div>
    </motion.div>,
    document.body
  );
}
