import { useEffect, useImperativeHandle, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import Globe from "react-globe.gl";
import { angularDistanceDeg, clusterPhotosByLocation, escapeHtml, slerpLatLng } from "../../lib/geo";
import { formatDateRange } from "../../lib/dateFilters";
import { journeyLegs, stopPinsOf } from "../../lib/hierarchy";
import { useCountriesGeoJson } from "../../hooks/useCountriesGeoJson";
import { createIdyllicTexture, createYellowBlueGlobeDataUrl, enhanceTexture } from "../../lib/proceduralGlobeTexture";
import { useTheme } from "../../lib/theme";
import "./PhotoGlobe.css";

const DAY_TEXTURE_URL = "/textures/earth-blue-marble.jpg";
const WATER_MASK_URL = "/textures/earth-water.png";
const BUMP_TEXTURE_URL = "/textures/earth-topology.png";
const NIGHT_SKY_URL = "/textures/night-sky.jpg";
// Guaranteed-available yellow/blue vector globe, swapped in if the day
// texture ever fails to load so the globe can never render black.
const FALLBACK_TEXTURE_URL = createYellowBlueGlobeDataUrl();
// Second-tier fallback if only the water mask fails: the plain photo, lifted.
const VIVID_TEXTURE_FILTER = "saturate(1.2) brightness(1.3)";
// Both themes show the same bright, idyllic daylight Earth (turquoise seas,
// pastel land — see createIdyllicTexture). Light = airy sky backdrop; dark =
// the same sunny Earth floating in a starfield with a stronger halo. No
// night-side city lights: they muddied the day side into a gloomy cast.
const PALETTES = {
  light: {
    backgroundImageUrl: null,
    landColor: "rgba(0, 0, 0, 0)",
    visitedColor: "rgba(59, 130, 246, 0.28)",
    selectedColor: "rgba(250, 204, 21, 0.5)",
    polygonSide: "rgba(255, 255, 255, 0.05)",
    polygonStroke: "rgba(255, 255, 255, 0.55)",
    gridColor: "rgba(255, 255, 255, 0.5)",
    pinColor: "#1e40af",
    pinSelected: "#f59e0b",
    customPin: "#2563eb",
    customPinSelected: "#eab308",
    blogPin: "#e11d48",
    // Journey arcs: gradient from each leg's start to its end; dimmed unless
    // their trip's pin is selected (or nothing is).
    arcFrom: "rgba(225, 29, 72, 0.9)",
    arcTo: "rgba(245, 158, 11, 0.9)",
    arcDim: "rgba(225, 29, 72, 0.25)",
    stopPin: "#be123c",
    ringColor: "30, 64, 175",
    atmosphereColor: "#8fdcff",
    atmosphereAltitude: 0.2,
    // Soft warm fill, a gentle sun, and a cool sky-blue rim on the limb.
    ambient: [0xfff8ee, 2.2],
    key: [0xfff1d6, 1.5],
    rim: [0xbfe9ff, 1.4],
    specular: 0x5f9fc4,
  },
  dark: {
    backgroundImageUrl: NIGHT_SKY_URL,
    landColor: "rgba(0, 0, 0, 0)",
    visitedColor: "rgba(96, 165, 250, 0.32)",
    selectedColor: "rgba(250, 204, 21, 0.6)",
    polygonSide: "rgba(96, 165, 250, 0.12)",
    polygonStroke: "rgba(224, 242, 254, 0.5)",
    gridColor: "rgba(186, 230, 253, 0.4)",
    pinColor: "#fde047",
    pinSelected: "#ffffff",
    customPin: "#7dd3fc",
    customPinSelected: "#fef9c3",
    blogPin: "#fb7185",
    arcFrom: "rgba(251, 113, 133, 0.95)",
    arcTo: "rgba(253, 224, 71, 0.95)",
    arcDim: "rgba(251, 113, 133, 0.3)",
    stopPin: "#fda4af",
    ringColor: "253, 224, 71",
    atmosphereColor: "#7dd3fc",
    atmosphereAltitude: 0.26,
    ambient: [0xfff8ee, 2.1],
    key: [0xfff1d6, 1.5],
    rim: [0x7dd3fc, 2.6],
    specular: 0x5f9fc4,
  },
};

// Lucide's map-pin, inlined for the globe's HTML marker layer (which takes a
// DOM element, not a React node). Styled by .red-pin-icon.
const PIN_SVG = `<svg class="red-pin-icon" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`;

// The HTML layer centers each element on its coordinate, so the marker is
// twice the pin's height with the pin in the top half: its tip lands exactly
// on the spot. A `suggested` pin (e.g. from GPS, not yet chosen) pulses.
function createDroppedPinElement(d) {
  const el = document.createElement("div");
  el.className = `globe-dropped-pin${d?.suggested ? " is-suggested" : ""}`;
  el.innerHTML = `<span class="globe-dropped-pin-body">${PIN_SVG}</span><span class="globe-dropped-pin-shadow"></span>`;
  return el;
}

const ZOOM_DEBOUNCE_MS = 150;
const DEFAULT_VIEW = { lat: 15, lng: 95, altitude: 2.1 };
// Fly-to framing when the target doesn't carry its own altitude.
const FLY_TO_ALTITUDE = 0.45;
// globe.gl frames the sphere by the camera's vertical FOV, so on a portrait
// stage (phones) the default altitude spills it off both sides. Pull the
// camera back until the sphere, plus this much breathing room for the
// atmosphere, fits the narrower axis. Landscape stages are left untouched.
const FIT_MARGIN = 1.12;
function fitAltitudeToStage(altitude, camera, width, height) {
  if (!width || !height) return altitude;
  const halfV = ((camera.fov ?? 50) * Math.PI) / 360;
  const halfH = Math.atan(Math.tan(halfV) * (width / height));
  // Altitude is in globe radii; the sphere fits once asin(R·margin / d) ≤ half-angle.
  return Math.max(altitude, FIT_MARGIN / Math.sin(Math.min(halfV, halfH)) - 1);
}
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// Lat/lng graticule for the "grid lines" setting: a meridian every 15° and a
// parallel every 15° (poles excluded), sampled every 5° so lines hug the sphere.
const range = (from, to, step) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const GRATICULE = [
  ...range(-180, 165, 15).map((lng) => range(-90, 90, 5).map((lat) => [lat, lng])),
  ...range(-75, 75, 15).map((lat) => range(-180, 180, 5).map((lng) => [lat, lng])),
];
const graticulePoints = (line) => line;
const graticuleLat = (point) => point[0];
const graticuleLng = (point) => point[1];

// A custom pin that holds blog posts is a story hub: red, larger, and opens
// GlobeExplorer's quick card.
const isStoryPin = (d) => d.kind === "custom" && d.posts?.length > 0;

const arcStartLat = (d) => d.from.lat;
const arcStartLng = (d) => d.from.lng;
const arcEndLat = (d) => d.to.lat;
const arcEndLng = (d) => d.to.lng;

/** "Cusco, Peru" for a stop's tooltip line. */
const stopPlace = (stop) => [stop.locationName, stop.country].filter((part, i, all) => part && all.indexOf(part) === i).join(", ");

/**
 * Thin wrapper around react-globe.gl that owns only rendering + raw camera/click
 * events. All filtering/selection state lives in GlobeExplorer — this component
 * is a dumb view + event source so it stays easy to swap for Mapbox/Cesium later.
 *
 * `customPins` may carry `posts` (pinStore.buildStoryPins); `blogs` only
 * marks countries as visited — posts are drawn through their pins.
 *
 * `journeys` ([{ trip, pinId }]) draws a pin per placed stop of each trip
 * (hierarchy.stopPinsOf) and, for multi-stop trips, animated arcs from stop
 * to stop. Clicking a stop pin, or an arc (its leg's start), calls
 * onStopClick with that StopPin; `selectedStopId` highlights one.
 *
 * `ref` exposes coordsAtClientPoint(clientX, clientY) -> {lat,lng} | null, used
 * by the draggable pin to resolve where it was released.
 *
 * `flyToTarget` ({lat, lng, altitude?}) flies the camera along the great
 * circle (slerp); a new object re-flies even to the same spot. `lockRotation`
 * stops drag-to-rotate (zoom still works) and `panOnly` keeps the grab cursor
 * over land and markers — the globe picker's Pin and Explore modes.
 */
export default function PhotoGlobe({
  ref,
  photos,
  customPins,
  journeys = [],
  blogs = [],
  selectedCountryCode,
  selectedLocationId,
  selectedCustomPinId,
  selectedStopId = null,
  labelMode,
  showBorders = true,
  showGrid = false,
  showAtmosphere = true,
  autoRotate = true,
  // Pin/label/ring sizes are in degrees of arc, so a thumbnail globe (the
  // settings preview) scales them up to stay legible.
  markerScale = 1,
  initialView = DEFAULT_VIEW,
  isPlacingPin,
  lockRotation = false,
  panOnly = false,
  pendingPin = null,
  flyToTarget,
  onViewportChange,
  // Un-debounced {lat, lng, altitude} on every camera move (drag, zoom,
  // auto-rotate, fly-to) — cheap, so callers should only stash it.
  onCameraChange = null,
  onCountryClick,
  onCountryHover,
  onPinClick,
  onPinHover,
  onCustomPinClick,
  onStopClick = null,
  onPinDropAt,
}) {
  const globeEl = useRef();
  const wrapperRef = useRef();
  const zoomTimeoutRef = useRef(null);
  const countries = useCountriesGeoJson();
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [isReady, setIsReady] = useState(false);
  const { theme } = useTheme();
  const palette = PALETTES[theme] ?? PALETTES.light;
  const [globeImageUrl, setGlobeImageUrl] = useState(null);
  // react-globe.gl takes `globeMaterial` as a prop (it isn't a ref method), so
  // own the material here and hand the same instance to <Globe>; the theme
  // effect below tweaks it in place. globeImageUrl/bumpImageUrl still load
  // onto it.
  const [globeMaterial] = useState(() => new THREE.MeshPhongMaterial());
  // Read by onGlobeReady: a deep-link fly target can arrive before the globe
  // is ready, and the default camera reset used to overwrite it.
  const flyToTargetRef = useRef(flyToTarget);
  flyToTargetRef.current = flyToTarget;

  const flightRef = useRef(0);
  useEffect(
    () => () => {
      clearTimeout(zoomTimeoutRef.current);
      cancelAnimationFrame(flightRef.current);
    },
    []
  );
  // The settings preview mounts/unmounts with its page; free the GPU program.
  useEffect(() => () => globeMaterial.dispose(), [globeMaterial]);
  const initialViewRef = useRef(initialView);
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;
  const reportCamera = useCallback(() => {
    if (globeEl.current) onCameraChangeRef.current?.(globeEl.current.pointOfView());
  }, []);

  // Never render a black globe: grade the photo into the idyllic palette,
  // falling back to the lifted photo, then to the stylized vector texture.
  useEffect(() => {
    let cancelled = false;
    createIdyllicTexture(DAY_TEXTURE_URL, WATER_MASK_URL)
      .catch(() => enhanceTexture(DAY_TEXTURE_URL, VIVID_TEXTURE_FILTER))
      .then(
        (url) => !cancelled && setGlobeImageUrl(url),
        () => !cancelled && setGlobeImageUrl(FALLBACK_TEXTURE_URL)
      );
    return () => {
      cancelled = true;
    };
  }, []);

  // Theme lighting. The key (sun) and rim lights ride on the camera so the
  // face the viewer sees is always lit (auto-rotate never swings into a dark
  // side), while the rim light sits behind the globe to edge the limb with a
  // glow. The water mask doubles as a specular map for a soft sun glint on
  // the oceans only.
  useEffect(() => {
    const globe = globeEl.current;
    if (!isReady || !globe) return;
    const camera = globe.camera();
    const scene = globe.scene();
    if (camera.parent !== scene) scene.add(camera);

    globe.lights([new THREE.AmbientLight(...palette.ambient)]);
    const key = new THREE.DirectionalLight(...palette.key);
    // Mostly frontal (camera space: +z is toward the viewer) so the far limb
    // doesn't fall into shadow.
    key.position.set(-80, 80, 300);
    const rim = new THREE.DirectionalLight(...palette.rim);
    rim.position.set(60, 120, -900);
    camera.add(key, rim);

    const material = globeMaterial;
    let disposed = false;
    material.shininess = 18;
    // Until the mask loads, keep the whole sphere matte (no land glint).
    material.specular = new THREE.Color(0x000000);
    new THREE.TextureLoader().load(WATER_MASK_URL, (tex) => {
      if (disposed) return tex.dispose();
      material.specularMap = tex;
      material.specular = new THREE.Color(palette.specular);
      material.needsUpdate = true;
    });
    material.needsUpdate = true;

    return () => {
      disposed = true;
      camera.remove(key, rim);
      key.dispose();
      rim.dispose();
      material.specularMap?.dispose();
      material.specularMap = null;
      material.needsUpdate = true;
    };
  }, [isReady, theme, palette, globeMaterial]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Countries with a photo *or* a post are clickable, so blog-only countries
  // can still filter the homepage feed.
  const visitedCountryCodes = useMemo(
    () => new Set([...photos.map((p) => p.countryCode), ...blogs.map((b) => b.countryCode)].filter(Boolean)),
    [photos, blogs]
  );

  const photoPins = useMemo(() => clusterPhotosByLocation(photos), [photos]);

  // Photo pins (clustered photos) and custom/story pins share one
  // react-globe.gl points layer, tagged by `kind` so click/hover/color/label
  // logic can dispatch to the right handler and dataset.
  const journeyArcs = useMemo(
    () =>
      journeys.flatMap(({ trip, pinId }) =>
        journeyLegs(trip).map((leg) => ({ ...leg, id: `${trip.id}:${leg.index}`, tripId: trip.id, pinId, tripTitle: trip.title }))
      ),
    [journeys]
  );
  // Every placed stop of those trips is a pin of its own.
  const stopPoints = useMemo(
    () => journeys.flatMap(({ trip, pinId }) => stopPinsOf(trip, pinId).map((pin) => ({ ...pin, kind: "stop" }))),
    [journeys]
  );

  const combinedPins = useMemo(
    () => [
      ...photoPins.map((pin) => ({ ...pin, kind: "photo" })),
      ...customPins.map((pin) => ({ ...pin, kind: "custom" })),
      ...stopPoints,
    ],
    [photoPins, customPins, stopPoints]
  );

  // react-globe.gl's own pointOfView tween lerps lat/lng, which bends long
  // hops through odd routes; slerp the camera's direction instead, and lift
  // it mid-flight on long hops so the route stays in view.
  const flyTo = useCallback((target) => {
    const globe = globeEl.current;
    if (!globe) return;
    cancelAnimationFrame(flightRef.current);
    const from = globe.pointOfView();
    const toAltitude = target.altitude ?? FLY_TO_ALTITUDE;
    const arcDeg = angularDistanceDeg(from.lat, from.lng, target.lat, target.lng);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      globe.pointOfView({ lat: target.lat, lng: target.lng, altitude: toAltitude }, 0);
      reportCamera();
      return;
    }
    const duration = Math.min(Math.max(700 + arcDeg * 9, 900), 2200);
    const lift = Math.max(0, Math.min(arcDeg / 60, 1.8) - Math.max(from.altitude, toAltitude));
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const e = easeInOutCubic(t);
      const altitude = from.altitude + (toAltitude - from.altitude) * e + lift * Math.sin(Math.PI * e);
      globe.pointOfView({ ...slerpLatLng(from, target, e), altitude }, 0);
      reportCamera();
      if (t < 1) flightRef.current = requestAnimationFrame(step);
    };
    flightRef.current = requestAnimationFrame(step);
  }, [reportCamera]);

  useEffect(() => {
    if (flyToTarget && isReady) flyTo(flyToTarget);
  }, [flyToTarget, isReady, flyTo]);

  const handleZoom = useCallback(
    (pov) => {
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
      zoomTimeoutRef.current = setTimeout(() => {
        onViewportChange(pov);
      }, ZOOM_DEBOUNCE_MS);
    },
    [onViewportChange]
  );

  const handleGlobeReady = useCallback(() => {
    const target = flyToTargetRef.current;
    const initial = initialViewRef.current;
    const { clientWidth, clientHeight } = wrapperRef.current;
    globeEl.current.pointOfView(
      target
        ? { lat: target.lat, lng: target.lng, altitude: target.altitude ?? FLY_TO_ALTITUDE }
        : { ...initial, altitude: fitAltitudeToStage(initial.altitude, globeEl.current.camera(), clientWidth, clientHeight) },
      0
    );
    onViewportChange(globeEl.current.pointOfView());
    reportCamera();
    setIsReady(true);

    // Smooth continuous rotation with damped drag-to-rotate — no
    // pointermove/hover listeners drive the camera, only explicit drag.
    const controls = globeEl.current.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotateSpeed = 0.8;
    // Grabbing the globe mid-flight hands the camera back to the user.
    controls.addEventListener("start", () => cancelAnimationFrame(flightRef.current));
    // Fires for drags, zoom and auto-rotate alike.
    controls.addEventListener("change", reportCamera);
  }, [onViewportChange, reportCamera]);

  useEffect(() => {
    if (isReady && globeEl.current) globeEl.current.controls().autoRotate = autoRotate;
  }, [isReady, autoRotate]);

  useEffect(() => {
    if (isReady && globeEl.current) globeEl.current.controls().enableRotate = !lockRotation;
  }, [isReady, lockRotation]);

  const polygonCapColor = useCallback(
    (feature) => {
      const iso2 = feature.properties.ISO_A2;
      // Selection wins even for a country with no photos yet — search can
      // select any country, not just visited ones.
      if (iso2 === selectedCountryCode) return palette.selectedColor;
      return visitedCountryCodes.has(iso2) ? palette.visitedColor : palette.landColor;
    },
    [visitedCountryCodes, selectedCountryCode, palette]
  );

  const polygonLabel = useCallback(
    (feature) => {
      const iso2 = feature.properties.ISO_A2;
      const count = photos.filter((p) => p.countryCode === iso2).length;
      return `<div class="globe-tooltip"><strong>${escapeHtml(feature.properties.NAME)}</strong><br/>${
        count > 0 ? `${count} photo${count === 1 ? "" : "s"}` : "No photos yet"
      }</div>`;
    },
    [photos]
  );

  const pointColor = useCallback(
    (d) => {
      if (d.kind === "stop") return d.id === selectedStopId ? palette.customPinSelected : palette.stopPin;
      if (d.kind === "custom") {
        if (d.id === selectedCustomPinId && !selectedStopId) return palette.customPinSelected;
        return isStoryPin(d) ? palette.blogPin : palette.customPin;
      }
      return d.id === selectedLocationId ? palette.pinSelected : palette.pinColor;
    },
    [selectedLocationId, selectedCustomPinId, selectedStopId, palette]
  );

  // Pulsing halo under every photo pin so markers read at globe scale.
  const ringColor = useCallback(
    () => (t) => `rgba(${palette.ringColor}, ${Math.max(0, 1 - t) * 0.8})`,
    [palette]
  );

  const pointRadius = useCallback(
    (d) =>
      markerScale *
      (d.kind === "photo"
        ? Math.min(0.15 + d.photos.length * 0.03, 0.45)
        : d.kind === "stop"
        ? Math.min(0.2 + d.posts.length * 0.03, 0.38)
        : isStoryPin(d)
        ? Math.min(0.26 + d.posts.length * 0.03, 0.42)
        : 0.22),
    [markerScale]
  );

  // User-entered text is injected as HTML here, so it must be escaped.
  const pointLabel = useCallback((d) => {
    if (d.kind === "stop") {
      const count = d.posts.length;
      return `<div class="globe-tooltip"><strong>${d.stopCount > 1 ? `${d.order}. ` : ""}${escapeHtml(stopPlace(d))}</strong><br/>${escapeHtml(
        formatDateRange(d.startDate, d.endDate)
      )}<br/>${escapeHtml(d.tripTitle)}${count > 0 ? ` · ${count} stor${count === 1 ? "y" : "ies"}` : ""}</div>`;
    }
    if (isStoryPin(d)) {
      const count = d.posts.length;
      return `<div class="globe-tooltip"><strong>${escapeHtml(d.title)}</strong>${
        d.placeName && d.placeName !== d.title ? `<br/>${escapeHtml(d.placeName)}` : ""
      }<br/>${count} stor${count === 1 ? "y" : "ies"} · click to preview</div>`;
    }
    if (d.kind === "custom") {
      return `<div class="globe-tooltip"><strong>${escapeHtml(d.title)}</strong>${
        d.placeName ? `<br/>${escapeHtml(d.placeName)}` : ""
      }${d.note ? `<br/>${escapeHtml(d.note)}` : ""}</div>`;
    }
    return `<div class="globe-tooltip"><strong>${escapeHtml(d.locationName)}</strong><br/>${d.photos.length} photo${
      d.photos.length === 1 ? "" : "s"
    }</div>`;
  }, []);

  const openStop = useCallback(
    (stopPin) => stopPin && onStopClick?.(stopPin.id === selectedStopId ? null : stopPin),
    [onStopClick, selectedStopId]
  );

  const handlePointClick = useCallback(
    (d) => {
      if (d.kind === "stop") {
        openStop(d);
      } else if (d.kind === "custom") {
        onCustomPinClick(d.id === selectedCustomPinId ? null : d);
      } else {
        onPinClick(d.id === selectedLocationId ? null : d);
      }
    },
    [openStop, onCustomPinClick, onPinClick, selectedCustomPinId, selectedLocationId]
  );

  // Arcs of the selected stop's trip (else the selected pin's trips) stand
  // out; with nothing selected, all do.
  const selectedStopTripId = useMemo(
    () => stopPoints.find((p) => p.id === selectedStopId)?.tripId ?? null,
    [stopPoints, selectedStopId]
  );
  const arcColor = useCallback(
    (d) => {
      const lit = selectedStopTripId ? d.tripId === selectedStopTripId : !selectedCustomPinId || d.pinId === selectedCustomPinId;
      return lit ? [palette.arcFrom, palette.arcTo] : palette.arcDim;
    },
    [selectedStopTripId, selectedCustomPinId, palette]
  );

  const arcLabel = useCallback(
    (d) =>
      `<div class="globe-tooltip"><strong>${escapeHtml(d.tripTitle)}</strong><br/>${escapeHtml(stopPlace(d.from))} → ${escapeHtml(
        stopPlace(d.to)
      )}<br/>${escapeHtml(formatDateRange(d.from.startDate, d.to.endDate))}</div>`,
    []
  );

  const handleArcClick = useCallback(
    (d) => {
      if (!isPlacingPin) openStop(stopPoints.find((p) => p.id === `stop:${d.tripId}:${d.from.id}`));
    },
    [isPlacingPin, openStop, stopPoints]
  );

  // The dashes travel along each leg, start to end; still for reduced motion.
  const arcDashAnimateTime = useMemo(
    () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 3200),
    []
  );

  const handlePointHover = useCallback(
    (d) => {
      if (d && d.kind !== "photo") return; // only photo pins drive gallery filtering
      onPinHover(d ?? null);
    },
    [onPinHover]
  );

  const labelsData = useMemo(
    () => (labelMode === "always" ? combinedPins : []),
    [labelMode, combinedPins]
  );

  const labelText = useCallback(
    (d) => (d.kind === "custom" ? d.title : d.locationName),
    []
  );
  const labelColor = useCallback(
    (d) =>
      d.kind === "stop"
        ? palette.stopPin
        : isStoryPin(d)
        ? palette.blogPin
        : d.kind === "custom"
        ? palette.customPin
        : palette.pinColor,
    [palette]
  );

  useImperativeHandle(
    ref,
    () => ({
      coordsAtClientPoint(clientX, clientY) {
        const wrapper = wrapperRef.current;
        if (!globeEl.current || !wrapper) return null;
        // Only count points where the globe is actually the topmost thing —
        // not under the search bar, a popover, or scrolled off-screen.
        if (!wrapper.contains(document.elementFromPoint(clientX, clientY))) return null;
        const rect = wrapper.getBoundingClientRect();
        return globeEl.current.toGlobeCoords(clientX - rect.left, clientY - rect.top) ?? null;
      },
    }),
    []
  );

  const handleGlobeClick = useCallback(
    (coords) => {
      if (isPlacingPin) onPinDropAt({ lat: coords.lat, lng: coords.lng });
    },
    [isPlacingPin, onPinDropAt]
  );

  // Country polygons cover every landmass and swallow the globe click, so in
  // click mode a polygon/point click anchors the pin at its exact coordinate.
  const handlePolygonClick = useCallback(
    (feature, _event, coords) => {
      if (isPlacingPin) {
        if (coords) onPinDropAt({ lat: coords.lat, lng: coords.lng });
        return;
      }
      const iso2 = feature.properties.ISO_A2;
      if (!visitedCountryCodes.has(iso2)) return;
      const isDeselecting = iso2 === selectedCountryCode;
      onCountryClick(isDeselecting ? null : iso2, isDeselecting ? null : feature.properties.NAME);
    },
    [isPlacingPin, onPinDropAt, visitedCountryCodes, selectedCountryCode, onCountryClick]
  );

  const handlePointClickOrPlace = useCallback(
    (d, event, coords) => {
      if (isPlacingPin) {
        if (coords) onPinDropAt({ lat: coords.lat, lng: coords.lng });
        return;
      }
      handlePointClick(d);
    },
    [isPlacingPin, onPinDropAt, handlePointClick]
  );

  const droppedPinData = useMemo(() => (pendingPin ? [pendingPin] : []), [pendingPin]);

  return (
    <div
      className={`photo-globe-wrapper photo-globe-wrapper--${theme}${isPlacingPin ? " is-placing-pin" : ""}${
        panOnly ? " is-pan-only" : ""
      }`}
      ref={wrapperRef}
    >
      <Globe
        ref={globeEl}
        width={size.width}
        height={size.height}
        globeMaterial={globeMaterial}
        globeImageUrl={globeImageUrl}
        bumpImageUrl={BUMP_TEXTURE_URL}
        backgroundImageUrl={palette.backgroundImageUrl}
        backgroundColor="rgba(0, 0, 0, 0)"
        showAtmosphere={showAtmosphere}
        atmosphereColor={palette.atmosphereColor}
        atmosphereAltitude={palette.atmosphereAltitude}
        polygonsData={countries}
        polygonCapColor={polygonCapColor}
        polygonSideColor={() => palette.polygonSide}
        polygonStrokeColor={() => (showBorders ? palette.polygonStroke : false)}
        polygonAltitude={0.006}
        polygonLabel={polygonLabel}
        onPolygonClick={handlePolygonClick}
        onPolygonHover={(feature) => {
          const iso2 = feature?.properties?.ISO_A2;
          onCountryHover(
            iso2 && visitedCountryCodes.has(iso2) ? { code: iso2, name: feature.properties.NAME } : null
          );
        }}
        pointsData={combinedPins}
        pointLat="lat"
        pointLng="lng"
        pointColor={pointColor}
        pointRadius={pointRadius}
        pointAltitude={0.012}
        pointLabel={pointLabel}
        onPointClick={handlePointClickOrPlace}
        onPointHover={handlePointHover}
        arcsData={journeyArcs}
        arcStartLat={arcStartLat}
        arcStartLng={arcStartLng}
        arcEndLat={arcEndLat}
        arcEndLng={arcEndLng}
        arcColor={arcColor}
        arcStroke={0.45 * markerScale}
        arcAltitudeAutoScale={0.35}
        arcDashLength={0.5}
        arcDashGap={0.12}
        arcDashInitialGap={1}
        arcDashAnimateTime={arcDashAnimateTime}
        arcLabel={arcLabel}
        onArcClick={handleArcClick}
        arcsTransitionDuration={0}
        ringsData={photoPins}
        ringLat="lat"
        ringLng="lng"
        ringColor={ringColor}
        ringMaxRadius={2.4 * markerScale}
        ringPropagationSpeed={1.6}
        ringRepeatPeriod={1800}
        labelsData={labelsData}
        labelLat="lat"
        labelLng="lng"
        labelText={labelText}
        labelColor={labelColor}
        labelSize={1.1 * markerScale}
        labelDotRadius={0}
        labelAltitude={0.02}
        labelResolution={2}
        pathsData={showGrid ? GRATICULE : []}
        pathPoints={graticulePoints}
        pathPointLat={graticuleLat}
        pathPointLng={graticuleLng}
        pathPointAlt={0.008}
        pathColor={() => palette.gridColor}
        pathTransitionDuration={0}
        htmlElementsData={droppedPinData}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={0.01}
        htmlElement={createDroppedPinElement}
        htmlTransitionDuration={0}
        onGlobeClick={handleGlobeClick}
        onZoom={handleZoom}
        onGlobeReady={handleGlobeReady}
      />
    </div>
  );
}
