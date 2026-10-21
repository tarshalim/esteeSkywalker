import { useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, Crosshair, Hand, LoaderCircle, Search, X } from "lucide-react";
import { useCountriesGeoJson } from "../../hooks/useCountriesGeoJson";
import { searchPlaces } from "../../lib/geocode";
import { countryCodeToFlagEmoji, SMALL_COUNTRY_CENTERS } from "../../utils/countries";
import { featureView } from "../../utils/geo";
import "./GlobePicker.css";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;
// Close enough to read a small country's coastline.
const SMALL_COUNTRY_ALTITUDE = 0.3;
// Natural Earth leaves both codes as "-99" for a few features.
const CODE_BY_NAME = { Norway: "NO" };

const validCode = (code) => (/^[A-Z]{2}$/.test(code ?? "") ? code : null);

let regionNames = null;
try {
  regionNames = new Intl.DisplayNames(["en"], { type: "region" });
} catch {
  // Older browsers: keep the geojson's own (abbreviated) names.
}

/**
 * Every country with a camera view to fly to, A–Z: the geojson's polygons
 * plus the microstates it has no feature for.
 * @returns {{code:string,name:string,lat:number,lng:number,altitude:number}[]}
 */
function useCountryOptions() {
  const features = useCountriesGeoJson();
  return useMemo(() => {
    const byCode = new Map();
    for (const feature of features) {
      const p = feature.properties ?? {};
      const code = validCode(p.ISO_A2) ?? validCode(p.WB_A2) ?? CODE_BY_NAME[p.NAME];
      const view = code && !byCode.has(code) && featureView(feature);
      if (view) byCode.set(code, { code, name: regionNames?.of(code) ?? p.NAME, ...view });
    }
    for (const [code, [name, lat, lng]] of Object.entries(SMALL_COUNTRY_CENTERS)) {
      if (!byCode.has(code)) byCode.set(code, { code, name, lat, lng, altitude: SMALL_COUNTRY_ALTITUDE });
    }
    return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [features]);
}

/**
 * Explore (drag/zoom, clicks do nothing) vs Pin (rotation locked, a tap
 * drops the pin).
 * @param {"explore"|"pin"} mode
 */
export function GlobeModeToggle({ mode, onChange }) {
  const options = [
    { value: "explore", label: "Explore", hint: "Drag to spin, scroll or pinch to zoom", Icon: Hand },
    { value: "pin", label: "Pin", hint: "Tap the globe to drop the pin", Icon: Crosshair },
  ];
  return (
    <div className="globe-mode-toggle glass-panel" role="radiogroup" aria-label="Globe interaction mode">
      <span className={`globe-mode-thumb${mode === "pin" ? " is-pin" : ""}`} aria-hidden="true" />
      {options.map(({ value, label, hint, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          title={hint}
          className={`globe-mode-option${mode === value ? " is-active" : ""}`}
          onClick={() => onChange(value)}
        >
          <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Native select of every country — long lists, type-to-jump and screen
 * readers all work out of the box. Picking one hands its camera view up.
 * @param {function({code:string,name:string,lat:number,lng:number,altitude:number}): void} onSelect
 */
export function CountryDropdown({ value, onSelect }) {
  const countries = useCountryOptions();
  return (
    <label className="globe-country-select glass-panel">
      <span className="sr-only">Jump to a country</span>
      <select
        value={value ?? ""}
        disabled={countries.length === 0}
        onChange={(e) => {
          const country = countries.find((c) => c.code === e.target.value);
          if (country) onSelect(country);
        }}
      >
        <option value="" disabled>
          {countries.length ? "Jump to a country…" : "Loading countries…"}
        </option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {countryCodeToFlagEmoji(c.code)} {c.name}
          </option>
        ))}
      </select>
      <ChevronDown size={16} aria-hidden="true" />
    </label>
  );
}

/**
 * City/region search (Photon geocoder) with keyboard navigation.
 * @param {function({lat:number,lng:number,label:string,placeName:string}): void} onSelect
 */
export function GlobePlaceSearch({ onSelect }) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ query: "", items: [] });
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = query.trim();
  useEffect(() => {
    if (trimmed.length < SEARCH_MIN_CHARS) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      searchPlaces(trimmed, { signal: controller.signal }).then(
        (items) => {
          setResults({ query: trimmed, items });
          setActiveIndex(items.length ? 0 : -1);
        },
        () => {} // superseded by a newer keystroke
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmed]);

  const isCurrent = results.query === trimmed && trimmed.length >= SEARCH_MIN_CHARS;
  const items = isCurrent ? results.items : [];
  const isSearching = trimmed.length >= SEARCH_MIN_CHARS && !isCurrent;
  const showList = isOpen && (items.length > 0 || isCurrent);

  const pick = (place) => {
    setQuery(place.label);
    setIsOpen(false);
    onSelect(place);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      if (isOpen) e.stopPropagation();
      setIsOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length) return;
      e.preventDefault();
      setIsOpen(true);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (i + delta + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const place = items[activeIndex] ?? items[0];
      if (place) pick(place);
    }
  };

  return (
    <div className="globe-place-search">
      <div className="globe-place-search-box glass-panel">
        {isSearching ? (
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          <Search size={16} aria-hidden="true" />
        )}
        <input
          type="search"
          role="combobox"
          aria-label="Search a city or region"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          placeholder="Search a city or region"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            type="button"
            className="globe-place-search-clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {showList && (
        <ul id={listId} role="listbox" className="globe-place-search-results glass-panel">
          {items.length === 0 ? (
            <li className="globe-place-search-empty">No places found</li>
          ) : (
            items.map((place, i) => (
              <li key={`${place.lat}:${place.lng}`} id={`${listId}-${i}`} role="option" aria-selected={i === activeIndex}>
                {/* mousedown, not click: the input's blur would unmount the list first. */}
                <button
                  type="button"
                  tabIndex={-1}
                  className={i === activeIndex ? "is-active" : ""}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => pick(place)}
                >
                  <strong>{place.label}</strong>
                  {place.sublabel && <small>{place.sublabel}</small>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
