const DEG2RAD = Math.PI / 180;

/** True when `point` has finite lat/lng (0 is a valid coordinate). */
export function hasCoords(point) {
  return Number.isFinite(point?.lat) && Number.isFinite(point?.lng);
}

/** Centroid of the geojson feature for an ISO_A2 code — a fallback location. */
export function centroidForCountryCode(code, countryFeatures) {
  const feature = countryFeatures.find((f) => f.properties?.ISO_A2 === code || f.properties?.WB_A2 === code);
  return feature ? getFeatureCentroid(feature) : null;
}

/** Escapes text for react-globe.gl's HTML-string tooltips. */
export function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Great-circle angular distance between two lat/lng points, in degrees.
 * Used instead of an exact bounding box because react-globe.gl (an orthographic-ish
 * perspective camera orbiting a sphere) has no built-in `getBounds()` like Mapbox/Leaflet —
 * "what's currently in view" is approximated from camera center + zoom instead.
 */
export function angularDistanceDeg(lat1, lng1, lat2, lng2) {
  const phi1 = lat1 * DEG2RAD;
  const phi2 = lat2 * DEG2RAD;
  const dPhi = (lat2 - lat1) * DEG2RAD;
  const dLambda = (lng2 - lng1) * DEG2RAD;

  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return c / DEG2RAD;
}

/**
 * Maps camera altitude (react-globe.gl's `pointOfView().altitude`, roughly
 * "globe radii above the surface") to a visible angular radius in degrees.
 *
 * This is a heuristic, not a physically exact frustum projection: at the default
 * altitude (~2.5) most of the front-facing hemisphere is visible, and it narrows
 * as the user zooms in. Tune the multiplier/clamp if pins feel like they
 * disappear too early/late for your camera FOV.
 */
export function visibleRadiusDeg(altitude) {
  const raw = altitude * 55;
  return Math.min(Math.max(raw, 6), 90);
}

/**
 * Whether a lat/lng is within the currently visible globe viewport, given the
 * camera's point-of-view. Combines the zoom-derived radius with a hard 90°
 * cutoff so points on the far side of the globe are never considered visible.
 */
export function isPointInView(pointOfView, lat, lng) {
  if (!pointOfView) return true;
  const radius = Math.min(visibleRadiusDeg(pointOfView.altitude), 89.5);
  return angularDistanceDeg(pointOfView.lat, pointOfView.lng, lat, lng) <= radius;
}

/**
 * Rough centroid of a geojson Polygon/MultiPolygon feature — a naive average
 * of every vertex, not an area-weighted centroid. Good enough to fly the
 * camera "into" a country from search; not meant for precise cartography.
 */
export function getFeatureCentroid(feature) {
  const geometry = feature.geometry;
  const polygons = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];

  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        sumLng += lng;
        sumLat += lat;
        count += 1;
      }
    }
  }
  return count === 0 ? null : { lat: sumLat / count, lng: sumLng / count };
}

/**
 * Even-odd ray-casting test: is (lat, lng) inside this single linear ring?
 * Ring is a geojson coordinate array of [lng, lat] pairs.
 */
function ringContainsPoint(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * geojson Polygon coordinates = [outerRing, ...holes]. XOR-ing the per-ring
 * even-odd result across every ring (not just the outer one) correctly
 * excludes holes regardless of winding order — enclaves like Lesotho inside
 * South Africa are modelled as a hole in South Africa's polygon.
 */
function polygonContainsPoint(lat, lng, rings) {
  let inside = false;
  for (const ring of rings) {
    if (ringContainsPoint(lat, lng, ring)) inside = !inside;
  }
  return inside;
}

/** Whether (lat, lng) falls inside a geojson Polygon/MultiPolygon feature. */
export function isPointInFeature(lat, lng, feature) {
  const geometry = feature?.geometry;
  if (!geometry) return false;
  const polygons = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  return polygons.some((rings) => polygonContainsPoint(lat, lng, rings));
}

/**
 * Natural Earth quirk: France's ISO_A2 is the placeholder "-99" in this
 * dataset; WB_A2 (World Bank code) has the real value. Fall back to it for
 * any feature with a similarly broken ISO_A2.
 */
function featureToCountryInfo(feature) {
  const props = feature.properties || {};
  const code = props.ISO_A2 && props.ISO_A2 !== "-99" ? props.ISO_A2 : props.WB_A2 || props.ISO_A2;
  return { code, name: props.NAME, continent: props.CONTINENT || "" };
}

/**
 * Looks up which continent a manually-picked (or auto-detected) ISO_A2 code
 * belongs to, by matching it back against the same geojson features used for
 * reverse geocoding — so a country picked by hand in CountrySelect gets the
 * same continent tagging as one resolved from GPS. `fallback` covers codes
 * missing from this geojson (e.g. Singapore) via a small hardcoded map.
 */
export function continentForCountryCode(code, countryFeatures, fallback = {}) {
  const feature = countryFeatures.find((f) => f.properties?.ISO_A2 === code || f.properties?.WB_A2 === code);
  if (feature) return feature.properties.CONTINENT || fallback[code] || "";
  return fallback[code] || "";
}

/**
 * Strict variant of findCountryForPoint: only a polygon that actually
 * contains the point, else null — so a pin in mid-ocean isn't labelled with
 * whichever country's centroid happens to be nearest.
 */
export function countryContainingPoint(lat, lng, countryFeatures) {
  // Cheap bbox reject first: this runs on every pointer move of a pin drag.
  const feature = countryFeatures.find((f) => {
    const [minLng, minLat, maxLng, maxLat] = featureBbox(f);
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng && isPointInFeature(lat, lng, f);
  });
  return feature ? featureToCountryInfo(feature) : null;
}

const bboxCache = new WeakMap();

/** [minLng, minLat, maxLng, maxLat] of a Polygon/MultiPolygon feature, memoized. */
function featureBbox(feature) {
  if (!bboxCache.has(feature)) {
    const bbox = [Infinity, Infinity, -Infinity, -Infinity];
    const geometry = feature.geometry;
    const polygons = !geometry ? [] : geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
    for (const polygon of polygons) {
      for (const [lng, lat] of polygon[0] ?? []) {
        bbox[0] = Math.min(bbox[0], lng);
        bbox[1] = Math.min(bbox[1], lat);
        bbox[2] = Math.max(bbox[2], lng);
        bbox[3] = Math.max(bbox[3], lat);
      }
    }
    bboxCache.set(feature, bbox);
  }
  return bboxCache.get(feature);
}

/** "35.01°N, 135.77°E" — the place label of last resort. */
export function formatCoords(lat, lng) {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;
}

/**
 * Which ocean an offshore point is in ("North Atlantic Ocean"), from coarse
 * longitude bands — only meant for points no country polygon or geocoder
 * claims, so the land boundaries between basins can stay rough.
 */
export function oceanForPoint(lat, lng) {
  if (lat >= 66) return "Arctic Ocean";
  if (lat <= -60) return "Southern Ocean";
  const hemisphere = lat >= 0 ? "North" : "South";
  // Indian: east of Africa, west of the Malay archipelago / Australia.
  if (lng >= 20 && lng < (lat < -10 ? 147 : 100) && lat < 30) return "Indian Ocean";
  // Atlantic: east of the Americas (Caribbean/Gulf included north of ~8°N).
  if (lng >= (lat > 8 ? -100 : -70) && lng < 20) return `${hemisphere} Atlantic Ocean`;
  return `${hemisphere} Pacific Ocean`;
}

/** Whether a place label names open water, so it reads "in the …". */
export function isWaterName(name) {
  return /\b(Ocean|Sea)$/.test(name ?? "");
}

/**
 * Client-side reverse geocoding: which country (and continent, read straight
 * off the same feature) contains this point. Falls back to the nearest
 * country by centroid distance when no polygon contains the point — some
 * small countries (e.g. Singapore) have no feature at all in this Natural
 * Earth dataset, so an exact match isn't always possible.
 */
export function findCountryForPoint(lat, lng, countryFeatures) {
  const containing = countryContainingPoint(lat, lng, countryFeatures);
  if (containing) return containing;

  let nearest = null;
  let nearestDist = Infinity;
  for (const feature of countryFeatures) {
    const centroid = getFeatureCentroid(feature);
    if (!centroid) continue;
    const dist = angularDistanceDeg(lat, lng, centroid.lat, centroid.lng);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = feature;
    }
  }
  return nearest ? featureToCountryInfo(nearest) : null;
}

/**
 * Groups photos that share (roughly) the same coordinates into map pins, so a
 * city with many photos renders as one pin sized by count instead of an
 * overlapping pile. Precision ~0.05deg (~5km) keeps distinct cities separate.
 */
export function clusterPhotosByLocation(photos, precision = 0.05) {
  const groups = new Map();
  // Uploads without GPS have null coords; Math.round(null) is 0, so without
  // this guard they'd all pile into one bogus pin at 0°N 0°E.
  for (const photo of photos.filter(hasCoords)) {
    const key = `${Math.round(photo.lat / precision)}:${Math.round(photo.lng / precision)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        lat: photo.lat,
        lng: photo.lng,
        locationName: photo.locationName,
        countryCode: photo.countryCode,
        photos: [],
      });
    }
    groups.get(key).photos.push(photo);
  }
  return Array.from(groups.values());
}
