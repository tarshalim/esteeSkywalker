import { useEffect, useMemo, useState } from "react";
import { useCountriesGeoJson } from "./useCountriesGeoJson";
import { searchPlaces } from "../lib/geocode";
import { getFeatureCentroid } from "../utils/geo";
import { allCompanions } from "../lib/hierarchy";
import { formatDateRange } from "../utils/dateFilters";

const MAX_RESULTS = 8;
// Places come from a network geocoder, so wait for a typing pause.
const PLACE_SEARCH_DEBOUNCE_MS = 300;
const PLACE_SEARCH_MIN_CHARS = 2;

/**
 * Globe search behind the navbar whenever a globe is on screen (/globe, or
 * the homepage scrolled to its globe section): local matches (posts, photo pins, your pins, countries) plus world
 * places from the geocoder (`kind: "place"`), which drop a red pin when picked.
 * @returns {{ localResults: object[], placeResults: object[], isPending: boolean }}
 */
export function useGlobeSearch(query, { pins, customPins, blogs, trips = [] }) {
  const countries = useCountriesGeoJson();
  const [places, setPlaces] = useState({ query: "", results: [] });

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
          id: feature.properties.ISO_A2,
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
      sublabel: pin.placeName || pin.note || "Your pin",
      id: pin.id,
      lat: pin.lat,
      lng: pin.lng,
    }));

    const blogResults = blogs.map((blog) => ({
      kind: "blog",
      label: blog.title,
      sublabel: blog.location.name,
      id: blog.id,
      blogId: blog.id,
      lat: blog.location.lat,
      lng: blog.location.lng,
    }));

    // Trips match on their title and anyone who came along; picking one opens its location.
    const tripResults = trips.map((trip) => {
      const companions = allCompanions(trip);
      return {
        kind: "trip",
        label: trip.title,
        sublabel: [trip.pin.title, formatDateRange(trip.startDate, trip.endDate), companions.length > 0 && `with ${companions.join(", ")}`]
          .filter(Boolean)
          .join(" · "),
        id: trip.id,
        pinId: trip.pin.id,
        lat: trip.pin.lat,
        lng: trip.pin.lng,
      };
    });

    return [...tripResults, ...blogResults, ...pinResults, ...customPinResults, ...countryResults];
  }, [countries, pins, customPins, blogs, trips]);

  const trimmed = query.trim();

  const localResults = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return [];
    return index
      .filter((r) => r.label?.toLowerCase().includes(q) || r.sublabel?.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [index, trimmed]);

  useEffect(() => {
    if (trimmed.length < PLACE_SEARCH_MIN_CHARS) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      searchPlaces(trimmed, { signal: controller.signal }).then(
        (results) => setPlaces({ query: trimmed, results }),
        () => {} // aborted by newer keystrokes
      );
    }, PLACE_SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmed]);

  const placeResults = useMemo(
    () =>
      places.query === trimmed
        ? places.results.map((p, i) => ({ ...p, kind: "place", id: `${i}-${p.lat}-${p.lng}` }))
        : [],
    [places, trimmed]
  );

  const isPending = trimmed.length >= PLACE_SEARCH_MIN_CHARS && places.query !== trimmed;

  return { localResults, placeResults, isPending };
}
