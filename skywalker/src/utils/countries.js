const REGIONAL_INDICATOR_OFFSET = 127397;

/**
 * Converts an ISO 3166-1 alpha-2 code (e.g. "SG") into its flag emoji by
 * mapping each letter to a Unicode regional indicator symbol. No image
 * assets or icon libraries needed.
 */
export function countryCodeToFlagEmoji(code) {
  if (!code || code.length !== 2) return "🏳️";
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(REGIONAL_INDICATOR_OFFSET + char.charCodeAt(0)));
}

/**
 * ISO_A2 -> continent, matching countries.geojson's own `CONTINENT` values
 * (verified against that dataset) — used to backfill mock data once rather
 * than re-deriving at runtime. Singapore has no feature in that geojson at
 * all (a known small-country omission), so it's set manually here.
 */
export const COUNTRY_TO_CONTINENT = {
  SG: "Asia",
  JP: "Asia",
  FR: "Europe",
  US: "North America",
  AU: "Oceania",
  GB: "Europe",
  IT: "Europe",
  TH: "Asia",
  MY: "Asia",
  ID: "Asia",
  AE: "Asia",
  BR: "South America",
  RU: "Europe",
  KR: "Asia",
};
