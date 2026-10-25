import { useDeferredValue, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import PhotoGlobe from "../PhotoGlobe/PhotoGlobe";
import PhotoGallery from "../PhotoGallery/PhotoGallery";
import PhotoLightbox from "../PhotoLightbox/PhotoLightbox";
import PinDropButton from "../PinDropButton/PinDropButton";
import PinNamePopover from "../PinNamePopover/PinNamePopover";
import PinModeControls from "../PinModeControls/PinModeControls";
import ErrorBoundary from "../ErrorBoundary/ErrorBoundary";
import PinQuickCard from "../PinQuickCard/PinQuickCard";
import AttachStoriesDialog from "../PinQuickCard/AttachStoriesDialog";
import TripDialog from "../TripPicker/TripDialog";
import { getPhotos } from "../../lib/photoStore";
import { deleteTrip, getTrips, saveTrip } from "../../lib/tripStore";
import { allCompanions, tripContinents, tripCountries } from "../../lib/hierarchy";
import { getBlogs, setBlogsPin } from "../../lib/blogStore";
import * as pinStore from "../../lib/pinStore";
import { buildStoryPins, materializePin, pinsNear } from "../../lib/pinStore";
import { useDataChanges } from "../../lib/liveSync";
import { isPointInView, clusterPhotosByLocation, hasCoords } from "../../utils/geo";
import { useAuth } from "../../lib/auth";
import { useGlobePrefs } from "../../lib/globePrefs";
import { usePageSearch, useSearch } from "../../lib/search";
import { matchesQuery } from "../../utils/search";
import { useGlobeSearch } from "../../hooks/useGlobeSearch";
import { useLocation, useNavigate } from "react-router-dom";
import "./GlobeExplorer.css";

const HOVER_FLY_DEBOUNCE_MS = 250;
// On phones the quick card is a bottom sheet; aim the camera this many degrees
// south of a picked pin so the pin sits above the sheet instead of under it.
const SHEET_LAT_OFFSET_DEG = 3;

const reportLoadError = (what) => (err) => console.error(`Failed to load ${what}`, err);

/** "pin=…&trip=…" for the editor/gallery deep links that start inside a location (and trip). */
const hierarchyQuery = (pin, trip) => new URLSearchParams({ pin: pin.id, ...(trip && { trip: trip.id }) }).toString();

/**
 * State-owning container for the interactive globe experience — rendered
 * both embedded in the homepage (Landing.jsx, below the blog feed) and standalone
 * at /globe (MapTab.jsx), so the two never drift apart: same pins, data
 * sync, controls and display prefs. `variant` only affects outer sizing CSS.
 * Search always comes from the navbar (no search bar of its own).
 *
 * @param {"standalone"|"embedded"} variant
 * @param {boolean} searchActive - whether the navbar search currently drives
 *   this globe. The homepage turns it on only while the globe section is on
 *   screen, so the field keeps its default behaviour over the blog feed.
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
  searchActive = true,
}) {
  const [photos, setPhotos] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [customPins, setCustomPins] = useState([]);
  const [trips, setTrips] = useState([]);
  // Trip create/edit from the quick card: { trip: null } creates, { trip } edits.
  const [tripDialog, setTripDialog] = useState(null);

  const [viewport, setViewport] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null); // { code, name } | null
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [selectedCustomPinId, setSelectedCustomPinId] = useState(null);
  const [hoveredCountry, setHoveredCountry] = useState(null); // { code, name } | null
  const [hoveredLocationId, setHoveredLocationId] = useState(null);

  const [activePhotoId, setActivePhotoId] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  const [isPlacingPin, setIsPlacingPin] = useState(false);
  // { lat, lng, placeName? } — the red pin anchored on the globe while its
  // naming dialog is open. placeName is known when it came from the drag HUD
  // or a search pick; otherwise PinNamePopover resolves it.
  const [pendingPin, setPendingPin] = useState(null);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [cardBusy, setCardBusy] = useState(null); // label of the quick-card action in flight

  // Display settings live on the Account page; changes there apply here live.
  const { prefs } = useGlobePrefs();
  const { canEdit } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hoverFlyTimeoutRef = useRef(null);
  const globeRef = useRef(null);
  const stageRef = useRef(null);
  const handledFocusRef = useRef(null);

  // The whole hierarchy: locations -> trips -> posts and gallery items.
  // Real store, not the hard-coded mock: uploads used to never reach the globe.
  // Each source fails independently so one bad request doesn't blank the rest.
  const loadStories = useCallback(() => {
    getBlogs().then(setBlogs, reportLoadError("blogs"));
    pinStore.getPins().then(setCustomPins, reportLoadError("pins"));
    getTrips().then(setTrips, reportLoadError("trips"));
    getPhotos().then(setPhotos, reportLoadError("photos"));
  }, []);

  useEffect(loadStories, [loadStories]);

  // Publishing/editing a post or (un)linking it to a pin — here, in another
  // tab, or by another editor — refreshes the pins without a page reload.
  useDataChanges(["blogs", "locations", "trips", "trip_companions", "trip_stops", "gallery_items"], loadStories);

  useEffect(() => () => clearTimeout(hoverFlyTimeoutRef.current), []);

  const photoPins = useMemo(() => clusterPhotosByLocation(photos), [photos]);
  const blogsById = useMemo(() => new Map(blogs.map((b) => [b.id, b])), [blogs]);
  // Globe markers/search are a public showcase: published, geolocated posts only.
  const mappableBlogs = useMemo(
    () => blogs.filter((b) => b.status === "published" && hasCoords(b.location)),
    [blogs]
  );
  // Pins with their posts joined on. Editors also see drafts filed under a
  // pin (RLS already hides drafts from viewers on Supabase; this covers the
  // local mock). Unpinned posts only get a stand-in pin once published.
  const storyPins = useMemo(() => {
    const visible = canEdit ? blogs : blogs.filter((b) => b.status === "published");
    return buildStoryPins(customPins, visible, (b) => b.status === "published", { trips, photos });
  }, [customPins, blogs, canEdit, trips, photos]);
  // Stand-in pins are already searchable as their post.
  const searchablePins = useMemo(() => storyPins.filter((p) => !p.virtual), [storyPins]);
  const selectedStoryPin = useMemo(
    () => storyPins.find((p) => p.id === selectedCustomPinId) ?? null,
    [storyPins, selectedCustomPinId]
  );
  const pinTitles = useMemo(() => new Map(customPins.map((p) => [p.id, p.title])), [customPins]);

  // The navbar search drives this globe, hiding pins that don't match.
  const { query: navQuery, setQuery: setNavQuery } = useSearch();
  const pinQuery = useDeferredValue(searchActive ? navQuery.trim() : "");
  const visiblePhotos = useMemo(
    () => (pinQuery ? photos.filter((p) => matchesQuery(pinQuery, p.locationName, p.countryName, p.continent)) : photos),
    [photos, pinQuery]
  );
  const visibleCustomPins = useMemo(
    () =>
      pinQuery
        ? storyPins.filter((p) =>
            matchesQuery(
              pinQuery,
              p.title,
              p.placeName,
              p.note,
              p.posts.map((b) => b.title),
              p.trips.map((t) => [t.title, allCompanions(t), t.stops.map((s) => s.locationName), tripCountries(t), tripContinents(t)]),
              p.photos.map((ph) => [ph.caption, ph.tags])
            )
          )
        : storyPins,
    [storyPins, pinQuery]
  );
  // Multi-stop trips at the visible pins, drawn as journey arcs.
  const visibleJourneys = useMemo(
    () => visibleCustomPins.flatMap((pin) => pin.trips.filter((t) => t.stops?.length > 1).map((trip) => ({ trip, pinId: pin.id }))),
    [visibleCustomPins]
  );
  const visibleBlogs = useMemo(
    () =>
      pinQuery
        ? mappableBlogs.filter((b) => matchesQuery(pinQuery, b.title, b.location.name, b.countryName, b.city))
        : mappableBlogs,
    [mappableBlogs, pinQuery]
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

  // ...and open the quick card of the pin holding that post (once per request,
  // not again every time the pins reload).
  useEffect(() => {
    if (!focusRequest?.blogId || handledFocusRef.current === focusRequest) return;
    const hub = storyPins.find((p) => p.posts.some((b) => b.id === focusRequest.blogId));
    if (hub) {
      handledFocusRef.current = focusRequest;
      setSelectedCustomPinId(hub.id);
    }
  }, [focusRequest, storyPins]);

  const { filteredPhotos, filterLabel, hasManualFilter } = useMemo(() => {
    if (selectedLocationId) {
      const pin = photoPins.find((p) => p.id === selectedLocationId);
      return { filteredPhotos: pin?.photos ?? [], filterLabel: pin?.locationName ?? "Selected pin", hasManualFilter: true };
    }
    if (selectedCountry) {
      return {
        filteredPhotos: visiblePhotos.filter((p) => p.countryCode === selectedCountry.code),
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
        filteredPhotos: visiblePhotos.filter((p) => p.countryCode === hoveredCountry.code),
        filterLabel: `${hoveredCountry.name} (hover)`,
        hasManualFilter: false,
      };
    }
    return {
      filteredPhotos: viewport
        ? visiblePhotos.filter((p) => hasCoords(p) && isPointInView(viewport, p.lat, p.lng))
        : visiblePhotos,
      filterLabel: pinQuery ? `Matching “${pinQuery}”` : "Current view",
      hasManualFilter: false,
    };
  }, [visiblePhotos, pinQuery, photoPins, selectedLocationId, selectedCountry, hoveredLocationId, hoveredCountry, viewport]);

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

  const flyToPin = useCallback((pin) => {
    const isSheet = window.matchMedia("(max-width: 639px)").matches;
    setFlyTarget({ lat: pin.lat - (isSheet ? SHEET_LAT_OFFSET_DEG : 0), lng: pin.lng });
  }, []);

  // Selecting a pin opens its quick card and flies the camera to it.
  const selectStoryPin = useCallback(
    (pin) => {
      setSelectedCountry(null);
      setSelectedLocationId(null);
      setSelectedCustomPinId(pin?.id ?? null);
      if (pin) flyToPin(pin);
    },
    [flyToPin]
  );

  // PhotoGlobe already passes null when the selected pin is clicked again.
  const handleCustomPinClick = selectStoryPin;

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

  const handlePinDropAt = useCallback((coords, placeName = null) => {
    setPendingPin({ lat: coords.lat, lng: coords.lng, placeName });
    setIsPlacingPin(false);
  }, []);

  const goToSignIn = useCallback(
    () => navigate("/account", { state: { from: location.pathname } }),
    [navigate, location.pathname]
  );

  // Gate for every pin-placement path; viewers are sent to sign in.
  const canPlacePin = useCallback(() => {
    if (!canEdit) goToSignIn();
    return canEdit;
  }, [canEdit, goToSignIn]);

  const handleSearchSelect = useCallback((result) => {
    setFlyTarget({ lat: result.lat, lng: result.lng });
    if (result.kind === "place") {
      // World place from the geocoder: fly there and drop the pin. Viewers
      // who can't pin still get the flight.
      if (canEdit) handlePinDropAt(result, result.placeName);
    } else if (result.kind === "country") {
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
    } else if (result.kind === "trip") {
      // A trip opens its location's quick card.
      const hub = storyPins.find((p) => p.id === result.pinId);
      if (hub) selectStoryPin(hub);
    } else if (result.kind === "blog") {
      // A post opens the quick card of the pin it's filed under.
      const hub = storyPins.find((p) => p.posts.some((b) => b.id === result.blogId));
      if (hub) selectStoryPin(hub);
    }
  }, [canEdit, handlePinDropAt, storyPins, selectStoryPin]);

  // Trips are searchable by title and companions, each carrying its location.
  const searchableTrips = useMemo(
    () => searchablePins.flatMap((pin) => pin.trips.map((trip) => ({ ...trip, pin }))),
    [searchablePins]
  );
  const { localResults, placeResults, isPending } = useGlobeSearch(searchActive ? navQuery : "", {
    pins: photoPins,
    customPins: searchablePins,
    blogs: mappableBlogs,
    trips: searchableTrips,
  });
  const navResults = useMemo(
    () => [...localResults, ...placeResults.map((r) => ({ ...r, group: "Drop a pin at…" }))],
    [localResults, placeResults]
  );
  const handleNavSearchSelect = useCallback(
    (result) => {
      handleSearchSelect(result);
      // Keep the globe narrowed to what was picked; a geocoder place isn't
      // one of ours, so clear instead of hiding the pin about to be dropped.
      setNavQuery(result.kind === "place" ? "" : result.label);
    },
    [handleSearchSelect, setNavQuery]
  );
  usePageSearch({
    enabled: searchActive,
    placeholder: "Search pins & locations…",
    results: navResults,
    pending: isPending,
    onSelect: handleNavSearchSelect,
  });

  const coordsAtClientPoint = useCallback((x, y) => globeRef.current?.coordsAtClientPoint(x, y) ?? null, []);

  // The tour's "Name Your Pin" step opens the naming dialog on whatever the
  // globe is facing (detail: true) and closes it again on leaving the step.
  useEffect(() => {
    if (!canEdit) return;
    const onPreview = (e) => {
      if (!e.detail) {
        setPendingPin(null);
        return;
      }
      const r = stageRef.current?.getBoundingClientRect();
      const coords = r ? coordsAtClientPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
      setPendingPin({ ...(coords ?? { lat: 48.8566, lng: 2.3522 }), placeName: null });
    };
    window.addEventListener("tour:pin-preview", onPreview);
    return () => window.removeEventListener("tour:pin-preview", onPreview);
  }, [canEdit, coordsAtClientPoint]);

  // Draggable pin released at client (x, y): open the naming popover for that
  // coordinate, carrying the place name its HUD showed. Returns false (pin
  // snaps back) if it missed the globe.
  const handlePinDragDrop = useCallback(
    (x, y, placeName) => {
      const coords = coordsAtClientPoint(x, y);
      if (!coords) return false;
      if (canPlacePin()) handlePinDropAt(coords, placeName);
      return true;
    },
    [coordsAtClientPoint, canPlacePin, handlePinDropAt]
  );

  const handleToggleClickMode = useCallback(() => {
    if (canPlacePin()) setIsPlacingPin((prev) => !prev);
  }, [canPlacePin]);

  const handleLocated = useCallback(
    (coords) => {
      setFlyTarget(coords);
      handlePinDropAt(coords);
    },
    [handlePinDropAt]
  );

  // Step 1 of the cascade from the globe: the location, optionally with its
  // first trip (PinNamePopover's "Start a trip here").
  const handleCreatePin = useCallback(
    async ({ title, note, placeName, trip = null }) => {
      if (!pendingPin) return;
      try {
        const pin = await pinStore.createPin({ lat: pendingPin.lat, lng: pendingPin.lng, title, note, placeName });
        setCustomPins((prev) => [...prev, pin]);
        if (trip) {
          try {
            const saved = await saveTrip({ ...trip, locationId: pin.id });
            setTrips((prev) => [saved, ...prev]);
          } catch (err) {
            // The pin is saved; the trip can be added again from its card.
            console.error(err);
            window.alert(`Pin saved, but the trip couldn't be: ${err.message}`);
          }
        }
        setPendingPin(null);
        // Straight into its quick card: write a story here or attach some.
        selectStoryPin(pin);
      } catch (err) {
        console.error(err);
        window.alert(`Couldn't save pin: ${err.message}`);
      }
    },
    [pendingPin, selectStoryPin]
  );

  const handleCancelPendingPin = useCallback(() => setPendingPin(null), []);

  // A pin dropped on (or near) an existing hub offers that hub instead of a duplicate.
  const nearbyPin = useMemo(() => (pendingPin ? pinsNear(storyPins, pendingPin)[0] ?? null : null), [pendingPin, storyPins]);
  const handleUseNearbyPin = useCallback(() => {
    setPendingPin(null);
    selectStoryPin(nearbyPin);
  }, [nearbyPin, selectStoryPin]);

  // Quick-card actions. Each write notifies liveSync, which reloads the pins.
  const runCardAction = useCallback(async (label, action) => {
    setCardBusy(label);
    try {
      await action();
    } catch (err) {
      console.error(err);
      window.alert(`Couldn't update this pin: ${err.message}`);
    } finally {
      setCardBusy(null);
    }
  }, []);

  const handleOpenPost = useCallback((post) => navigate(`/blogs/${post.id}`), [navigate]);
  const handleCloseCard = useCallback(() => setSelectedCustomPinId(null), []);

  // Step 3 of the cascade: content at this location, inside `trip` when given.
  const handleNewStory = useCallback(
    (trip = null) =>
      runCardAction("Opening…", async () => {
        const pin = await materializePin(selectedStoryPin, setBlogsPin);
        navigate(`/blogs/new?${hierarchyQuery(pin, trip)}`);
      }),
    [runCardAction, selectedStoryPin, navigate]
  );

  const handleAddPhotos = useCallback(
    (trip = null) =>
      runCardAction("Opening…", async () => {
        const pin = await materializePin(selectedStoryPin, setBlogsPin);
        navigate(`/gallery?upload=1&${hierarchyQuery(pin, trip)}`);
      }),
    [runCardAction, selectedStoryPin, navigate]
  );

  // Trip dialog: throws back into the dialog so it can show the error.
  const handleSaveTrip = useCallback(
    async (draft) => {
      const pin = await materializePin(selectedStoryPin, setBlogsPin);
      const saved = await saveTrip({ ...(tripDialog?.trip ?? {}), ...draft, locationId: pin.id });
      setTrips((prev) => [saved, ...prev.filter((t) => t.id !== saved.id)]);
      setSelectedCustomPinId(pin.id);
      setTripDialog(null);
    },
    [selectedStoryPin, tripDialog]
  );

  const handleDeleteTrip = useCallback(async () => {
    const { trip } = tripDialog;
    await deleteTrip(trip.id);
    setTrips((prev) => prev.filter((t) => t.id !== trip.id));
    setTripDialog(null);
  }, [tripDialog]);

  const handleAttach = useCallback(
    (blogIds) => {
      setIsAttachOpen(false);
      runCardAction("Attaching…", async () => {
        const pin = await materializePin(selectedStoryPin, setBlogsPin);
        await setBlogsPin(blogIds, pin);
        setSelectedCustomPinId(pin.id);
      });
    },
    [runCardAction, selectedStoryPin]
  );

  const handleDetach = useCallback(
    (post) => runCardAction("Removing…", () => setBlogsPin([post.id], null)),
    [runCardAction]
  );

  return (
    <div className={`globe-explorer globe-explorer--${variant}${showGallery ? "" : " globe-explorer--no-gallery"}`}>
      <div ref={stageRef} className="globe-explorer-stage" data-tour="globe">
        <div className="globe-pin-dock" data-tour="pin-dock">
          <PinDropButton
            isPlacingPin={isPlacingPin}
            onTogglePlacingPin={handleToggleClickMode}
            onDropAt={handlePinDragDrop}
            coordsAt={coordsAtClientPoint}
          />
          <PinModeControls
            isClickMode={isPlacingPin}
            onToggleClickMode={handleToggleClickMode}
            canPlace={canPlacePin}
            onLocated={handleLocated}
          />
        </div>
        <ErrorBoundary
          resetKey={location.pathname}
          fallback={<div className="globe-explorer-fallback">The 3D globe couldn&rsquo;t load on this device.</div>}
        >
          <PhotoGlobe
            ref={globeRef}
            photos={visiblePhotos}
            customPins={visibleCustomPins}
            journeys={visibleJourneys}
            blogs={visibleBlogs}
            selectedCountryCode={selectedCountry?.code ?? null}
            selectedLocationId={selectedLocationId}
            selectedCustomPinId={selectedCustomPinId}
            labelMode={prefs.labelMode}
            showBorders={prefs.showBorders}
            showGrid={prefs.showGrid}
            showAtmosphere={prefs.showAtmosphere}
            autoRotate={prefs.autoRotate}
            isPlacingPin={isPlacingPin}
            pendingPin={pendingPin}
            flyToTarget={flyTarget}
            onViewportChange={setViewport}
            onCountryClick={handleCountryClick}
            onCountryHover={handleCountryHover}
            onPinClick={handlePinClick}
            onPinHover={handlePinHover}
            onCustomPinClick={handleCustomPinClick}
            onPinDropAt={handlePinDropAt}
          />
        </ErrorBoundary>
        <AnimatePresence>
          {selectedStoryPin && !pendingPin && (
            <PinQuickCard
              key={selectedStoryPin.id}
              pin={selectedStoryPin}
              canEdit={canEdit}
              busy={cardBusy}
              onClose={handleCloseCard}
              onOpenPost={handleOpenPost}
              onNewStory={handleNewStory}
              onAddPhotos={handleAddPhotos}
              onNewTrip={() => setTripDialog({ trip: null })}
              onEditTrip={(trip) => setTripDialog({ trip })}
              onAttach={() => setIsAttachOpen(true)}
              onDetach={handleDetach}
            />
          )}
        </AnimatePresence>
        {pendingPin && (
          <PinNamePopover
            key={`${pendingPin.lat}:${pendingPin.lng}`}
            coords={pendingPin}
            placeName={pendingPin.placeName}
            nearbyPin={nearbyPin}
            onConfirm={handleCreatePin}
            onCancel={handleCancelPendingPin}
            onUseExisting={handleUseNearbyPin}
          />
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
        {isAttachOpen && selectedStoryPin && (
          <AttachStoriesDialog
            pin={selectedStoryPin}
            blogs={blogs}
            pinTitles={pinTitles}
            onConfirm={handleAttach}
            onCancel={() => setIsAttachOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {tripDialog && selectedStoryPin && (
          <TripDialog
            trip={tripDialog.trip}
            locationTitle={selectedStoryPin.title}
            home={selectedStoryPin}
            onSave={handleSaveTrip}
            onDelete={tripDialog.trip ? handleDeleteTrip : null}
            onCancel={() => setTripDialog(null)}
          />
        )}
      </AnimatePresence>

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
