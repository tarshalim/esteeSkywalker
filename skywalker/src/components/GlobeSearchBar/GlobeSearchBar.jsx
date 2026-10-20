import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { useCountriesGeoJson } from "../../hooks/useCountriesGeoJson";
import { searchPlaces } from "../../lib/geocode";
import { getFeatureCentroid } from "../../utils/geo";
import "./GlobeSearchBar.css";

const MAX_RESULTS = 8;
// Places come from a network geocoder, so wait for a typing pause.
const PLACE_SEARCH_DEBOUNCE_MS = 300;
const PLACE_SEARCH_MIN_CHARS = 2;

/**
 * Search bar scoped to the globe section. Visually matches TopNav's
 * glass-panel search styling, but — unlike TopNav's, which navigates to
 * /gallery — selecting a result here just flies the globe camera in place
 * via `onSelect(result)`; GlobeExplorer decides what filtering that implies.
 *
 * Below the local matches (countries, photo pins, notes, posts) it lists
 * world places from the geocoder ("Santorini"); picking one of those
 * (`kind: "place"`) flies there and drops the red pin.
 */
export default function GlobeSearchBar({ pins, customPins, blogs, onSelect }) {
  const countries = useCountriesGeoJson();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [places, setPlaces] = useState({ query: "", results: [] });

  const index = useMemo(() => {
    const countryResults = countries
      .map((feature) => {
        const centroid = getFeatureCentroid(feature);
        if (!centroid) return null;
        return {
          kind: "country",
          label: feature.properties.NAME,
          sublabel: "Country",
          code: feature.properties.ISO_A2,
          ...centroid,
        };
      })
      .filter(Boolean);

    const pinResults = pins.map((pin) => ({
      kind: "pin",
      label: pin.locationName,
      sublabel: `${pin.photos.length} photo${pin.photos.length === 1 ? "" : "s"}`,
      id: pin.id,
      lat: pin.lat,
      lng: pin.lng,
    }));

    const customPinResults = customPins.map((pin) => ({
      kind: "customPin",
      label: pin.title,
      sublabel: pin.placeName || pin.note || "Your pin",
      id: pin.id,
      lat: pin.lat,
      lng: pin.lng,
    }));

    const blogResults = blogs.map((blog) => ({
      kind: "blog",
      label: blog.title,
      sublabel: blog.location.name,
      blogId: blog.id,
      lat: blog.location.lat,
      lng: blog.location.lng,
    }));

    return [...blogResults, ...pinResults, ...customPinResults, ...countryResults];
  }, [countries, pins, customPins, blogs]);

  const trimmed = query.trim();

  const localResults = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return [];
    return index
      .filter((r) => r.label.toLowerCase().includes(q) || r.sublabel?.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [index, trimmed]);

  useEffect(() => {
    if (trimmed.length < PLACE_SEARCH_MIN_CHARS) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      searchPlaces(trimmed, { signal: controller.signal }).then(
        (results) => setPlaces({ query: trimmed, results }),
        () => {} // aborted by newer keystrokes
      );
    }, PLACE_SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmed]);

  const placeResults = useMemo(
    () =>
      places.query === trimmed
        ? places.results.map((p, i) => ({ ...p, kind: "place", id: `${i}-${p.lat}-${p.lng}` }))
        : [],
    [places, trimmed]
  );

  const results = useMemo(() => [...localResults, ...placeResults], [localResults, placeResults]);

  const handleSelect = (result) => {
    onSelect(result);
    setQuery(result.label);
    setFocused(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (results[0]) handleSelect(results[0]);
  };

  const showDropdown = focused && trimmed.length > 0;
  const isPending = trimmed.length >= PLACE_SEARCH_MIN_CHARS && places.query !== trimmed;

  const renderResult = (r) => (
    <button
      key={`${r.kind}-${r.code ?? r.id ?? r.blogId}`}
      type="button"
      className={`globe-search-result${r.kind === "place" ? " globe-search-result--place" : ""}`}
      onMouseDown={() => handleSelect(r)}
    >
      {r.kind === "place" && <MapPin className="red-pin-icon" size={16} strokeWidth={2} aria-hidden="true" />}
      <span className="globe-search-result-text">
        <span className="globe-search-result-label">{r.label}</span>
        <span className="globe-search-result-kind">
          {r.kind === "blog" ? "Blog post" : r.kind === "place" ? r.sublabel || "Place" : r.sublabel}
        </span>
      </span>
    </button>
  );

  return (
    <div className="globe-search-bar">
      <form
        onSubmit={handleSubmit}
        className={`glass-panel globe-search-form ${focused ? "is-focused" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="globe-search-icon" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder="Search a place to pin, or your posts…"
          aria-label="Search places, countries and posts"
          className="globe-search-input"
        />
      </form>

      {showDropdown && (
        <div className="glass-panel globe-search-results">
          {localResults.map(renderResult)}
          {placeResults.length > 0 && (
            <>
              <div className="globe-search-section">Drop a pin at…</div>
              {placeResults.map(renderResult)}
            </>
          )}
          {results.length === 0 && (
            <div className="globe-search-empty">{isPending ? "Searching places…" : "No matches"}</div>
          )}
        </div>
      )}
    </div>
  );
}
