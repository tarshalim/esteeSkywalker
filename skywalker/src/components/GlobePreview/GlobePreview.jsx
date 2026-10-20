import PhotoGlobe from "../PhotoGlobe/PhotoGlobe";
import ErrorBoundary from "../ErrorBoundary/ErrorBoundary";
import { useGlobePrefs } from "../../lib/globePrefs";
import "./GlobePreview.css";

// Sample markers so the label/hover settings have something to show. Module
// constants keep references stable, so the globe never rebuilds its layers.
const SAMPLE_PINS = [
  { id: "preview-tokyo", lat: 35.68, lng: 139.69, title: "Tokyo" },
  { id: "preview-singapore", lat: 1.35, lng: 103.82, title: "Singapore" },
  { id: "preview-kathmandu", lat: 27.72, lng: 85.32, title: "Kathmandu" },
  { id: "preview-sydney", lat: -33.87, lng: 151.21, title: "Sydney" },
];
const NO_ITEMS = [];
const PREVIEW_VIEW = { lat: 10, lng: 115, altitude: 1.8 };
const noop = () => {};

/**
 * Miniature of the real PhotoGlobe for the Account page's display settings.
 * It reads the same GlobePrefs/Theme context, so every toggle shows here the
 * moment it's flipped — and it can't drift from what the full globe renders.
 */
export default function GlobePreview() {
  const { prefs } = useGlobePrefs();

  return (
    <figure className="globe-preview">
      <div className="globe-preview-stage">
        <ErrorBoundary fallback={<div className="globe-preview-fallback">Preview unavailable on this device.</div>}>
          <PhotoGlobe
            photos={NO_ITEMS}
            customPins={SAMPLE_PINS}
            selectedCountryCode={null}
            selectedLocationId={null}
            selectedCustomPinId={null}
            labelMode={prefs.labelMode}
            showBorders={prefs.showBorders}
            showGrid={prefs.showGrid}
            showAtmosphere={prefs.showAtmosphere}
            autoRotate={prefs.autoRotate}
            markerScale={6}
            initialView={PREVIEW_VIEW}
            isPlacingPin={false}
            onViewportChange={noop}
            onCountryClick={noop}
            onCountryHover={noop}
            onPinClick={noop}
            onPinHover={noop}
            onCustomPinClick={noop}
            onPinDropAt={noop}
          />
        </ErrorBoundary>
      </div>
      <figcaption className="globe-preview-caption">Live preview · drag to spin</figcaption>
    </figure>
  );
}
