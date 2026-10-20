import { useEffect, useMemo, useState } from "react";
import { useCountriesGeoJson } from "./useCountriesGeoJson";
import { cachedPlaceName, reverseGeocode } from "../lib/geocode";
import { countryContainingPoint, formatCoords, oceanForPoint } from "../utils/geo";

// While a pin is being dragged, only ask the network once the pointer rests;
// the local country lookup covers the frames in between.
const RESOLVE_DEBOUNCE_MS = 450;

/**
 * Live place name for a coordinate, in tiers so something sensible is always
 * on screen: cached/remote "Kyoto, Japan" > local country polygon "Japan" >
 * ocean "North Atlantic Ocean" > raw "35.01°N, 135.77°E" (only until the
 * country polygons have loaded, since without them land can't be told apart
 * from sea).
 *
 * @param {?{lat:number,lng:number}} coords - null to idle.
 * @returns {{ name: ?string, isResolving: boolean }}
 */
export function usePlaceName(coords) {
  const countries = useCountriesGeoJson();
  const lat = coords?.lat;
  const lng = coords?.lng;
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);
  const [remote, setRemote] = useState(null); // { key, name }

  const key = hasPoint ? `${lat.toFixed(2)}:${lng.toFixed(2)}` : null;

  useEffect(() => {
    if (!hasPoint || cachedPlaceName(lat, lng) != null) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      reverseGeocode(lat, lng, { signal: controller.signal }).then(
        (name) => setRemote({ key, name }),
        () => {} // aborted: a newer coordinate superseded this one
      );
    }, RESOLVE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
    // `key` already captures lat/lng at the precision we resolve at.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const fallback = useMemo(() => {
    if (!hasPoint) return null;
    if (!countries.length) return formatCoords(lat, lng);
    return countryContainingPoint(lat, lng, countries)?.name ?? oceanForPoint(lat, lng);
  }, [hasPoint, lat, lng, countries]);

  if (!hasPoint) return { name: null, isResolving: false };
  const cached = cachedPlaceName(lat, lng);
  if (cached) return { name: cached, isResolving: false };
  if (remote?.key === key) return { name: remote.name ?? fallback, isResolving: false };
  return { name: fallback, isResolving: true };
}
