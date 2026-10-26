import { useMemo, useState } from "react";
import { useCountriesGeoJson } from "../../hooks/useCountriesGeoJson";
import { countryCodeToFlagEmoji } from "../../lib/countries";
import "./CountrySelect.css";

const MAX_RESULTS = 8;

/**
 * Searchable country combobox for the Blog Editor's metadata section.
 * Sources its list from the same countries.geojson used by the globe
 * (via useCountriesGeoJson) instead of adding a country-list dependency.
 *
 * @param {{code: string, name: string} | null} value
 * @param {(next: {code: string, name: string} | null) => void} onChange
 */
export default function CountrySelect({ value, onChange, placeholder = "Search for a country…" }) {
  const features = useCountriesGeoJson();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const countries = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const feature of features) {
      const code = feature.properties?.ISO_A2;
      const name = feature.properties?.NAME;
      if (!code || !name || seen.has(code)) continue;
      seen.add(code);
      list.push({ code, name });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [features]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries.slice(0, MAX_RESULTS);
    return countries.filter((c) => c.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS);
  }, [countries, query]);

  const handleSelect = (country) => {
    onChange(country);
    setQuery("");
    setFocused(false);
  };

  const showDropdown = focused;

  return (
    <div className="country-select">
      <div className={`glass-panel country-select-input-row ${focused ? "is-focused" : ""}`}>
        {value ? (
          <button type="button" className="country-select-chip" onClick={() => onChange(null)}>
            <span className="country-select-flag">{countryCodeToFlagEmoji(value.code)}</span>
            {value.name}
            <span className="country-select-chip-remove" aria-hidden>
              ✕
            </span>
          </button>
        ) : (
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            placeholder={placeholder}
            className="country-select-input"
          />
        )}
      </div>

      {!value && showDropdown && (
        <div className="glass-panel country-select-results">
          {results.length === 0 ? (
            <div className="country-select-empty">No matches</div>
          ) : (
            results.map((c) => (
              <button
                key={c.code}
                type="button"
                className="country-select-result"
                onMouseDown={() => handleSelect(c)}
              >
                <span className="country-select-flag">{countryCodeToFlagEmoji(c.code)}</span>
                {c.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
