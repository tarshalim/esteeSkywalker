import { useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Globe2, LoaderCircle, LocateFixed, MapPin, Search, X } from "lucide-react";
import { reverseGeocode, searchPlaces } from "../../lib/geocode";
import { autoPinFor, distanceKm, pinsNear } from "../../lib/pinStore";
import { formatCoords } from "../../utils/geo";
import Select from "../../components/Select/Select";
import GlobePickerModal from "./GlobePickerModal";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;

const GEOLOCATION_ERRORS = {
  1: "Location permission was denied.",
  2: "Couldn't determine your location.",
  3: "Finding your location timed out.",
};

/**
 * How a post is filed on the globe: "auto" (pinStore.autoPinFor), an
 * existing pin's id, "new", or "none".
 * @typedef {"auto"|"new"|"none"|string} PinChoice
 */

/**
 * The post's waypoint: a name the reader sees, plus — once picked by place
 * search, "Current location" or the globe — exact coordinates, which file the
 * post under a globe pin (an existing one nearby, or a new one on save).
 *
 * @param {string} name
 * @param {?{lat:number,lng:number}} coords
 * @param {function({lat:number,lng:number,placeName:?string}|null): void} onPick
 * @param {import("../../lib/pinStore").Pin[]} pins
 * @param {PinChoice} pinChoice
 */
export default function LocationField({ name, onNameChange, coords, onPick, pins, pinChoice, onPinChoiceChange, onError }) {
  const listId = useId();
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState({ query: "", items: [] });
  const [isLocating, setIsLocating] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const query = name.trim();
  useEffect(() => {
    if (!isFocused || query.length < SEARCH_MIN_CHARS) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      searchPlaces(query, { signal: controller.signal }).then(
        (items) => setResults({ query, items }),
        () => {} // superseded by a newer keystroke
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, isFocused]);

  const suggestions = isFocused && results.query === query ? results.items : [];

  const pick = (place) => {
    setIsFocused(false);
    onPick(place);
  };

  const handleLocate = () => {
    if (!("geolocation" in navigator)) return onError("This browser can't share your location.");
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: c }) => {
        const point = { lat: c.latitude, lng: c.longitude };
        const placeName = await reverseGeocode(point.lat, point.lng).catch(() => null);
        setIsLocating(false);
        pick({ ...point, placeName });
      },
      (err) => {
        setIsLocating(false);
        onError(GEOLOCATION_ERRORS[err.code] ?? "Couldn't determine your location.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  // Pins close enough to share, plus whichever pin the post is already on
  // (it may sit further away — e.g. a whole-city hub).
  const pinOptions = useMemo(() => {
    const near = pinsNear(pins, coords);
    const current = pins.find((p) => p.id === pinChoice);
    if (current && !near.some((p) => p.id === current.id)) near.push({ ...current, distanceKm: distanceKm(current, coords) });
    return near;
  }, [pins, coords, pinChoice]);

  const selectValue = pinChoice === "auto" ? autoPinFor(pins, coords) : pinChoice;

  return (
    <div className="editor-location-field">
      <div className="editor-location" role="combobox" aria-expanded={suggestions.length > 0} aria-controls={listId} aria-haspopup="listbox">
        📍
        <input
          placeholder="Search a place or name the waypoint (e.g. Gion, Kyoto)"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => e.key === "Escape" && setIsFocused(false)}
          aria-autocomplete="list"
          aria-label="Location"
        />
        {suggestions.length > 0 && (
          <ul id={listId} role="listbox" className="editor-location-results glass-panel">
            {suggestions.map((place) => (
              <li key={`${place.lat}:${place.lng}`} role="option" aria-selected="false">
                {/* mousedown, not click: the input's blur would unmount the list first. */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(place)}>
                  <Search size={14} aria-hidden="true" />
                  <span>
                    <strong>{place.label}</strong>
                    {place.sublabel && <small>{place.sublabel}</small>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="editor-location-actions">
        <button type="button" className="editor-location-chip" onClick={handleLocate} disabled={isLocating}>
          {isLocating ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <LocateFixed size={14} aria-hidden="true" />}
          {isLocating ? "Locating…" : "Current location"}
        </button>
        <button type="button" className="editor-location-chip" onClick={() => setIsPickerOpen(true)}>
          <Globe2 size={14} aria-hidden="true" />
          Pick on globe
        </button>

        {coords && (
          <>
            <span className="editor-location-coords">
              <MapPin size={14} aria-hidden="true" />
              {formatCoords(coords.lat, coords.lng)}
              <button type="button" onClick={() => onPick(null)} aria-label="Clear exact location" title="Clear exact location">
                <X size={13} aria-hidden="true" />
              </button>
            </span>
            <label className="editor-location-pin">
              <span>Globe pin</span>
              <Select variant="pill" value={selectValue} onChange={(e) => onPinChoiceChange(e.target.value)}>
                {pinOptions.map((pin) => (
                  <option key={pin.id} value={pin.id}>
                    Add to “{pin.title}” · {pin.distanceKm < 1 ? "here" : `${Math.round(pin.distanceKm)} km`}
                  </option>
                ))}
                <option value="new">New pin at this spot</option>
                <option value="none">Don&rsquo;t pin on the globe</option>
              </Select>
            </label>
          </>
        )}
      </div>

      <AnimatePresence>
        {isPickerOpen && (
          <GlobePickerModal
            initial={coords}
            pins={pins}
            onConfirm={(place) => {
              setIsPickerOpen(false);
              onPick(place);
            }}
            onCancel={() => setIsPickerOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
