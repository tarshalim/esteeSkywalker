import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, MapPinned, Plus, Search, Trash2 } from "lucide-react";
import { searchPlaces } from "../../lib/geocode";
import { blankStop, stopHasCoords } from "../../lib/hierarchy";
import { useCountriesGeoJson } from "../../hooks/useCountriesGeoJson";
import { CONTINENTS, COUNTRY_TO_CONTINENT, SMALL_COUNTRY_CENTERS, countryCodeToFlagEmoji } from "../../lib/countries";
import { continentForCountryCode, findCountryForPoint, formatCoords } from "../../lib/geo";
import Select from "../Select/Select";
import { FIELD_INPUT, FIELD_LABEL, fieldInputStyle, fieldLabelStyle as labelStyle } from "./fieldStyles";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;

/** Every country A–Z: the geojson's polygons plus the microstates it lacks. */
function useCountryOptions(features) {
  return useMemo(() => {
    const byCode = new Map();
    for (const f of features) {
      const { ISO_A2: code, NAME: name } = f.properties ?? {};
      if (code && code !== "-99" && name && !byCode.has(code)) byCode.set(code, name);
    }
    for (const [code, [name]] of Object.entries(SMALL_COUNTRY_CENTERS)) if (!byCode.has(code)) byCode.set(code, name);
    return [...byCode].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [features]);
}

/** A country's continent tag; "" for the geojson's "Seven seas (open ocean)". */
function continentOf(code, features) {
  const continent = continentForCountryCode(code, features, COUNTRY_TO_CONTINENT);
  return CONTINENTS.includes(continent) ? continent : "";
}

/** A row's coordinates as numbers, or null while either is blank or off the globe. */
function rowCoords(row) {
  if (row.lat == null || row.lat === "" || row.lng == null || row.lng === "") return null;
  const point = { lat: Number(row.lat), lng: Number(row.lng) };
  return stopHasCoords(point) ? point : null;
}

/** Country + continent tags for a coordinate, or {} when it's open water. */
function tagsForPoint(lat, lng, features) {
  const found = features.length ? findCountryForPoint(lat, lng, features) : null;
  if (!found?.code) return {};
  return { countryCode: found.code, country: found.name, continent: continentOf(found.code, features) };
}

/**
 * The stop's place name, doubling as a place search: picking a result fills
 * in its coordinates (and, through `onPick`, its country and continent).
 */
function StopPlaceInput({ value, onChange, onPick, label, autoFocus = false }) {
  const listId = useId();
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState({ query: "", items: [] });

  const query = value.trim();
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

  return (
    <div className="relative" role="combobox" aria-expanded={suggestions.length > 0} aria-controls={listId} aria-haspopup="listbox">
      <input
        className={FIELD_INPUT}
        style={fieldInputStyle}
        placeholder="Search a city or region, e.g. Cusco"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={(e) => e.key === "Escape" && setIsFocused(false)}
        aria-autocomplete="list"
        aria-label={label}
        autoFocus={autoFocus}
      />
      {suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="glass-panel absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-(--radius-field) p-1 shadow-lg"
          style={{ background: "var(--bg-panel-strong)" }}
        >
          {suggestions.map((place) => (
            <li key={`${place.lat}:${place.lng}`} role="option" aria-selected="false">
              {/* mousedown, not click: the input's blur would unmount the list first. */}
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-[calc(var(--radius-field)-0.25rem)] px-2 py-1.5 text-left text-sm hover:bg-black/5"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setIsFocused(false);
                  onPick(place);
                }}
              >
                <Search size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <strong className="block truncate">{place.label}</strong>
                  {place.sublabel && (
                    <small className="block truncate" style={labelStyle}>
                      {place.sublabel}
                    </small>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The trip's itinerary: one row per stop (a city, region or country), each
 * with its own dates inside the trip, country/continent tags and coordinates.
 * Rows are listed in journey order; the up/down buttons set the order of
 * stops that start the same day (tripStore re-sorts by date on save).
 * Coordinates stay text while typing; tripStore turns them into numbers.
 *
 * `compact` (the new-trip wizard, the boarding pass's "Add stop") shows just
 * the place search and dates: picking a place fills in the rest.
 * `startWithNewStop` appends a blank row on mount and focuses it — or, with
 * `newStop` (a spot clicked on the globe), a row already placed there.
 *
 * @param {{
 *   value: import("../../types/hierarchy").TripStop[],
 *   onChange: (next: import("../../types/hierarchy").TripStop[]) => void,
 *   tripStart: string,
 *   tripEnd: string,
 *   seed?: ?{ title: string, lat: number, lng: number },  // the trip's home pin, for the first stop
 *   compact?: boolean,
 *   startWithNewStop?: boolean,
 *   newStop?: ?{ lat: number, lng: number, locationName?: string },
 * }} props
 */
export default function TripStopsEditor({
  value,
  onChange,
  tripStart,
  tripEnd,
  seed = null,
  compact = false,
  startWithNewStop = false,
  newStop = null,
}) {
  const features = useCountriesGeoJson();
  const countryOptions = useCountryOptions(features);
  // The row "Add stop" just made, whose place search takes focus.
  const [addedId, setAddedId] = useState(null);

  const update = (id, patch) => onChange(value.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const remove = (id) => onChange(value.filter((row) => row.id !== id));
  const move = (index, delta) => {
    const next = [...value];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };

  const seedsFirstStop = value.length === 0 && seed && stopHasCoords(seed);

  // The first stop starts where the trip's pin is.
  const seedRow = () => {
    const row = blankStop(value, tripStart, tripEnd);
    // Before the country polygons load, the pin's own country tag stands in.
    const pinTags = seed.countryCode
      ? { countryCode: seed.countryCode, country: seed.countryName || seed.countryCode, continent: continentOf(seed.countryCode, features) }
      : {};
    return Object.assign(row, { locationName: seed.title, lat: seed.lat, lng: seed.lng }, pinTags, tagsForPoint(seed.lat, seed.lng, features));
  };

  const add = () => {
    if (seedsFirstStop) return onChange([seedRow()]);
    const row = blankStop(value, tripStart, tripEnd);
    setAddedId(row.id);
    onChange([...value, row]);
  };

  // A spot picked on the globe, after the pin's own stop on a trip that has none yet.
  const addPlaced = ({ lat, lng, locationName = "" }) => {
    const before = seedsFirstStop ? [seedRow()] : value;
    const row = Object.assign(blankStop(before, tripStart, tripEnd), { locationName, lat, lng }, tagsForPoint(lat, lng, features));
    onChange([...before, row]);
  };

  // Once per mount (the ref outlives StrictMode's effect replay).
  const startedRef = useRef(false);
  useEffect(() => {
    if (!startWithNewStop || startedRef.current) return;
    startedRef.current = true;
    if (newStop && stopHasCoords(newStop)) addPlaced(newStop);
    else add();
  });

  const pickPlace = (id, place) =>
    update(id, { locationName: place.label, lat: place.lat, lng: place.lng, ...tagsForPoint(place.lat, place.lng, features) });

  const pickCountry = (id, code) => {
    const country = countryOptions.find((c) => c.code === code);
    update(id, country ? { countryCode: code, country: country.name, continent: continentOf(code, features) } : { countryCode: "", country: "" });
  };

  // Typing coordinates by hand tags the country once both are valid, unless one is set already.
  const setCoord = (row, key, text) => {
    const point = rowCoords({ ...row, [key]: text });
    update(row.id, { [key]: text, ...(point && !row.countryCode ? tagsForPoint(point.lat, point.lng, features) : {}) });
  };

  return (
    <fieldset className="@container flex flex-col gap-2">
      <legend className="mb-1 flex items-center gap-1.5 text-xs font-semibold" style={labelStyle}>
        <MapPinned size={14} aria-hidden="true" />
        Itinerary
      </legend>
      {value.length === 0 && (
        <p className="text-xs" style={labelStyle}>
          One place so far. Add stops for each city, region or country along the way. They&rsquo;re joined into a route on the globe.
        </p>
      )}
      {value.map((row, i) => {
        const n = i + 1;
        const placed = rowCoords(row);
        return (
          <div key={row.id} className="flex flex-col gap-2 rounded-xl border p-2" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-1">
              <span
                className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white"
                style={{ background: "var(--blue)" }}
                aria-hidden="true"
              >
                {n}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold" style={labelStyle}>
                {row.countryCode && `${countryCodeToFlagEmoji(row.countryCode)} `}
                {placed
                  ? (compact && row.country) || formatCoords(placed.lat, placed.lng)
                  : compact
                    ? "Pick a suggestion to pin it on the globe"
                    : "Not on the globe yet"}
              </span>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-30"
                aria-label={`Move stop ${n} earlier`}
                title="Move earlier"
              >
                <ArrowUp size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === value.length - 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-30"
                aria-label={`Move stop ${n} later`}
                title="Move later"
              >
                <ArrowDown size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => remove(row.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-red-500/10 hover:text-red-600"
                aria-label={`Remove stop ${n}`}
                title="Remove"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>

            <StopPlaceInput
              value={row.locationName}
              onChange={(locationName) => update(row.id, { locationName })}
              onPick={(place) => pickPlace(row.id, place)}
              label={`Stop ${n} place`}
              autoFocus={row.id === addedId}
            />

            {compact ? (
              <div className="grid grid-cols-2 gap-2">
                <StopDateInputs row={row} tripStart={tripStart} tripEnd={tripEnd} update={update} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
                <label className={FIELD_LABEL} style={labelStyle}>
                  Country
                  <Select value={row.countryCode} onChange={(e) => pickCountry(row.id, e.target.value)}>
                    <option value="">—</option>
                    {/* A stop saved with a country this list lacks keeps it selectable. */}
                    {row.countryCode && !countryOptions.some((c) => c.code === row.countryCode) && (
                      <option value={row.countryCode}>{row.country || row.countryCode}</option>
                    )}
                    {countryOptions.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className={FIELD_LABEL} style={labelStyle}>
                  Continent
                  <Select value={row.continent} onChange={(e) => update(row.id, { continent: e.target.value })}>
                    <option value="">—</option>
                    {CONTINENTS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </label>
                <StopDateInputs row={row} tripStart={tripStart} tripEnd={tripEnd} update={update} />
                <label className={FIELD_LABEL} style={labelStyle}>
                  Latitude
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={-90}
                    max={90}
                    className={FIELD_INPUT}
                    style={fieldInputStyle}
                    placeholder="−13.53"
                    value={row.lat ?? ""}
                    onChange={(e) => setCoord(row, "lat", e.target.value)}
                  />
                </label>
                <label className={FIELD_LABEL} style={labelStyle}>
                  Longitude
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={-180}
                    max={180}
                    className={FIELD_INPUT}
                    style={fieldInputStyle}
                    placeholder="−71.97"
                    value={row.lng ?? ""}
                    onChange={(e) => setCoord(row, "lng", e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        disabled={!tripStart || !tripEnd}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border-2 px-3 text-xs font-bold disabled:opacity-40"
        style={{ borderColor: "var(--border-strong, var(--border))", color: "var(--text-strong, var(--text))" }}
      >
        <Plus size={14} aria-hidden="true" />
        {value.length > 0 ? "Add another stop" : "Add stop"}
      </button>
    </fieldset>
  );
}

/** A stop's From / To pickers, held inside the trip's dates. */
function StopDateInputs({ row, tripStart, tripEnd, update }) {
  return (
    <>
      <label className={FIELD_LABEL} style={labelStyle}>
        From
        <input
          type="date"
          className={FIELD_INPUT}
          style={fieldInputStyle}
          min={tripStart}
          max={row.endDate || tripEnd}
          value={row.startDate}
          onChange={(e) => {
            const startDate = e.target.value;
            update(row.id, { startDate, ...(row.endDate && row.endDate < startDate && { endDate: startDate }) });
          }}
        />
      </label>
      <label className={FIELD_LABEL} style={labelStyle}>
        To
        <input
          type="date"
          className={FIELD_INPUT}
          style={fieldInputStyle}
          min={row.startDate || tripStart}
          max={tripEnd}
          value={row.endDate}
          onChange={(e) => update(row.id, { endDate: e.target.value })}
        />
      </label>
    </>
  );
}
