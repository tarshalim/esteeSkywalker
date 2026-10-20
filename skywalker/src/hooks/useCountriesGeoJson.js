import { useEffect, useState } from "react";

/**
 * Loads the world countries geojson once and shares it between PhotoGlobe
 * (choropleth polygons) and GlobeSearchBar (searching by country name even
 * before any photo/pin exists there), instead of each fetching it separately.
 * @returns {object[]} geojson feature array, empty until loaded.
 */
export function useCountriesGeoJson() {
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/countries.geojson")
      .then((res) => res.json())
      .then((geojson) => {
        if (!cancelled) setCountries(geojson.features);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return countries;
}
