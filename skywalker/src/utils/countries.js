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

/** Continent tags, spelled as countries.geojson's `CONTINENT` values. */
export const CONTINENTS = ["Africa", "Antarctica", "Asia", "Europe", "North America", "Oceania", "South America"];

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

/**
 * Countries too small for countries.geojson (Natural Earth 110m drops them),
 * as [name, lat, lng] at roughly their centre — so the globe picker's country
 * list still covers every UN member state.
 */
export const SMALL_COUNTRY_CENTERS = {
  AD: ["Andorra", 42.55, 1.6],
  AG: ["Antigua and Barbuda", 17.08, -61.8],
  BB: ["Barbados", 13.19, -59.54],
  BH: ["Bahrain", 26.07, 50.55],
  CV: ["Cabo Verde", 15.12, -23.6],
  DM: ["Dominica", 15.42, -61.35],
  FM: ["Micronesia", 6.92, 158.16],
  GD: ["Grenada", 12.12, -61.68],
  HK: ["Hong Kong", 22.32, 114.17],
  KI: ["Kiribati", 1.45, 172.98],
  KM: ["Comoros", -11.7, 43.26],
  KN: ["Saint Kitts and Nevis", 17.3, -62.72],
  LC: ["Saint Lucia", 13.91, -60.98],
  LI: ["Liechtenstein", 47.17, 9.56],
  MC: ["Monaco", 43.74, 7.42],
  MH: ["Marshall Islands", 7.13, 171.18],
  MT: ["Malta", 35.94, 14.38],
  MU: ["Mauritius", -20.35, 57.55],
  MV: ["Maldives", 3.2, 73.22],
  NR: ["Nauru", -0.52, 166.93],
  PW: ["Palau", 7.51, 134.58],
  SC: ["Seychelles", -4.68, 55.49],
  SG: ["Singapore", 1.35, 103.82],
  SM: ["San Marino", 43.94, 12.46],
  ST: ["São Tomé and Príncipe", 0.19, 6.61],
  TO: ["Tonga", -21.18, -175.2],
  TV: ["Tuvalu", -7.11, 177.65],
  VA: ["Vatican City", 41.9, 12.45],
  VC: ["Saint Vincent and the Grenadines", 13.25, -61.2],
  WS: ["Samoa", -13.76, -172.1],
};
