// Story weather: a condition id + optional temperature, stored on the blog as
// `weather` (inside the `blogs.data` jsonb column, so no migration). Auto-fill
// uses Open-Meteo (free, no API key): the historical archive for older dates,
// the forecast API for the recent past and the next ~two weeks.

/**
 * @typedef {"sunny"|"cloudy"|"rainy"|"snowy"|"windy"|"thunderstorm"} WeatherCondition
 * @typedef {{
 *   condition: WeatherCondition,
 *   tempC: ?number,
 *   label: string,             // "Clear Skies", "Light Rain" — free text, user-editable
 *   source: "auto"|"manual",   // auto values are refreshed when date/place change; manual ones never are
 * }} Weather
 */

/** @type {{ id: WeatherCondition, icon: string, label: string }[]} */
export const WEATHER_CONDITIONS = [
  { id: "sunny", icon: "☀️", label: "Sunny" },
  { id: "cloudy", icon: "⛅", label: "Cloudy" },
  { id: "rainy", icon: "🌧️", label: "Rainy" },
  { id: "snowy", icon: "❄️", label: "Snowy" },
  { id: "windy", icon: "🌬️", label: "Windy" },
  { id: "thunderstorm", icon: "🌩️", label: "Thunderstorm" },
];

export const weatherIcon = (condition) => WEATHER_CONDITIONS.find((c) => c.id === condition)?.icon ?? "";
export const conditionLabel = (condition) => WEATHER_CONDITIONS.find((c) => c.id === condition)?.label ?? "";

/** "☀️ 25°C · Clear Skies" for a badge, or "" when there's no weather. */
export function formatWeather(weather) {
  if (!weather?.condition) return "";
  const temp = Number.isFinite(weather.tempC) ? `${Math.round(weather.tempC)}°C` : "";
  const label = weather.label?.trim() || conditionLabel(weather.condition);
  return [weatherIcon(weather.condition), [temp, label].filter(Boolean).join(" · ")].join(" ");
}

// WMO weather interpretation codes → [condition, label].
// https://open-meteo.com/en/docs#weathervariables
function describeCode(code) {
  if (code === 0) return ["sunny", "Clear Skies"];
  if (code === 1) return ["sunny", "Mainly Clear"];
  if (code === 2) return ["cloudy", "Partly Cloudy"];
  if (code === 3) return ["cloudy", "Overcast"];
  if (code === 45 || code === 48) return ["cloudy", "Foggy"];
  if (code >= 51 && code <= 57) return ["rainy", "Drizzle"];
  if (code === 61 || code === 80) return ["rainy", "Light Rain"];
  if (code === 63 || code === 81) return ["rainy", "Rain"];
  if (code === 65 || code === 82) return ["rainy", "Heavy Rain"];
  if (code === 66 || code === 67) return ["rainy", "Freezing Rain"];
  if (code >= 71 && code <= 77) return ["snowy", code === 75 ? "Heavy Snow" : "Snow"];
  if (code === 85 || code === 86) return ["snowy", "Snow Showers"];
  if (code >= 95) return ["thunderstorm", "Thunderstorms"];
  return ["cloudy", "Cloudy"];
}

/** A dry day with gusts above this reads as "Windy" rather than sunny/cloudy. */
const WINDY_KMH = 40;
/** The forecast API serves this many past days; older dates go to the archive. */
const FORECAST_PAST_DAYS = 60;
const FORECAST_FUTURE_DAYS = 15;
const DAY_MS = 86_400_000;

const cache = new Map();

/**
 * Likely weather for a place on a day (yyyy-mm-dd), or null when Open-Meteo
 * has nothing for it (too far ahead, offline). Rejects only on abort.
 * @returns {Promise<?Weather>}
 */
export async function fetchWeather({ lat, lng, date, signal }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return null;
  const daysAgo = Math.round((Date.now() - Date.parse(date)) / DAY_MS);
  if (daysAgo < -FORECAST_FUTURE_DAYS) return null;

  const key = `${lat.toFixed(2)}:${lng.toFixed(2)}:${date}`;
  if (cache.has(key)) return cache.get(key);

  const base = daysAgo > FORECAST_PAST_DAYS ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast";
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    start_date: date,
    end_date: date,
    daily: "weather_code,temperature_2m_max,wind_speed_10m_max",
    timezone: "auto",
  });
  try {
    const res = await fetch(`${base}?${params}`, { signal });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const { daily } = await res.json();
    const code = daily?.weather_code?.[0];
    if (code == null) return null;
    let [condition, label] = describeCode(code);
    const wind = daily.wind_speed_10m_max?.[0];
    if ((condition === "sunny" || condition === "cloudy") && wind >= WINDY_KMH) [condition, label] = ["windy", "Windy"];
    const temp = daily.temperature_2m_max?.[0];
    const weather = { condition, tempC: Number.isFinite(temp) ? Math.round(temp) : null, label, source: "auto" };
    cache.set(key, weather);
    return weather;
  } catch (err) {
    if (err.name === "AbortError") throw err;
    console.warn("Weather lookup failed", err);
    return null;
  }
}
