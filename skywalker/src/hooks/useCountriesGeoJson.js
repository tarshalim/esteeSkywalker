import { useEffect, useState } from "react";

// One shared request: PhotoGlobe, GlobeSearchBar and the pin-placement UI
// all read the same geojson, so fetch it once per page load.
let countriesPromise = null;

function loadCountries() {
  if (!countriesPromise) {
    countriesPromise = fetch("/data/countries.geojson")
      .then((res) => res.json())
      .then((geojson) => geojson.features);
    // Don't cache failures, so a later mount can retry.
    countriesPromise.catch(() => {
      countriesPromise = null;
    });
  }
  return countriesPromise;
}

/**
 * Loads the world countries geojson once and shares it between PhotoGlobe
 * (choropleth polygons), GlobeSearchBar (searching by country name even
 * before any photo/pin exists there) and live pin place names.
 * @returns {object[]} geojson feature array, empty until loaded.
 */
export function useCountriesGeoJson() {
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    let cancelled = false;
    loadCountries().then(
      (features) => !cancelled && setCountries(features),
      (err) => console.error("Failed to load countries", err)
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return countries;
}
