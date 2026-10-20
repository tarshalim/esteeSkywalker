import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import Globe from "react-globe.gl";
import { clusterPhotosByLocation } from "../../utils/geo";
import { useCountriesGeoJson } from "../../hooks/useCountriesGeoJson";
import {
  createYellowBlueGlobeDataUrl,
  createCartographicOceanDataUrl,
} from "../../utils/proceduralGlobeTexture";
import { useTheme } from "../../lib/theme";
import "./PhotoGlobe.css";

const NIGHT_TEXTURE_URL = "/textures/earth-night.jpg";
const WATER_SPECULAR_URL = "/textures/earth-water.png";
const BUMP_TEXTURE_URL = "/textures/earth-topology.png";
const NIGHT_SKY_URL = "/textures/night-sky.png";
// Guaranteed-available yellow/blue vector globe, swapped in if the night
// texture ever fails to load so the globe can never render black.
const FALLBACK_TEXTURE_URL = createYellowBlueGlobeDataUrl();
const OCEAN_TEXTURE_URL = createCartographicOceanDataUrl();

// Light = crisp daylight atlas (opaque land polygons over a flat ocean);
// dark = deep space with glowing city lights, translucent borders and
// luminous markers so the night texture shows through.
const PALETTES = {
  light: {
    globeImageUrl: OCEAN_TEXTURE_URL,
    backgroundImageUrl: null,
    landColor: "#fefce8",
    visitedColor: "#3b82f6",
    selectedColor: "#facc15",
    polygonSide: "rgba(30, 64, 175, 0.35)",
    polygonStroke: "#1e3a8a",
    pinColor: "#1e40af",
    pinSelected: "#f59e0b",
    customPin: "#2563eb",
    customPinSelected: "#eab308",
    ringColor: "30, 64, 175",
    atmosphereColor: "#93c5fd",
    atmosphereAltitude: 0.16,
    ambient: [0xffffff, 2.2],
    key: [0xfff7e0, 1.4],
    rim: [0xbfdbfe, 1.2],
    emissiveIntensity: 0,
  },
  dark: {
    globeImageUrl: NIGHT_TEXTURE_URL,
    backgroundImageUrl: NIGHT_SKY_URL,
    landColor: "rgba(15, 23, 42, 0.08)",
    visitedColor: "rgba(96, 165, 250, 0.38)",
    selectedColor: "rgba(250, 204, 21, 0.6)",
    polygonSide: "rgba(96, 165, 250, 0.12)",
    polygonStroke: "rgba(147, 197, 253, 0.45)",
    pinColor: "#fde047",
    pinSelected: "#ffffff",
    customPin: "#7dd3fc",
    customPinSelected: "#fef9c3",
    ringColor: "253, 224, 71",
    atmosphereColor: "#3b82f6",
    atmosphereAltitude: 0.24,
    ambient: [0x8fa3c8, 0.9],
    key: [0xc7d8ff, 1.1],
    rim: [0x60a5fa, 3.0],
    emissiveIntensity: 1.1,
  },
};

const ZOOM_DEBOUNCE_MS = 150;

/**
 * Thin wrapper around react-globe.gl that owns only rendering + raw camera/click
 * events. All filtering/selection state lives in GlobeExplorer — this component
 * is a dumb view + event source so it stays easy to swap for Mapbox/Cesium later.
 */
export default function PhotoGlobe({
  photos,
  customPins,
  selectedCountryCode,
  selectedLocationId,
  selectedCustomPinId,
  labelMode,
  isPlacingPin,
  flyToTarget,
  onViewportChange,
  onCountryClick,
  onCountryHover,
  onPinClick,
  onPinHover,
  onCustomPinClick,
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
  const [globeImageUrl, setGlobeImageUrl] = useState(palette.globeImageUrl);

  // Never render a black globe: verify the theme's texture actually loads,
  // and fall back to the stylized yellow/blue vector texture if it errors.
  useEffect(() => {
    let cancelled = false;
    const url = palette.globeImageUrl;
    const img = new Image();
    img.onload = () => !cancelled && setGlobeImageUrl(url);
    img.onerror = () => !cancelled && setGlobeImageUrl(FALLBACK_TEXTURE_URL);
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [palette.globeImageUrl]);

  // Theme lighting. The key and rim lights ride on the camera so the face the
  // viewer sees is always lit (auto-rotate never swings into a dark side),
  // while the rim light sits behind the globe to edge the limb with a glow.
  useEffect(() => {
    const globe = globeEl.current;
    if (!isReady || !globe) return;
    const camera = globe.camera();
    const scene = globe.scene();
    if (camera.parent !== scene) scene.add(camera);

    globe.lights([new THREE.AmbientLight(...palette.ambient)]);
    const key = new THREE.DirectionalLight(...palette.key);
    key.position.set(-180, 160, 120);
    const rim = new THREE.DirectionalLight(...palette.rim);
    rim.position.set(60, 120, -900);
    camera.add(key, rim);

    // City lights: in dark mode the night texture doubles as an emissive
    // map so the lights glow regardless of scene lighting.
    const material = globe.globeMaterial();
    const loader = new THREE.TextureLoader();
    let disposed = false;
    material.shininess = theme === "dark" ? 12 : 4;
    material.emissive = new THREE.Color(theme === "dark" ? 0xffe8b0 : 0x000000);
    material.emissiveIntensity = palette.emissiveIntensity;
    if (theme === "dark") {
      loader.load(NIGHT_TEXTURE_URL, (tex) => {
        if (disposed) return tex.dispose();
        tex.colorSpace = THREE.SRGBColorSpace;
        material.emissiveMap = tex;
        material.needsUpdate = true;
      });
      loader.load(WATER_SPECULAR_URL, (tex) => {
        if (disposed) return tex.dispose();
        material.specularMap = tex;
        material.specular = new THREE.Color(0x3b5b8f);
        material.needsUpdate = true;
      });
    }
    material.needsUpdate = true;

    return () => {
      disposed = true;
      camera.remove(key, rim);
      key.dispose();
      rim.dispose();
      material.emissiveMap?.dispose();
      material.emissiveMap = null;
      material.specularMap?.dispose();
      material.specularMap = null;
      material.needsUpdate = true;
    };
  }, [isReady, theme, palette]);

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

  const visitedCountryCodes = useMemo(
    () => new Set(photos.map((p) => p.countryCode)),
    [photos]
  );

  const photoPins = useMemo(() => clusterPhotosByLocation(photos), [photos]);

  // Photo pins (from clustered photos) and custom annotation pins (from the
  // toolbox) share one react-globe.gl points layer, tagged by `kind` so click/
  // hover/color/label logic can dispatch to the right handler and dataset.
  const combinedPins = useMemo(
    () => [
      ...photoPins.map((pin) => ({ ...pin, kind: "photo" })),
      ...customPins.map((pin) => ({ ...pin, kind: "custom" })),
    ],
    [photoPins, customPins]
  );

  useEffect(() => {
    if (flyToTarget && globeEl.current) {
      globeEl.current.pointOfView(
        { lat: flyToTarget.lat, lng: flyToTarget.lng, altitude: 0.45 },
        1200
      );
    }
  }, [flyToTarget]);

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
    globeEl.current.pointOfView({ lat: 15, lng: 95, altitude: 2.1 }, 0);
    onViewportChange(globeEl.current.pointOfView());
    setIsReady(true);

    // Smooth continuous rotation with damped drag-to-rotate — no
    // pointermove/hover listeners drive the camera, only explicit drag.
    const controls = globeEl.current.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;
  }, [onViewportChange]);

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
      return `<div class="globe-tooltip"><strong>${feature.properties.NAME}</strong><br/>${
        count > 0 ? `${count} photo${count === 1 ? "" : "s"}` : "No photos yet"
      }</div>`;
    },
    [photos]
  );

  const pointColor = useCallback(
    (d) => {
      if (d.kind === "custom") {
        return d.id === selectedCustomPinId ? palette.customPinSelected : palette.customPin;
      }
      return d.id === selectedLocationId ? palette.pinSelected : palette.pinColor;
    },
    [selectedLocationId, selectedCustomPinId, palette]
  );

  // Pulsing halo under every photo pin so markers read at globe scale.
  const ringColor = useCallback(
    () => (t) => `rgba(${palette.ringColor}, ${Math.max(0, 1 - t) * 0.8})`,
    [palette]
  );

  const pointRadius = useCallback(
    (d) => (d.kind === "custom" ? 0.22 : Math.min(0.15 + d.photos.length * 0.03, 0.45)),
    []
  );

  const pointLabel = useCallback((d) => {
    if (d.kind === "custom") {
      return `<div class="globe-tooltip"><strong>${d.title}</strong>${d.note ? `<br/>${d.note}` : ""}</div>`;
    }
    return `<div class="globe-tooltip"><strong>${d.locationName}</strong><br/>${d.photos.length} photo${
      d.photos.length === 1 ? "" : "s"
    }</div>`;
  }, []);

  const handlePointClick = useCallback(
    (d) => {
      if (d.kind === "custom") {
        onCustomPinClick(d.id === selectedCustomPinId ? null : d);
      } else {
        onPinClick(d.id === selectedLocationId ? null : d);
      }
    },
    [onCustomPinClick, onPinClick, selectedCustomPinId, selectedLocationId]
  );

  const handlePointHover = useCallback(
    (d) => {
      if (d?.kind === "custom") return; // custom pins don't drive gallery filtering
      onPinHover(d ?? null);
    },
    [onPinHover]
  );

  const labelsData = useMemo(
    () => (labelMode === "always" ? combinedPins : []),
    [labelMode, combinedPins]
  );

  const labelText = useCallback((d) => (d.kind === "custom" ? d.title : d.locationName), []);
  const labelColor = useCallback(
    (d) => (d.kind === "custom" ? palette.customPin : palette.pinColor),
    [palette]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      if (!globeEl.current || !wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const coords = globeEl.current.toGlobeCoords(e.clientX - rect.left, e.clientY - rect.top);
      if (coords) onPinDropAt(coords);
    },
    [onPinDropAt]
  );

  const handleGlobeClick = useCallback(
    (coords) => {
      if (isPlacingPin) onPinDropAt(coords);
    },
    [isPlacingPin, onPinDropAt]
  );

  return (
    <div
      className={`photo-globe-wrapper photo-globe-wrapper--${theme}`}
      ref={wrapperRef}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <Globe
        ref={globeEl}
        width={size.width}
        height={size.height}
        globeImageUrl={globeImageUrl}
        bumpImageUrl={theme === "dark" ? BUMP_TEXTURE_URL : null}
        backgroundImageUrl={palette.backgroundImageUrl}
        backgroundColor="rgba(0, 0, 0, 0)"
        showAtmosphere
        atmosphereColor={palette.atmosphereColor}
        atmosphereAltitude={palette.atmosphereAltitude}
        polygonsData={countries}
        polygonCapColor={polygonCapColor}
        polygonSideColor={() => palette.polygonSide}
        polygonStrokeColor={() => palette.polygonStroke}
        polygonAltitude={0.006}
        polygonLabel={polygonLabel}
        onPolygonClick={(feature) => {
          const iso2 = feature.properties.ISO_A2;
          if (!visitedCountryCodes.has(iso2)) return;
          const isDeselecting = iso2 === selectedCountryCode;
          onCountryClick(isDeselecting ? null : iso2, isDeselecting ? null : feature.properties.NAME);
        }}
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
        onPointClick={handlePointClick}
        onPointHover={handlePointHover}
        ringsData={photoPins}
        ringLat="lat"
        ringLng="lng"
        ringColor={ringColor}
        ringMaxRadius={2.4}
        ringPropagationSpeed={1.6}
        ringRepeatPeriod={1800}
        labelsData={labelsData}
        labelLat="lat"
        labelLng="lng"
        labelText={labelText}
        labelColor={labelColor}
        labelSize={1.1}
        labelDotRadius={0}
        labelAltitude={0.02}
        labelResolution={2}
        onGlobeClick={handleGlobeClick}
        onZoom={handleZoom}
        onGlobeReady={handleGlobeReady}
      />
    </div>
  );
}
