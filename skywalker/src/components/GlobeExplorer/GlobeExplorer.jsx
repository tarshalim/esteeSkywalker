import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import PhotoGlobe from "../PhotoGlobe/PhotoGlobe";
import PhotoGallery from "../PhotoGallery/PhotoGallery";
import PhotoLightbox from "../PhotoLightbox/PhotoLightbox";
import GlobeSearchBar from "../GlobeSearchBar/GlobeSearchBar";
import PinToolbox from "../PinToolbox/PinToolbox";
import PinNamePopover from "../PinNamePopover/PinNamePopover";
import { getPhotos } from "../../lib/photoStore";
import { getBlogs } from "../../lib/blogStore";
import * as pinStore from "../../lib/pinStore";
import { isPointInView, clusterPhotosByLocation, hasCoords } from "../../utils/geo";
import { useNavbarHeight } from "../../hooks/useNavbarHeight";
import { useAuth } from "../../lib/auth";
import { useLocation, useNavigate } from "react-router-dom";
import "./GlobeExplorer.css";

const HOVER_FLY_DEBOUNCE_MS = 250;

/**
 * State-owning container for the interactive globe experience — rendered
 * both embedded in the homepage (Landing.jsx, below the hero) and standalone
 * at /maps (MapTab.jsx), so the two never drift apart. `variant` only
 * affects outer sizing CSS.
 *
 * @param {"standalone"|"embedded"} variant
 * @param {?{lat:number,lng:number,blogId?:string}} focusRequest - set by a
 *   blog's "back to the globe" link (BlogDetail -> Landing router state).
 * @param {boolean} showGallery - the homepage swaps the photo gallery for
 *   its blog feed, so it renders the globe alone.
 * @param {?function({countryCode:string,label:string}|null)} onFilterChange -
 *   reports the manual (click/search) globe selection as a country filter.
 * @param {number} clearSignal - bump to clear the selection from outside.
 */
export default function GlobeExplorer({
  variant = "standalone",
  focusRequest = null,
  showGallery = true,
  onFilterChange = null,
  clearSignal = 0,
}) {
  const [photos, setPhotos] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [customPins, setCustomPins] = useState([]);

  const [viewport, setViewport] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null); // { code, name } | null
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [selectedCustomPinId, setSelectedCustomPinId] = useState(null);
  const [hoveredCountry, setHoveredCountry] = useState(null); // { code, name } | null
  const [hoveredLocationId, setHoveredLocationId] = useState(null);

  const [activePhotoId, setActivePhotoId] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  const [labelMode, setLabelMode] = useState("hover");
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [pendingPinCoords, setPendingPinCoords] = useState(null);

  const navbarHeight = useNavbarHeight();
  const { canEdit } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hoverFlyTimeoutRef = useRef(null);

  // Real store, not the hard-coded mock: uploads used to never reach the globe.
  // Each source fails independently so one bad request doesn't blank the rest.
  useEffect(() => {
    const report = (what) => (err) => console.error(`Failed to load ${what}`, err);
    getPhotos().then(setPhotos, report("photos"));
    getBlogs().then(setBlogs, report("blogs"));
    pinStore.getPins().then(setCustomPins, report("pins"));
  }, []);

  useEffect(() => () => clearTimeout(hoverFlyTimeoutRef.current), []);

  const photoPins = useMemo(() => clusterPhotosByLocation(photos), [photos]);
  const blogsById = useMemo(() => new Map(blogs.map((b) => [b.id, b])), [blogs]);
  // Globe markers/search are a public showcase: published, geolocated posts only.
  const mappableBlogs = useMemo(
    () => blogs.filter((b) => b.status === "published" && hasCoords(b.location)),
    [blogs]
  );

  // Blog -> globe deep link: fly to the blog's coordinate on arrival.
  useEffect(() => {
    if (focusRequest) setFlyTarget({ lat: focusRequest.lat, lng: focusRequest.lng });
  }, [focusRequest]);

  // ...and once photos have loaded, pre-select the pin linked to that blog so
  // the gallery arrives filtered. (This used to run only on mount, while
  // `photos` was still [], so it never matched.)
  useEffect(() => {
    if (!focusRequest?.blogId) return;
    const pin = photoPins.find((p) => p.photos.some((photo) => photo.blogId === focusRequest.blogId));
    if (pin) {
      setSelectedCountry(null);
      setSelectedLocationId(pin.id);
    }
  }, [focusRequest, photoPins]);

  const { filteredPhotos, filterLabel, hasManualFilter } = useMemo(() => {
    if (selectedLocationId) {
      const pin = photoPins.find((p) => p.id === selectedLocationId);
      return { filteredPhotos: pin?.photos ?? [], filterLabel: pin?.locationName ?? "Selected pin", hasManualFilter: true };
    }
    if (selectedCountry) {
      return {
        filteredPhotos: photos.filter((p) => p.countryCode === selectedCountry.code),
        filterLabel: selectedCountry.name,
        hasManualFilter: true,
      };
    }
    if (hoveredLocationId) {
      const pin = photoPins.find((p) => p.id === hoveredLocationId);
      if (pin) {
        return { filteredPhotos: pin.photos, filterLabel: `${pin.locationName} (hover)`, hasManualFilter: false };
      }
    }
    if (hoveredCountry) {
      return {
        filteredPhotos: photos.filter((p) => p.countryCode === hoveredCountry.code),
        filterLabel: `${hoveredCountry.name} (hover)`,
        hasManualFilter: false,
      };
    }
    return {
      filteredPhotos: viewport ? photos.filter((p) => hasCoords(p) && isPointInView(viewport, p.lat, p.lng)) : photos,
      filterLabel: "Current view",
      hasManualFilter: false,
    };
  }, [photos, photoPins, selectedLocationId, selectedCountry, hoveredLocationId, hoveredCountry, viewport]);

  useEffect(() => {
    if (!onFilterChange) return;
    if (selectedCountry) {
      onFilterChange({ countryCode: selectedCountry.code, label: selectedCountry.name });
      return;
    }
    const pin = selectedLocationId ? photoPins.find((p) => p.id === selectedLocationId) : null;
    const countryCode = pin?.photos[0]?.countryCode;
    onFilterChange(countryCode ? { countryCode, label: pin.photos[0].countryName ?? pin.locationName } : null);
  }, [onFilterChange, selectedCountry, selectedLocationId, photoPins]);

  // Photos stay pre-joined with their linked blog here so PhotoGallery/
  // PhotoLightbox stay pure view components with no store imports.
  const photosWithBlog = useMemo(
    () => filteredPhotos.map((p) => ({ ...p, blog: p.blogId ? blogsById.get(p.blogId) ?? null : null })),
    [filteredPhotos, blogsById]
  );

  const handleCountryClick = useCallback((code, name) => {
    setSelectedLocationId(null);
    setSelectedCustomPinId(null);
    setSelectedCountry((prev) => (prev?.code === code ? null : code ? { code, name } : null));
  }, []);

  const handlePinClick = useCallback((pin) => {
    setSelectedCountry(null);
    setSelectedCustomPinId(null);
    setSelectedLocationId((prev) => (prev === pin?.id ? null : pin?.id ?? null));
  }, []);

  const handleCustomPinClick = useCallback((pin) => {
    setSelectedCountry(null);
    setSelectedLocationId(null);
    setSelectedCustomPinId((prev) => (prev === pin?.id ? null : pin?.id ?? null));
  }, []);

  const handleClearFilter = useCallback(() => {
    setSelectedCountry(null);
    setSelectedLocationId(null);
    setSelectedCustomPinId(null);
  }, []);

  useEffect(() => {
    if (clearSignal) handleClearFilter();
  }, [clearSignal, handleClearFilter]);

  const handleCountryHover = useCallback((country) => setHoveredCountry(country), []);
  const handlePinHover = useCallback((pin) => setHoveredLocationId(pin?.id ?? null), []);

  const flyToDebounced = useCallback((coords) => {
    if (hoverFlyTimeoutRef.current) clearTimeout(hoverFlyTimeoutRef.current);
    hoverFlyTimeoutRef.current = setTimeout(() => setFlyTarget(coords), HOVER_FLY_DEBOUNCE_MS);
  }, []);

  // Gallery -> globe sync (requirement 4b): hovering or scrolling to a photo
  // flies the camera there. Ignores `null` so the camera doesn't snap back
  // the instant the mouse leaves the grid.
  const handlePhotoFlyTo = useCallback(
    (photo) => {
      if (!hasCoords(photo)) return;
      flyToDebounced({ lat: photo.lat, lng: photo.lng });
    },
    [flyToDebounced]
  );

  const handlePhotoClick = useCallback((photo) => {
    setActivePhotoId(photo.id);
    if (hasCoords(photo)) setFlyTarget({ lat: photo.lat, lng: photo.lng });
    setLightboxPhoto(photo);
  }, []);

  const handleSearchSelect = useCallback((result) => {
    setFlyTarget({ lat: result.lat, lng: result.lng });
    if (result.kind === "country") {
      setSelectedLocationId(null);
      setSelectedCustomPinId(null);
      setSelectedCountry({ code: result.code, name: result.label });
    } else if (result.kind === "pin") {
      setSelectedCountry(null);
      setSelectedCustomPinId(null);
      setSelectedLocationId(result.id);
    } else if (result.kind === "customPin") {
      setSelectedCountry(null);
      setSelectedLocationId(null);
      setSelectedCustomPinId(result.id);
    }
    // "blog" results just fly the camera; they aren't a globe filter tier.
  }, []);

  const handleToggleLabelMode = useCallback(() => {
    setLabelMode((prev) => (prev === "hover" ? "always" : "hover"));
  }, []);

  const handlePinDropAt = useCallback((coords) => {
    setPendingPinCoords(coords);
    setIsPlacingPin(false);
  }, []);

  const handleCreatePin = useCallback(
    async ({ title, note }) => {
      if (!pendingPinCoords) return;
      try {
        const pin = await pinStore.createPin({ ...pendingPinCoords, title, note });
        setCustomPins((prev) => [...prev, pin]);
        setPendingPinCoords(null);
      } catch (err) {
        console.error(err);
        window.alert(`Couldn't save pin: ${err.message}`);
      }
    },
    [pendingPinCoords]
  );

  const handleCancelPendingPin = useCallback(() => setPendingPinCoords(null), []);

  const handleBlogClick = useCallback((blog) => navigate(`/blogs/${blog.id}`), [navigate]);

  return (
    <div
      className={`globe-explorer globe-explorer--${variant}${showGallery ? "" : " globe-explorer--no-gallery"}`}
      style={{ paddingTop: navbarHeight }}
    >
      <div className="globe-explorer-stage">
        <GlobeSearchBar pins={photoPins} customPins={customPins} blogs={mappableBlogs} onSelect={handleSearchSelect} />
        <PinToolbox
          labelMode={labelMode}
          onToggleLabelMode={handleToggleLabelMode}
          isPlacingPin={isPlacingPin}
          onTogglePlacingPin={() =>
            canEdit
              ? setIsPlacingPin((prev) => !prev)
              : navigate("/account", { state: { from: location.pathname } })
          }
        />
        <PhotoGlobe
          photos={photos}
          customPins={customPins}
          blogs={mappableBlogs}
          selectedCountryCode={selectedCountry?.code ?? null}
          selectedLocationId={selectedLocationId}
          selectedCustomPinId={selectedCustomPinId}
          labelMode={labelMode}
          isPlacingPin={isPlacingPin}
          flyToTarget={flyTarget}
          onViewportChange={setViewport}
          onCountryClick={handleCountryClick}
          onCountryHover={handleCountryHover}
          onPinClick={handlePinClick}
          onPinHover={handlePinHover}
          onCustomPinClick={handleCustomPinClick}
          onPinDropAt={handlePinDropAt}
          onBlogClick={handleBlogClick}
        />
        {pendingPinCoords && (
          <PinNamePopover onConfirm={handleCreatePin} onCancel={handleCancelPendingPin} />
        )}
      </div>

      {showGallery && (
        <div className="globe-explorer-gallery">
          <PhotoGallery
            photos={photosWithBlog}
            filterLabel={filterLabel}
            activePhotoId={activePhotoId}
            onClearFilter={hasManualFilter ? handleClearFilter : null}
            onPhotoClick={handlePhotoClick}
            onPhotoHover={handlePhotoFlyTo}
            onPhotoInView={handlePhotoFlyTo}
          />
        </div>
      )}

      <AnimatePresence>
        {lightboxPhoto && (
          <PhotoLightbox
            photo={{ ...lightboxPhoto, blog: lightboxPhoto.blogId ? blogsById.get(lightboxPhoto.blogId) ?? null : null }}
            onClose={() => setLightboxPhoto(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
