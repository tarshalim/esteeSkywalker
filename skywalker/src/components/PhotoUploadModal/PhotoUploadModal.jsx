import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { fileToUrl } from "../../lib/files";
import { extractPhotoMetadata } from "../../lib/exif";
import { useCountriesGeoJson } from "../../hooks/useCountriesGeoJson";
import { findCountryForPoint, continentForCountryCode, centroidForCountryCode } from "../../utils/geo";
import { COUNTRY_TO_CONTINENT, countryCodeToFlagEmoji } from "../../utils/countries";
import { createPin, distanceKm, pinsNear } from "../../lib/pinStore";
import { saveTrip } from "../../lib/tripStore";
import { NEW_TRIP, emptyTripDraft, isWithinTrip, parseTags, validateTrip } from "../../lib/hierarchy";
import { formatDateRange } from "../../utils/dateFilters";
import CountrySelect from "../CountrySelect/CountrySelect";
import MediaView from "../MediaView/MediaView";
import TripSelect from "../TripPicker/TripSelect";
import { FIELD_INPUT, fieldInputStyle } from "../TripPicker/fieldStyles";
import "./PhotoUploadModal.css";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Location select value for "create a location at the photo's GPS spot". */
const NEW_LOCATION = "new";

/**
 * "+ Add Media" flow for the Gallery: picks a file, extracts EXIF date+GPS
 * client-side (src/lib/exif.js), reverse-geocodes GPS to a country via
 * point-in-polygon against countries.geojson (src/utils/geo.js), and falls
 * back to manual Country/Date input when EXIF/GPS is missing or absent.
 *
 * Then files it in the hierarchy: Location -> Trip -> standalone in the trip's
 * gallery, or attached to one of the trip's posts. A photo can also stay
 * unfiled. New locations/trips are created on submit.
 *
 * @param {{
 *   pins: import("../../types/hierarchy").Location[],
 *   trips: import("../../types/hierarchy").Trip[],
 *   blogs: import("../../types/hierarchy").BlogPost[],
 *   initialPinId?: ?string,
 *   initialTripId?: ?string,
 *   onClose: () => void,
 *   onSubmit: (photo: object) => Promise<void>,   // throws to keep the modal open
 * }} props
 */
export default function PhotoUploadModal({ pins = [], trips = [], blogs = [], initialPinId = null, initialTripId = null, onClose, onSubmit }) {
  const countries = useCountriesGeoJson();
  const fileInputRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [mediaType, setMediaType] = useState("image"); // "image" | "video"
  const [error, setError] = useState(null);
  const [coords, setCoords] = useState(null); // { lat, lng } | null
  const [country, setCountry] = useState(null); // { code, name } | null
  const [locationName, setLocationName] = useState("");
  const [locationTouched, setLocationTouched] = useState(false);
  const [date, setDate] = useState(() => trips.find((t) => t.id === initialTripId)?.startDate ?? todayISO());
  const [extracting, setExtracting] = useState(false);
  const [detectedNote, setDetectedNote] = useState(null);
  const [saving, setSaving] = useState(false);
  const [caption, setCaption] = useState("");
  const [tagsText, setTagsText] = useState("");

  // The cascade: location ("" unfiled | pin id | NEW_LOCATION) -> trip -> post.
  const [pinChoice, setPinChoice] = useState(initialPinId ?? trips.find((t) => t.id === initialTripId)?.locationId ?? "");
  const [pinTouched, setPinTouched] = useState(Boolean(initialPinId || initialTripId));
  const [tripChoice, setTripChoice] = useState(initialTripId ?? "");
  const [tripDraft, setTripDraft] = useState(() => emptyTripDraft());
  const [blogChoice, setBlogChoice] = useState(""); // "" = standalone in the trip gallery

  const continent = useMemo(
    () => (country ? continentForCountryCode(country.code, countries, COUNTRY_TO_CONTINENT) : ""),
    [country, countries]
  );

  // Nearest locations first once the photo's GPS is known.
  const pinOptions = useMemo(() => {
    if (!coords) return [...pins].sort((a, b) => a.title.localeCompare(b.title));
    return [...pins]
      .map((p) => ({ ...p, distanceKm: distanceKm(p, coords) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [pins, coords]);

  const tripOptions = useMemo(() => trips.filter((t) => t.locationId === pinChoice), [trips, pinChoice]);
  const selectedTrip = tripOptions.find((t) => t.id === tripChoice) ?? null;
  const tripPosts = useMemo(
    () => (selectedTrip ? blogs.filter((b) => b.tripId === selectedTrip.id) : []),
    [blogs, selectedTrip]
  );

  const choosePin = (value) => {
    setPinChoice(value);
    setPinTouched(true);
    setTripChoice("");
    setBlogChoice("");
  };

  const chooseTrip = (value) => {
    setTripChoice(value);
    setBlogChoice("");
    const trip = tripOptions.find((t) => t.id === value);
    // Photos belong to their trip's dates; an undated (EXIF-less) photo lands on its first day.
    if (trip && !isWithinTrip(trip, date)) setDate(trip.startDate);
    if (value === NEW_TRIP && !tripDraft.title) setTripDraft(emptyTripDraft(date));
  };

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    setDetectedNote(null);
    setError(null);
    let dataUrl, metadata;
    try {
      [dataUrl, metadata] = await Promise.all([fileToUrl(file), extractPhotoMetadata(file)]);
    } catch (err) {
      // Upload rejected (RLS, size, network) — previously left "Reading…" up forever.
      setError(`Upload failed: ${err.message}`);
      setExtracting(false);
      return;
    }
    setPreviewUrl(dataUrl);
    setMediaType(file.type.startsWith("video/") ? "video" : "image");

    const notes = [];
    if (metadata.dateTaken) {
      setDate(metadata.dateTaken.slice(0, 10));
      notes.push(`date ${metadata.dateTaken.slice(0, 10)}`);
    }
    if (metadata.lat != null && metadata.lng != null) {
      const point = { lat: metadata.lat, lng: metadata.lng };
      setCoords(point);
      // Suggest the location the photo was taken at, unless one was already chosen.
      if (!pinTouched) {
        const near = pinsNear(pins, point)[0];
        setPinChoice(near ? near.id : NEW_LOCATION);
        if (near) notes.push(`near ${near.title}`);
      }
      const match = countries.length > 0 ? findCountryForPoint(metadata.lat, metadata.lng, countries) : null;
      if (match) {
        setCountry({ code: match.code, name: match.name });
        if (!locationTouched) setLocationName(match.name);
        notes.push(match.name);
      }
    }
    setDetectedNote(notes.length > 0 ? `Detected from photo: ${notes.join(", ")}` : "No EXIF metadata found — fill in the details below.");
    setExtracting(false);
  };

  const tripBounds = selectedTrip ?? (tripChoice === NEW_TRIP ? tripDraft : null);
  const tripDraftError = tripChoice === NEW_TRIP ? validateTrip(tripDraft) : null;
  const dateError =
    tripBounds && !tripDraftError && date && !isWithinTrip(tripBounds, date)
      ? `The date taken must fall within the trip (${formatDateRange(tripBounds.startDate, tripBounds.endDate)})`
      : null;

  const handleSubmit = async () => {
    if (!previewUrl || !country || !date || tripDraftError || dateError) return;
    // No GPS: pin it at the country's centroid so it still shows on the globe.
    const point = coords ?? centroidForCountryCode(country.code, countries);
    setSaving(true);
    setError(null);
    try {
      let pinId = pinChoice || null;
      if (pinChoice === NEW_LOCATION) {
        const pin = await createPin({
          lat: point.lat,
          lng: point.lng,
          title: locationName.trim() || country.name,
          countryCode: country.code,
          countryName: country.name,
        });
        pinId = pin.id;
        setPinChoice(pin.id); // a retry reuses it
      }
      let tripId = pinId && tripChoice ? tripChoice : null;
      if (tripId === NEW_TRIP) {
        const trip = await saveTrip({ ...tripDraft, locationId: pinId });
        tripId = trip.id;
        setTripChoice(trip.id);
      }
      await onSubmit({
        type: mediaType,
        url: previewUrl,
        thumbUrl: mediaType === "image" ? previewUrl : null,
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
        countryCode: country.code,
        countryName: country.name,
        continent,
        locationName: locationName.trim() || country.name,
        timestamp: new Date(date).toISOString(),
        pinId,
        tripId,
        blogId: tripId && blogChoice ? blogChoice : null,
        caption: caption.trim(),
        tags: parseTags(tagsText),
      });
    } catch (err) {
      setError(`Couldn't save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = Boolean(previewUrl && country && date) && !tripDraftError && !dateError && !saving;
  const isNewLocation = pinChoice === NEW_LOCATION;

  // Portaled to <body> so the dialog layers above TopNav.
  return createPortal(
    <motion.div
      className="upload-modal-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="upload-modal glass-panel"
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Add a photo or video</h3>

        <div className="upload-modal-picker" onClick={() => fileInputRef.current?.click()}>
          {previewUrl ? (
            <MediaView item={{ type: mediaType, url: previewUrl }} alt="Selected upload preview" />
          ) : (
            <span>Click to choose an image or video</span>
          )}
          <input ref={fileInputRef} type="file" accept="image/*,video/*" hidden onChange={handleFilePick} />
        </div>

        {extracting && <p className="upload-modal-status">Reading photo metadata…</p>}
        {!extracting && detectedNote && <p className="upload-modal-status">{detectedNote}</p>}
        {error && <p className="upload-modal-status" role="alert">{error}</p>}

        <section className="upload-modal-cascade" aria-label="Where this belongs">
          <label className="upload-modal-field">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} aria-hidden="true" />
              Location
            </span>
            <select className={FIELD_INPUT} style={fieldInputStyle} value={pinChoice} onChange={(e) => choosePin(e.target.value)}>
              <option value="">Unfiled (no location)</option>
              {pinOptions.map((pin) => (
                <option key={pin.id} value={pin.id}>
                  {pin.title}
                  {pin.distanceKm != null && ` · ${pin.distanceKm < 1 ? "here" : `${Math.round(pin.distanceKm)} km`}`}
                </option>
              ))}
              {coords && <option value={NEW_LOCATION}>+ New location at this photo&rsquo;s spot</option>}
            </select>
          </label>

          {pinChoice && (
            <TripSelect
              trips={isNewLocation ? [] : tripOptions}
              value={tripChoice}
              onChange={chooseTrip}
              draft={tripDraft}
              onDraftChange={setTripDraft}
              draftError={tripDraftError}
              noneLabel="Not part of a trip"
            />
          )}

          {selectedTrip && (
            <label className="upload-modal-field">
              <span>Attach to</span>
              <select className={FIELD_INPUT} style={fieldInputStyle} value={blogChoice} onChange={(e) => setBlogChoice(e.target.value)}>
                <option value="">Standalone in the trip gallery</option>
                {tripPosts.map((post) => (
                  <option key={post.id} value={post.id}>
                    Story: {post.title}
                    {post.status === "draft" ? " (draft)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>

        <label className="upload-modal-field">
          <span>Country {!country && <em>(required)</em>}</span>
          <CountrySelect
            value={country}
            onChange={(next) => {
              setCountry(next);
              if (next && !locationTouched) setLocationName(next.name);
            }}
          />
        </label>

        <label className="upload-modal-field">
          <span>Date taken</span>
          <input
            type="date"
            value={date}
            min={tripBounds?.startDate}
            max={tripBounds?.endDate}
            onChange={(e) => setDate(e.target.value)}
            className="upload-modal-date"
            aria-invalid={Boolean(dateError)}
          />
          {dateError && (
            <em role="alert" className="text-red-600">
              {dateError}
            </em>
          )}
        </label>

        <label className="upload-modal-field">
          <span>Place name</span>
          <input
            type="text"
            value={locationName}
            placeholder="e.g. Shibuya, Tokyo"
            onChange={(e) => {
              setLocationTouched(true);
              setLocationName(e.target.value);
            }}
          />
        </label>

        <label className="upload-modal-field">
          <span>Caption</span>
          <input type="text" value={caption} placeholder="e.g. Lantern-lit alley after dinner" onChange={(e) => setCaption(e.target.value)} />
        </label>

        <label className="upload-modal-field">
          <span>Tags</span>
          <input type="text" value={tagsText} placeholder="e.g. street food, night" onChange={(e) => setTagsText(e.target.value)} />
        </label>

        {continent && (
          <p className="upload-modal-continent">
            🌐 {continent} · {countryCodeToFlagEmoji(country.code)} {country.name}
          </p>
        )}

        <div className="upload-modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="upload-modal-primary" disabled={!canSubmit} onClick={handleSubmit}>
            {saving ? "Adding…" : "Add to gallery"}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
