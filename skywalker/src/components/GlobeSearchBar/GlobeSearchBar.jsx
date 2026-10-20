import { useMemo, useState } from "react";
import { useCountriesGeoJson } from "../../hooks/useCountriesGeoJson";
import { getFeatureCentroid } from "../../utils/geo";
import "./GlobeSearchBar.css";

const MAX_RESULTS = 8;

/**
 * Search bar scoped to the globe section. Visually matches TopNav's
 * glass-panel search styling, but — unlike TopNav's, which navigates to
 * /gallery — selecting a result here just flies the globe camera in place
 * via `onSelect(result)`; GlobeExplorer decides what filtering that implies.
 */
export default function GlobeSearchBar({ pins, customPins, blogs, onSelect }) {
  const countries = useCountriesGeoJson();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

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
      sublabel: pin.note || "Your pin",
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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index
      .filter((r) => r.label.toLowerCase().includes(q) || r.sublabel?.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [index, query]);

  const handleSelect = (result) => {
    onSelect(result);
    setQuery(result.label);
    setFocused(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (results[0]) handleSelect(results[0]);
  };

  const showDropdown = focused && query.trim().length > 0;

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
          placeholder="Search countries, places, notes, blog posts…"
          className="globe-search-input"
        />
      </form>

      {showDropdown && (
        <div className="glass-panel globe-search-results">
          {results.length === 0 ? (
            <div className="globe-search-empty">No matches</div>
          ) : (
            results.map((r) => (
              <button
                key={`${r.kind}-${r.code ?? r.id ?? r.blogId}`}
                type="button"
                className="globe-search-result"
                onMouseDown={() => handleSelect(r)}
              >
                <span className="globe-search-result-label">{r.label}</span>
                <span className="globe-search-result-kind">{r.kind === "blog" ? "Blog post" : r.sublabel}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
