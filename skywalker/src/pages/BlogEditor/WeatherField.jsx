import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw, X } from "lucide-react";
import { WEATHER_CONDITIONS, conditionLabel, fetchWeather, formatWeather } from "../../lib/weather";

/** Typing a city shouldn't fire a lookup per keystroke. */
const SYNC_DEBOUNCE_MS = 700;

const STATUS_TEXT = {
  loading: "Checking the skies…",
  auto: "Auto-filled from Open-Meteo for this date and place — pick an icon to change it.",
  noplace: "Add a location, city or country to auto-fill the weather.",
  unavailable: "No weather on record for this date and place — set it yourself below.",
  manual: "Set by you.",
};

/**
 * Story weather: auto-filled from Open-Meteo whenever the date or place
 * changes, until the writer overrides it with an icon / temperature / label
 * (a manual value is never overwritten; "Re-sync" asks for a fresh one).
 *
 * @param {{
 *   value: ?import("../../lib/weather").Weather,
 *   onChange: (next: ?import("../../lib/weather").Weather) => void,
 *   date: string,                                       // yyyy-mm-dd
 *   placeKey: string,                                   // changes whenever the place does
 *   resolvePoint: (signal: AbortSignal) => Promise<?{ lat: number, lng: number }>,
 * }} props
 */
export default function WeatherField({ value, onChange, date, placeKey, resolvePoint }) {
  const syncKey = `${date}|${placeKey}`;
  // A loaded post already has weather for its date/place; don't refetch it on open.
  const syncedKeyRef = useRef(value ? syncKey : null);
  const [status, setStatus] = useState(value ? value.source : null);
  const [syncNonce, setSyncNonce] = useState(0);
  const latest = useRef({ onChange, resolvePoint, manual: value?.source === "manual" });
  latest.current = { onChange, resolvePoint, manual: value?.source === "manual" };

  useEffect(() => {
    const forced = syncNonce > 0 && syncedKeyRef.current === null;
    if (!forced && (latest.current.manual || syncedKeyRef.current === syncKey)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const point = await latest.current.resolvePoint(controller.signal);
        if (!point) {
          syncedKeyRef.current = syncKey;
          return setStatus("noplace");
        }
        const weather = await fetchWeather({ ...point, date, signal: controller.signal });
        syncedKeyRef.current = syncKey;
        if (!weather) return setStatus("unavailable");
        latest.current.onChange(weather);
        setStatus("auto");
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          setStatus("unavailable");
        }
      }
    }, forced ? 0 : SYNC_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [syncKey, date, syncNonce]);

  const resync = () => {
    syncedKeyRef.current = null;
    setSyncNonce((n) => n + 1);
  };

  const setManual = (patch) => {
    setStatus("manual");
    onChange({ condition: "sunny", tempC: null, label: "", ...value, ...patch, source: "manual" });
  };

  const pickCondition = (id) => setManual({ condition: id, label: conditionLabel(id) });

  const clear = () => {
    // Stays cleared until the date or place changes.
    syncedKeyRef.current = syncKey;
    setStatus(null);
    onChange(null);
  };

  return (
    <div className="editor-weather" role="group" aria-labelledby="editor-weather-label">
      <div className="flex flex-wrap items-center gap-2">
        <span id="editor-weather-label" className="editor-metadata-label">
          Weather
        </span>
        {value && <span className="editor-weather-preview">{formatWeather(value)}</span>}
        <button
          type="button"
          className="editor-weather-action"
          onClick={resync}
          disabled={status === "loading"}
          title="Fetch the likely weather for this date and place"
        >
          {status === "loading" ? (
            <LoaderCircle size={13} className="animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw size={13} aria-hidden="true" />
          )}
          {value?.source === "manual" ? "Re-sync" : "Sync"}
        </button>
        {value && (
          <button type="button" className="editor-weather-action" onClick={clear} aria-label="Remove weather">
            <X size={13} aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      <div className="editor-weather-chips" role="radiogroup" aria-label="Weather condition">
        {WEATHER_CONDITIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={value?.condition === c.id}
            className={`editor-vibe-chip editor-weather-chip${value?.condition === c.id ? " is-on" : ""}`}
            onClick={() => pickCondition(c.id)}
          >
            <span aria-hidden="true">{c.icon}</span> {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="editor-weather-temp">
          <span className="sr-only">Temperature in °C</span>
          <input
            type="number"
            inputMode="numeric"
            className="editor-date-input w-24"
            placeholder="°C"
            min={-80}
            max={60}
            disabled={!value}
            value={Number.isFinite(value?.tempC) ? value.tempC : ""}
            onChange={(e) => setManual({ tempC: e.target.value === "" ? null : Number(e.target.value) })}
          />
          <span aria-hidden="true">°C</span>
        </label>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Weather description</span>
          <input
            className="editor-date-input w-full"
            placeholder="Describe it (e.g. Clear Skies, Misty morning)"
            maxLength={40}
            disabled={!value}
            value={value?.label ?? ""}
            onChange={(e) => setManual({ label: e.target.value })}
          />
        </label>
      </div>

      {status && STATUS_TEXT[status] && (
        <p className="editor-weather-status" aria-live="polite">
          {STATUS_TEXT[status]}
        </p>
      )}
    </div>
  );
}
