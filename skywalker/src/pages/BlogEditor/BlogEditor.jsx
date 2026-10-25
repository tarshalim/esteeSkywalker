import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BookmarkPlus, Eye, LayoutTemplate, LoaderCircle, Send, Trash2 } from "lucide-react";
import { getBlogById, upsertBlog, deleteBlog, getTemplates, getTemplateById, saveTemplate, deleteTemplate } from "../../lib/blogStore";
import { normalizeTemplate } from "../../lib/templates";
import { useVibes } from "../../lib/vibes";
import { useTour } from "../../lib/tour";
import TemplateGallery from "./TemplateGallery";
import { CanvasProvider } from "../../components/Editor/Canvas/CanvasProvider";
import ScrapbookCanvas from "../../components/Editor/Canvas/ScrapbookCanvas";
import { createEmptyCanvasDoc } from "../../lib/canvasElements";
import { blocksToCanvas, canvasToBlocks, cloneCanvasDoc } from "../../lib/canvasConvert";
import { exportCanvasLayout, importCanvasLayout } from "../../lib/canvasLayout";
import CountrySelect from "../../components/CountrySelect/CountrySelect";
import { fileToUrl } from "../../lib/files";
import { extractPhotoMetadata } from "../../lib/exif";
import { useCountriesGeoJson } from "../../hooks/useCountriesGeoJson";
import { findCountryForPoint, continentForCountryCode, centroidForCountryCode, formatCoords, hasCoords } from "../../utils/geo";
import { realCover } from "../../lib/media";
import { COUNTRY_TO_CONTINENT } from "../../utils/countries";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import DeletePostDialog from "./DeletePostDialog";
import BackgroundMusicField from "./BackgroundMusicField";
import PostPreview from "./PostPreview";
import WeatherField from "./WeatherField";
import VibesField from "./VibesField";
import LocationField from "./LocationField";
import { cityFromPlaceName, reverseGeocode, searchPlaces } from "../../lib/geocode";
import { autoPinFor, createPin, getPinById, getPins } from "../../lib/pinStore";
import { getTripById, getTrips, saveTrip } from "../../lib/tripStore";
import { NEW_TRIP, companionsForPost, emptyTripDraft, isWithinTrip, validateTrip } from "../../lib/hierarchy";
import { formatDateRange } from "../../utils/dateFilters";
import TripSelect from "../../components/TripPicker/TripSelect";
import { useDataChanges } from "../../lib/liveSync";
import { deleteBlogAudio, getBlogMusic } from "../../lib/music";
import "./BlogEditor.css";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function BlogEditor() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [blogId, setBlogId] = useState(id ?? null);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState(""); // the summary shown on feed cards
  const [coverImage, setCoverImage] = useState("");
  const [locationName, setLocationName] = useState("");
  const [coords, setCoords] = useState(null); // { lat, lng } | null — what the globe pins
  // Resolved "Kyoto, Japan" for the picked coords; names a new pin on save.
  const [placeLabel, setPlaceLabel] = useState(null);
  const [pinChoice, setPinChoice] = useState("auto"); // see LocationField's PinChoice
  const [pins, setPins] = useState([]);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  // Step 2 of the cascade: the trip at the chosen location ("" none, an id, or NEW_TRIP).
  const [trips, setTrips] = useState([]);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const [tripId, setTripId] = useState("");
  const [tripDraft, setTripDraft] = useState(() => emptyTripDraft());
  // A location pick fills an empty Country once the country outlines are in.
  const countryFromCoordsRef = useRef(false);
  const [country, setCountry] = useState(null); // { code, name } | null
  const [startDate, setStartDate] = useState(todayISO());
  const [startDateTouched, setStartDateTouched] = useState(false);
  const [isDateRange, setIsDateRange] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [city, setCity] = useState("");
  const [vibes, setVibes] = useState([]);
  const [weather, setWeather] = useState(null); // see lib/weather.js
  // Bumped when a template sets the weather, so WeatherField re-reads its status.
  const [weatherKey, setWeatherKey] = useState(0);
  const { vibes: vibeList } = useVibes();
  const [music, setMusic] = useState(null);
  // A start/end time the music field can't save yet (e.g. end before start).
  const [musicTrimError, setMusicTrimError] = useState(null);
  // The track as last loaded/saved: its file must survive until a save replaces it.
  const savedMusicRef = useRef(null);
  const countries = useCountriesGeoJson();
  // The canvas owns its own state (CanvasProvider); the editor only seeds it
  // (bumping `key` remounts it with a new doc) and reads the latest doc back.
  const [canvasSeed, setCanvasSeed] = useState(() => ({ key: 0, doc: createEmptyCanvasDoc() }));
  const canvasDocRef = useRef(canvasSeed.doc);
  const [status, setStatus] = useState("draft");
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [loadState, setLoadState] = useState(isEditMode ? "loading" : "ready"); // loading | ready | missing | error
  const loadedIdRef = useRef(null);
  const toastTimer = useRef(null);
  const coverInputRef = useRef(null);
  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  const [exitError, setExitError] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  // Reader-mode preview: a snapshot of the post as it would save right now.
  const [preview, setPreview] = useState(null); // { blog, trip } | null
  // Unsaved-change tracking: the form fields are compared against a snapshot
  // taken at load/save; the canvas against the doc it first emitted after
  // being seeded (CanvasProvider reports its initial doc on mount).
  const fieldsBaselineRef = useRef(null);
  const canvasBaselineRef = useRef(null);
  // A template applied to an unsaved post is content even though it reseeds the canvas.
  const templateDirtyRef = useRef(false);

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch((err) => console.error("Failed to load templates", err));
  }, []);

  // The walkthrough opens the gallery to show it off, and closes it again.
  const showTourGallery = useTour().preview === "template-gallery";
  useEffect(() => setGalleryOpen(showTourGallery), [showTourGallery]);

  const loadPins = useCallback(() => {
    getPins()
      .then((list) => {
        setPins(list);
        setPinsLoaded(true);
      })
      .catch((err) => console.error("Failed to load pins", err));
  }, []);
  useEffect(loadPins, [loadPins]);
  useDataChanges(["locations"], loadPins);

  const loadTrips = useCallback(() => {
    getTrips()
      .then((list) => {
        setTrips(list);
        setTripsLoaded(true);
      })
      .catch((err) => console.error("Failed to load trips", err));
  }, []);
  useEffect(loadTrips, [loadTrips]);
  useDataChanges(["trips", "trip_companions", "trip_stops"], loadTrips);

  useEffect(() => {
    if (!countryFromCoordsRef.current || !coords || countries.length === 0) return;
    countryFromCoordsRef.current = false;
    if (country) return;
    const match = findCountryForPoint(coords.lat, coords.lng, countries);
    if (match) setCountry({ code: match.code, name: match.name });
  }, [coords, countries, country]);

  // Search pick, "Current location", globe pick — or null to clear. A new
  // point is re-matched to the nearest pin ("auto").
  const handleLocationPick = (place) => {
    setPinChoice("auto");
    if (!place) {
      setCoords(null);
      setPlaceLabel(null);
      return;
    }
    setCoords({ lat: place.lat, lng: place.lng });
    setPlaceLabel(place.placeName ?? null);
    // A search pick names the waypoint ("Gion"); GPS/globe only fill a blank one.
    if (place.label) setLocationName(place.label);
    else if (!locationName.trim() && place.placeName) setLocationName(place.placeName);
    countryFromCoordsRef.current = true;
  };

  useEffect(() => {
    if (isEditMode) {
      // Saving a new draft swaps the URL to /blogs/edit/:id; the editor is
      // already holding that post, so re-fetching would only clobber edits
      // typed since the save.
      if (id === loadedIdRef.current) return;
      let cancelled = false;
      fieldsBaselineRef.current = null;
      setLoadState("loading");
      getBlogById(id)
        .then((blog) => {
          if (cancelled) return;
          if (!blog) return setLoadState("missing");
          loadedIdRef.current = blog.id;
          setBlogId(blog.id);
          setTitle(blog.title ?? "");
          setExcerpt(blog.excerpt ?? "");
          setCoverImage(realCover(blog.coverImage));
          setLocationName(blog.location?.name || "");
          setCoords(hasCoords(blog.location) ? { lat: blog.location.lat, lng: blog.location.lng } : null);
          setPinChoice(blog.pinId ?? "auto");
          setTripId(blog.tripId ?? "");
          setCountry(blog.countryCode ? { code: blog.countryCode, name: blog.countryName || blog.countryCode } : null);
          setStartDate(blog.startDate || blog.postDate || blog.date || todayISO());
          setStartDateTouched(true);
          setIsDateRange(Boolean(blog.endDate));
          setEndDate(blog.endDate || "");
          setCity(blog.city || "");
          setVibes(blog.vibes ?? []);
          setWeather(blog.weather ?? null);
          savedMusicRef.current = getBlogMusic(blog);
          setMusic(savedMusicRef.current);
          seedCanvas(importCanvasLayout(blog.canvas) ?? blocksToCanvas(blog.blocks));
          setStatus(blog.status || "draft");
          setLoadState("ready");
        })
        .catch((err) => {
          console.error(err);
          if (!cancelled) setLoadState("error");
        });
      return () => {
        cancelled = true;
      };
    }
    const templateId = searchParams.get("template");
    if (templateId) {
      getTemplateById(templateId)
        .then(applyTemplate)
        .catch((err) => console.error("Failed to load template", err));
    }
    // "New story" from a globe pin's quick card: start at that pin, and in
    // that trip when it came from one (a trip implies its pin).
    const startAtPin = (pinId) =>
      getPinById(pinId)
        .then((pin) => {
          if (!pin) return;
          setCoords({ lat: pin.lat, lng: pin.lng });
          setPlaceLabel(pin.placeName ?? null);
          setLocationName((prev) => prev || pin.placeName || pin.title);
          setPinChoice(pin.id);
          countryFromCoordsRef.current = true;
        })
        .catch((err) => console.error("Failed to load pin", err));
    const pinId = searchParams.get("pin");
    const tripParam = searchParams.get("trip");
    if (pinId) startAtPin(pinId);
    if (tripParam) {
      getTripById(tripParam)
        .then((trip) => {
          if (!trip) return;
          applyTrip(trip);
          if (!pinId) startAtPin(trip.locationId);
        })
        .catch((err) => console.error("Failed to load trip", err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function seedCanvas(doc) {
    canvasDocRef.current = doc;
    canvasBaselineRef.current = null;
    setCanvasSeed((prev) => ({ key: prev.key + 1, doc }));
  }

  // A template replaces the scrapbook layout but only fills fields the writer
  // left empty: a typed title, summary or cover, chosen vibes and hand-set
  // weather all survive. (Previously a template without a title or cover
  // blanked the post's.)
  function applyTemplate(raw) {
    const tpl = normalizeTemplate(raw);
    if (!tpl) return;
    setTitle((prev) => (prev.trim() ? prev : tpl.title));
    setExcerpt((prev) => (prev.trim() ? prev : tpl.excerpt));
    setCoverImage((prev) => prev || tpl.coverImage);
    // Vibes the user has since deleted from their list would be invisible chips.
    const known = new Set(vibeList.map((v) => v.id));
    setVibes((prev) => [...new Set([...prev, ...tpl.vibes.filter((v) => known.has(v))])]);
    if (tpl.weather) {
      // A template's weather is a deliberate pick, so auto-sync mustn't overwrite it.
      setWeather((prev) => (prev?.source === "manual" ? prev : { ...tpl.weather, source: "manual" }));
      setWeatherKey((k) => k + 1);
    }
    seedCanvas(cloneCanvasDoc(tpl.canvas));
    templateDirtyRef.current = true;
  }

  const handleCanvasChange = useCallback((doc) => {
    canvasDocRef.current = doc;
    if (canvasBaselineRef.current === null) canvasBaselineRef.current = doc;
  }, []);

  // The pin a save would file under: the chosen one, the nearest ("auto"),
  // "new", or null when there's no exact spot / the post isn't pinned.
  const resolvedPinId = !coords || pinChoice === "none" ? null : pinChoice === "auto" ? autoPinFor(pins, coords) : pinChoice;
  // A trip lives at one location: only that location's trips are offered,
  // and a trip left behind by moving the post elsewhere no longer applies
  // (kept as-is until both lists have loaded, so a slow load can't drop it).
  const tripOptions = trips.filter((t) => t.locationId === resolvedPinId);
  const effectiveTripId =
    !pinsLoaded || !tripsLoaded || tripId === "" || (resolvedPinId && tripId === NEW_TRIP) || tripOptions.some((t) => t.id === tripId)
      ? tripId
      : "";
  const selectedTrip = tripOptions.find((t) => t.id === effectiveTripId) ?? null;
  const tripDisabledReason = !coords
    ? "Pick an exact location first"
    : pinChoice === "none"
    ? "Pin the story on the globe to add it to a trip"
    : null;

  // Picking a trip hands its dates to the story; the writer can narrow them to a day or a stretch.
  function applyTrip(trip) {
    setTripId(trip.id);
    setStartDate(trip.startDate);
    setStartDateTouched(true);
    const isRange = trip.endDate !== trip.startDate;
    setIsDateRange(isRange);
    setEndDate(isRange ? trip.endDate : "");
  }

  const handleTripChange = (value) => {
    const trip = tripOptions.find((t) => t.id === value);
    if (trip) return applyTrip(trip);
    setTripId(value);
    // A new trip starts from the story's own dates.
    if (value === NEW_TRIP && !tripDraft.title) setTripDraft(emptyTripDraft(startDate, isDateRange && endDate ? endDate : startDate));
  };

  // `pin`/`trip` let a save snapshot what it just resolved before that state lands.
  const fieldsSnapshot = (pin = pinChoice, trip = effectiveTripId) =>
    JSON.stringify([
      title,
      excerpt,
      coverImage,
      locationName,
      coords,
      pin,
      trip,
      trip === NEW_TRIP && tripDraft,
      country?.code,
      startDate,
      isDateRange && endDate,
      city,
      vibes,
      weather,
      music,
    ]);

  // Take the field baseline once the loaded post (or blank form) has rendered.
  useEffect(() => {
    if (loadState === "ready" && fieldsBaselineRef.current === null) fieldsBaselineRef.current = fieldsSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState]);

  const isDirty = () =>
    templateDirtyRef.current ||
    (fieldsBaselineRef.current !== null && fieldsSnapshot() !== fieldsBaselineRef.current) ||
    (canvasBaselineRef.current !== null && canvasDocRef.current !== canvasBaselineRef.current);

  const markClean = (pin, trip) => {
    fieldsBaselineRef.current = fieldsSnapshot(pin, trip);
    canvasBaselineRef.current = canvasDocRef.current;
    templateDirtyRef.current = false;
  };

  // Closing the tab or reloading can't show our dialog; fall back to the
  // browser's own "Leave site?" prompt. A ref keeps the listener current
  // without re-subscribing on every keystroke.
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isDirtyRef.current()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const showToast = (text) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const handleCoverPick = (e) => {
    loadCover(e.target.files?.[0]);
    e.target.value = ""; // so re-picking the same file fires onChange again
  };

  const handleCoverDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) loadCover(file);
  };

  const loadCover = async (file) => {
    if (!file) return;
    let dataUrl, metadata;
    try {
      [dataUrl, metadata] = await Promise.all([fileToUrl(file), extractPhotoMetadata(file)]);
    } catch (err) {
      console.error(err);
      showToast(`Couldn't upload cover image: ${err.message}`);
      return;
    }
    setCoverImage(dataUrl);
    const detected = applyPhotoMetadata(metadata);
    if (detected.length > 0) {
      showToast(`Detected from cover photo: ${detected.join(", ")} — feel free to change it`);
    }
  };

  // A photo taken live is stamped with the current GPS fix + time, so it
  // files the post under the right Location (auto pin from coords) and Trip
  // dates exactly like an EXIF'd cover photo does.
  // Fills the post's date/place from a photo placed on the canvas; quiet when there's nothing to fill.
  const handlePhotoAdded = async (file) => {
    const detected = applyPhotoMetadata(await extractPhotoMetadata(file));
    if (detected.length > 0) showToast(`📸 Detected from photo: ${detected.join(", ")}`);
  };

  /**
   * Auto-fills Country/Date/City/coords from a photo's EXIF, but never
   * clobbers a value the user already set (manually, from a previous upload,
   * or from loading an existing post). Returns what was filled in, for a toast.
   */
  const applyPhotoMetadata = (metadata) => {
    const detected = [];
    // Only a real capture date — a file's modified date is often just when it was downloaded.
    if (metadata.dateSource === "exif" && !startDateTouched) {
      setStartDate(metadata.dateTaken);
      detected.push(metadata.dateTaken);
    }
    if (metadata.lat != null && metadata.lng != null && !coords) {
      setCoords({ lat: metadata.lat, lng: metadata.lng });
    }
    if (metadata.lat != null && metadata.lng != null && !city.trim()) {
      // Best-effort City from the GPS; never overwrite one typed meanwhile.
      reverseGeocode(metadata.lat, metadata.lng).then((name) => {
        const found = cityFromPlaceName(name);
        if (found) setCity((prev) => prev || found);
      });
    }
    if (metadata.lat != null && metadata.lng != null && !country && countries.length > 0) {
      const match = findCountryForPoint(metadata.lat, metadata.lng, countries);
      if (match) {
        setCountry({ code: match.code, name: match.name });
        detected.push(match.name);
      }
    }
    return detected;
  };

  // Without lat/lng a post can never be pinned on, searched on, or deep-linked
  // to from the globe — fall back to the country's centroid.
  const resolveCoords = () => coords ?? (country ? centroidForCountryCode(country.code, countries) : null);

  // Where to look up the weather: the pinned point, else the typed city /
  // waypoint geocoded, else the country's centroid.
  // The country outlines load async; they only matter when the centroid is all we have.
  const centroidOnly = !coords && !city.trim() && !locationName.trim();
  const weatherPlaceKey = JSON.stringify([coords, city.trim(), locationName.trim(), country?.code, centroidOnly && countries.length > 0]);
  const resolveWeatherPoint = async (signal) => {
    if (coords) return coords;
    const place = city.trim() ? [city.trim(), country?.name].filter(Boolean).join(", ") : locationName.trim();
    if (place) {
      const [hit] = await searchPlaces(place, { signal });
      if (hit) return { lat: hit.lat, lng: hit.lng };
    }
    return country ? centroidForCountryCode(country.code, countries) : null;
  };

  // ISO yyyy-mm-dd strings compare correctly as plain strings.
  const dateRangeError = !isDateRange
    ? null
    : !endDate
    ? "Pick an end date for the trip"
    : endDate < startDate
    ? "End date can't be before the start date"
    : null;

  // A story inside a trip has to happen during it.
  const storyEnd = isDateRange && endDate ? endDate : startDate;
  const tripBounds = selectedTrip ?? (effectiveTripId === NEW_TRIP ? tripDraft : null);
  const tripDraftError = effectiveTripId === NEW_TRIP && !tripDisabledReason ? validateTrip(tripDraft) : null;
  const tripError =
    tripDraftError ??
    (tripBounds && !tripDisabledReason && !isWithinTrip(tripBounds, startDate, storyEnd)
      ? `Story dates must fall within the trip (${formatDateRange(tripBounds.startDate, tripBounds.endDate)})`
      : null);
  const storyCompanions = selectedTrip ? companionsForPost({ startDate, endDate: storyEnd }, selectedTrip) : [];

  const toggleDateRange = (on) => {
    setIsDateRange(on);
    if (on && !endDate) setEndDate(startDate);
  };

  const buildPayload = (nextStatus) => ({
    id: blogId ?? undefined,
    title: title.trim() || "Untitled Blog Post",
    excerpt: excerpt.trim(),
    // No stock fallback: an empty cover renders as a themed placeholder.
    coverImage,
    location: { name: locationName.trim() || country?.name || "Unnamed waypoint", ...resolveCoords() },
    countryCode: country?.code ?? "",
    countryName: country?.name ?? "",
    continent: country ? continentForCountryCode(country.code, countries, COUNTRY_TO_CONTINENT) : "",
    startDate: startDate || todayISO(),
    endDate: isDateRange && endDate ? endDate : null,
    city: city.trim(),
    vibes,
    weather,
    music,
    // Legacy field older readers use; also clears a stale one when music changes.
    audioUrl: music?.type === "upload" ? music.url : "",
    canvas: exportCanvasLayout(canvasDocRef.current),
    // Derived, so block-only consumers (Gallery media, excerpts) still work.
    blocks: canvasToBlocks(canvasDocRef.current),
    status: nextStatus,
  });

  // The pin this post is filed under: an exact location joins the chosen (or
  // nearest) pin, or creates one. Only real coordinates are pinned — never
  // the country-centroid fallback.
  const resolvePinId = async () => {
    if (!coords || pinChoice === "none") return null;
    const choice = pinChoice === "auto" ? autoPinFor(pins, coords) : pinChoice;
    if (choice !== "new") return choice;
    const pin = await createPin({
      countryCode: country?.code ?? "",
      countryName: country?.name ?? "",
      city: city.trim(),
      lat: coords.lat,
      lng: coords.lng,
      title:
        placeLabel ||
        locationName.trim() ||
        [city.trim(), country?.name].filter(Boolean).join(", ") ||
        formatCoords(coords.lat, coords.lng),
      placeName: placeLabel,
    });
    setPins((prev) => [...prev, pin]);
    return pin.id;
  };

  // The trip this post is filed under, creating a new one at `pinId` if asked.
  const resolveTripId = async (pinId) => {
    if (!pinId || !effectiveTripId) return null;
    if (effectiveTripId !== NEW_TRIP) return effectiveTripId;
    const trip = await saveTrip({ ...tripDraft, locationId: pinId });
    setTrips((prev) => [trip, ...prev]);
    return trip.id;
  };

  // Shared by draft + publish. Previously a rejected upsert (RLS, network)
  // left `saving` true — both buttons disabled for good, with no message.
  // `onError` lets a dialog show the failure itself instead of a toast.
  const persist = async (nextStatus, onError = showToast) => {
    if (dateRangeError || tripError) {
      onError(dateRangeError || tripError);
      return null;
    }
    if (musicTrimError) {
      onError(`Background music: ${musicTrimError}`);
      return null;
    }
    setSaving(true);
    try {
      const pinId = await resolvePinId();
      // Pin the choice down, so a retry after a failed save reuses a pin it
      // just created and later saves don't drift to a newer nearby pin.
      const nextPinChoice = pinId ?? pinChoice;
      setPinChoice(nextPinChoice);
      // Same for a trip it just created.
      const savedTripId = await resolveTripId(pinId);
      setTripId(savedTripId ?? "");
      const saved = await upsertBlog({ ...buildPayload(nextStatus), pinId, tripId: savedTripId });
      loadedIdRef.current = saved.id;
      setBlogId(saved.id);
      setStatus(saved.status);
      markClean(nextPinChoice, savedTripId ?? "");
      // The saved post no longer points at the previous upload, so its file can go.
      const previousMusic = savedMusicRef.current;
      savedMusicRef.current = music;
      if (previousMusic?.storagePath && previousMusic.storagePath !== music?.storagePath) {
        deleteBlogAudio(previousMusic.storagePath);
      }
      return saved;
    } catch (err) {
      console.error(err);
      onError(`Couldn't save: ${err.message}`);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const isPublished = status === "published";

  const handleBack = (e) => {
    if (!isDirty()) return; // let the <Link> navigate
    e.preventDefault();
    setExitPromptOpen(true);
  };

  // Editing a published post keeps it published; everything else becomes a draft.
  // A failed save keeps the dialog open with the reason, instead of closing it
  // and leaving the user on the editor with only a brief toast to explain why.
  const handleExitSave = async () => {
    setExitError(null);
    const saved = await persist(isPublished ? "published" : "draft", setExitError);
    if (saved) navigate(isPublished ? `/blogs/${saved.id}` : "/blogs/drafts");
  };

  // An upload that was never saved is orphaned once it's replaced, removed or discarded.
  const discardUnsavedUpload = (m) => {
    if (m?.storagePath && m.storagePath !== savedMusicRef.current?.storagePath) deleteBlogAudio(m.storagePath);
  };

  const handleMusicChange = (next) => {
    if (next?.storagePath !== music?.storagePath) discardUnsavedUpload(music);
    setMusic(next);
  };

  const handleExitDiscard = () => {
    discardUnsavedUpload(music);
    setExitPromptOpen(false);
    navigate("/blogs");
  };

  const closeExitPrompt = useCallback(() => {
    setExitPromptOpen(false);
    setExitError(null);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteOpen(false);
    setDeleteError(null);
  }, []);

  // The error stays inside the dialog so a retry is one click away.
  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBlog(blogId);
    } catch (err) {
      console.error(err);
      setDeleteError(`Couldn't delete this post: ${err.message}`);
      setDeleting(false);
      return;
    }
    // deleteBlog removed the saved track; an upload made since would be orphaned.
    discardUnsavedUpload(music);
    // Replace, so Back doesn't land on the editor of a post that no longer exists.
    navigate(isPublished ? "/blogs" : "/blogs/drafts", {
      replace: true,
      state: { flash: `Deleted “${title.trim() || "Untitled Blog Post"}”` },
    });
  };

  const handlePublish = async () => {
    if (!country) {
      showToast("Select a country before publishing");
      return;
    }
    const saved = await persist("published");
    if (saved) navigate(`/blogs/${saved.id}`);
  };

  // Built from the same payload a save sends, so the preview is the post as saved.
  const openPreview = () => {
    const trip = tripDisabledReason ? null : selectedTrip ?? (effectiveTripId === NEW_TRIP ? tripDraft : null);
    setPreview({ blog: buildPayload(status), trip });
  };
  const closePreview = useCallback(() => setPreview(null), []);

  const closeTemplateModal = () => {
    setShowTemplateModal(false);
    setTemplateName("");
    setTemplateDescription("");
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim() || savingTemplate) return;
    setSavingTemplate(true);
    try {
      const tpl = await saveTemplate({
        name: templateName.trim(),
        description: templateDescription.trim(),
        title,
        excerpt,
        coverImage,
        vibes,
        weather,
        canvas: exportCanvasLayout(canvasDocRef.current),
        blocks: canvasToBlocks(canvasDocRef.current),
      });
      setTemplates((prev) => [...prev, tpl]);
      closeTemplateModal();
      showToast(`Saved layout as “${tpl.name}”`);
    } catch (err) {
      showToast(`Couldn't save template: ${err.message}`);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleApplyTemplate = (tpl) => {
    if (
      canvasDocRef.current.elements.length > 0 &&
      !window.confirm(`Replace your scrapbook page with the “${tpl.name}” layout? Fields you've filled in are kept.`)
    )
      return;
    applyTemplate(tpl);
    setGalleryOpen(false);
    showToast(`Applied “${tpl.name}”`);
  };

  const handleDeleteTemplate = async (tpl) => {
    if (!window.confirm(`Delete the template “${tpl.name}”? Posts made from it aren't affected.`)) return;
    try {
      await deleteTemplate(tpl.id);
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
    } catch (err) {
      showToast(`Couldn't delete template: ${err.message}`);
    }
  };

  const closeGallery = useCallback(() => setGalleryOpen(false), []);

  if (loadState !== "ready") {
    return (
      <div className="editor-page">
        <div className="editor-canvas">
          {loadState === "loading" ? (
            <p>Loading post…</p>
          ) : (
            <p>
              {loadState === "missing" ? "That post doesn't exist." : "Couldn't load this post."}{" "}
              <Link to="/blogs">← Back to the journey</Link>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="editor-page">
      {/* Below sm the secondary actions collapse to icons (labels stay as
          tooltips/aria-labels); Publish keeps its text as the primary action. */}
      <div className="editor-topbar glass-panel">
        <Link
          to="/blogs"
          onClick={handleBack}
          className="editor-back"
          aria-label="Back to the journey"
          title="Back to the journey"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <span className="editor-topbar-label">
          {isEditMode ? `Editing · ${status === "draft" ? "Draft" : "Published"}` : "New Blog Post"}
        </span>
        <div className="editor-actions">
          <button
            className="editor-btn"
            data-tour="editor-templates"
            onClick={() => setGalleryOpen(true)}
            aria-label="Browse templates"
            title="Browse templates"
          >
            <LayoutTemplate size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Templates</span>
          </button>
          <button
            className="editor-btn"
            data-tour="editor-save-template"
            onClick={() => setShowTemplateModal(true)}
            aria-label="Save as Template"
            title="Save as Template"
          >
            <BookmarkPlus size={16} className="sm:hidden" aria-hidden="true" />
            <span className="hidden sm:inline">Save as Template</span>
          </button>
          <button
            className="editor-btn"
            onClick={openPreview}
            aria-label="Preview as a reader"
            title="Preview as a reader"
          >
            <Eye size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Preview</span>
          </button>
          <button className="editor-btn editor-btn-primary" onClick={handlePublish} disabled={saving || deleting}>
            <Send size={15} className="sm:hidden" aria-hidden="true" />
            Publish
          </button>
        </div>
      </div>

      <div className="editor-canvas">
        <div
          className="editor-cover"
          onClick={() => coverInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleCoverDrop}
        >
          {coverImage ? <img src={coverImage} alt="Cover" /> : <div className="editor-cover-empty">Click or drop to add a cover image</div>}
          <div className="editor-cover-overlay">Change cover image</div>
          <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={handleCoverPick} />
        </div>

        <input
          className="editor-title-input"
          placeholder="Untitled Blog Post"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="editor-summary-input"
          placeholder="Add a one-line summary for your story card (optional)"
          aria-label="Summary"
          rows={2}
          maxLength={200}
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
        />

        <LocationField
          name={locationName}
          onNameChange={setLocationName}
          coords={coords}
          onPick={handleLocationPick}
          pins={pins}
          pinChoice={pinChoice}
          onPinChoiceChange={setPinChoice}
          onError={showToast}
        />

        <div className="editor-trip-field">
          <TripSelect
            trips={tripOptions}
            value={effectiveTripId}
            onChange={handleTripChange}
            draft={tripDraft}
            onDraftChange={setTripDraft}
            draftError={tripDraftError}
            disabledReason={tripDisabledReason}
            noneLabel="Not part of a trip"
          />
          {tripError && !tripDraftError && (
            <span className="editor-field-error" role="alert">
              {tripError}
            </span>
          )}
          {storyCompanions.length > 0 && (
            <p className="editor-trip-companions">With {storyCompanions.join(", ")} on these dates</p>
          )}
        </div>

        <div className="editor-metadata">
          <div className="editor-metadata-field">
            <span className="editor-metadata-label">Country</span>
            <CountrySelect value={country} onChange={setCountry} />
          </div>
          <div className="editor-metadata-field">
            <label className="editor-metadata-label" htmlFor="editor-start-date">
              {isDateRange ? "Start date" : "Date"}
            </label>
            <input
              id="editor-start-date"
              type="date"
              className="editor-date-input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setStartDateTouched(true);
              }}
            />
            <label className="editor-range-toggle">
              <input type="checkbox" checked={isDateRange} onChange={(e) => toggleDateRange(e.target.checked)} />
              Date range
            </label>
          </div>
          {isDateRange && (
            <div className="editor-metadata-field">
              <label className="editor-metadata-label" htmlFor="editor-end-date">
                End date
              </label>
              <input
                id="editor-end-date"
                type="date"
                className="editor-date-input"
                min={startDate}
                value={endDate}
                aria-invalid={Boolean(dateRangeError)}
                aria-describedby={dateRangeError ? "editor-date-error" : undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
              {dateRangeError && (
                <span id="editor-date-error" className="editor-field-error" role="alert">
                  {dateRangeError}
                </span>
              )}
            </div>
          )}
          <div className="editor-metadata-field">
            <span className="editor-metadata-label">City</span>
            <input
              className="editor-date-input"
              placeholder="e.g. Kyoto"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
        </div>

        <WeatherField
          key={weatherKey}
          value={weather}
          onChange={setWeather}
          date={startDate}
          placeKey={weatherPlaceKey}
          resolvePoint={resolveWeatherPoint}
        />

        <VibesField value={vibes} onChange={setVibes} />

        <div data-tour="editor-music">
          <BackgroundMusicField
            value={music}
            onChange={handleMusicChange}
            onError={showToast}
            onTrimErrorChange={setMusicTrimError}
          />
        </div>

        <div className="editor-scrapbook" data-tour="editor-scrapbook">
          <CanvasProvider key={canvasSeed.key} initialDoc={canvasSeed.doc} onDocChange={handleCanvasChange}>
            <ScrapbookCanvas onError={showToast} onPhotoAdded={handlePhotoAdded} />
          </CanvasProvider>
        </div>

        {/* Only a saved post has anything to delete. */}
        {blogId && (
          <section
            aria-labelledby="editor-danger-title"
            className="mt-10 flex flex-col gap-3 rounded-2xl border-2 border-red-500/40 bg-red-500/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
          >
            <div className="min-w-0">
              <h2 id="editor-danger-title" className="text-sm font-bold uppercase tracking-wide text-red-600">
                Danger Zone
              </h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                Permanently delete this {isPublished ? "published post" : "draft"} along with the images and music only it uses.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={saving || deleting}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-red-600 px-5 text-sm font-bold text-red-600 transition-colors hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:h-10"
            >
              {deleting ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
              {deleting ? "Deleting…" : "Delete Post"}
            </button>
          </section>
        )}
      </div>

      <AnimatePresence>
        {galleryOpen && (
          <TemplateGallery
            savedTemplates={templates}
            onApply={handleApplyTemplate}
            onDelete={handleDeleteTemplate}
            onClose={closeGallery}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTemplateModal && (
          <motion.div className="editor-modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeTemplateModal}>
            <motion.div
              className="editor-modal glass-panel"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Save this layout as a template</h3>
              <p className="editor-modal-hint">
                Saves the scrapbook page plus the title, summary, cover, vibes and weather, ready to reuse from Templates.
              </p>
              <input
                autoFocus
                placeholder="Template name…"
                aria-label="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveAsTemplate()}
              />
              <input
                className="mt-2"
                placeholder="Short description (optional)"
                aria-label="Template description"
                maxLength={120}
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveAsTemplate()}
              />
              <div className="editor-modal-actions">
                <button onClick={closeTemplateModal}>Cancel</button>
                <button className="editor-btn-primary" onClick={handleSaveAsTemplate} disabled={!templateName.trim() || savingTemplate}>
                  {savingTemplate ? "Saving…" : "Save Template"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {exitPromptOpen && (
          <UnsavedChangesDialog
            saveLabel={isPublished ? "Save Changes" : "Save as Draft"}
            saving={saving}
            error={exitError}
            onSave={handleExitSave}
            onDiscard={handleExitDiscard}
            onCancel={closeExitPrompt}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteOpen && (
          <DeletePostDialog
            title={title.trim() || "Untitled Blog Post"}
            isPublished={isPublished}
            deleting={deleting}
            error={deleteError}
            onConfirm={handleDelete}
            onCancel={closeDeleteDialog}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {preview && <PostPreview blog={preview.blog} trip={preview.trip} onClose={closePreview} />}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="editor-toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
