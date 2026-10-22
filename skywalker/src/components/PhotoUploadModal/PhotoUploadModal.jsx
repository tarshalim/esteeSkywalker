import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ImagePlus, MapPin } from "lucide-react";
import { fileToUrl } from "../../lib/files";
import { extractPhotoMetadata, formatFileSize } from "../../lib/exif";
import { cityFromPlaceName, reverseGeocode } from "../../lib/geocode";
import { useCountriesGeoJson } from "../../hooks/useCountriesGeoJson";
import { findCountryForPoint, continentForCountryCode, centroidForCountryCode } from "../../utils/geo";
import { COUNTRY_TO_CONTINENT, countryCodeToFlagEmoji } from "../../utils/countries";
import { createPin, distanceKm, pinsNear } from "../../lib/pinStore";
import { saveTrip } from "../../lib/tripStore";
import { NEW_TRIP, emptyTripDraft, isWithinTrip, parseTags, tripCovering, validateTrip } from "../../lib/hierarchy";
import { formatDate, formatDateRange } from "../../utils/dateFilters";
import CountrySelect from "../CountrySelect/CountrySelect";
import MediaView from "../MediaView/MediaView";
import TripSelect from "../TripPicker/TripSelect";
import Select from "../Select/Select";
import "./PhotoUploadModal.css";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Location select value for "create a location at the photo's GPS spot". */
const NEW_LOCATION = "new";

/**
 * Field-label marker for a value pre-filled from the file: "from photo" (+ Clear)
 * while untouched, or a Restore button once the user has changed it.
 */
function AutoFillHint({ value, auto, source, onClear, onRestore }) {
  if (auto == null || auto === "") return null;
  if (value === auto) {
    return (
      <span className="upload-modal-auto">
        <em>✨ from {source}</em>
        {onClear && (
          <button type="button" onClick={onClear}>
            Clear
          </button>
        )}
      </span>
    );
  }
  return (
    <span className="upload-modal-auto">
      <button type="button" onClick={onRestore} title={`Restore the value from the ${source}`}>
        ↺ Restore
      </button>
    </span>
  );
}

/**
 * "+ Add Media" flow for the Gallery: picks (or drops) a file, extracts EXIF
 * date/time, GPS and camera client-side (src/lib/exif.js), resolves GPS to a
 * country via point-in-polygon against countries.geojson (src/utils/geo.js)
 * and to a "City, Country" name via Photon (src/lib/geocode.js), and falls
 * back to manual Country/Date input when EXIF/GPS is missing or absent.
 *
 * Then files it in the hierarchy: Location -> Trip -> standalone in the trip's
 * gallery, or attached to one of the trip's posts. GPS + capture date pick the
 * nearest location and the trip covering that day; with no such trip, a
 * quick-create prompt offers one. A photo can also stay unfiled. New
 * locations/trips are created on submit.
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
  // Refs, not state: read inside the async EXIF/geocode callbacks after the user may have typed.
  const locationTouchedRef = useRef(false);
  const pickTokenRef = useRef(0); // ignores results from a file that was since replaced
  const [date, setDate] = useState(() => trips.find((t) => t.id === initialTripId)?.startDate ?? todayISO());
  const [time, setTime] = useState(""); // "HH:MM" | "" (unknown)
  const [camera, setCamera] = useState("");
  const [placeName, setPlaceName] = useState(null); // reverse-geocoded "Kyoto, Japan"
  const [exifFound, setExifFound] = useState(null); // { date, location } once a file is read
  const [fileInfo, setFileInfo] = useState(null); // { width, height, fileSize, gps, dateSource } of the picked file
  // Values pre-filled from the file, so each field can show "from photo" / Restore.
  const [autoFilled, setAutoFilled] = useState({});
  const [suggestDismissed, setSuggestDismissed] = useState(false);
  const [dragging, setDragging] = useState(false);
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

  const loadFile = async (file) => {
    if (!file) return;
    if (!/^(image|video)\//.test(file.type)) {
      setError("That file isn't an image or video.");
      return;
    }
    const token = ++pickTokenRef.current;
    setExtracting(true);
    setDetectedNote(null);
    setError(null);
    let dataUrl, metadata;
    try {
      [dataUrl, metadata] = await Promise.all([fileToUrl(file), extractPhotoMetadata(file)]);
    } catch (err) {
      if (token !== pickTokenRef.current) return;
      // Upload rejected (RLS, size, network) — previously left "Reading…" up forever.
      setError(`Upload failed: ${err.message}`);
      setExtracting(false);
      return;
    }
    if (token !== pickTokenRef.current) return;
    setPreviewUrl(dataUrl);
    setMediaType(file.type.startsWith("video/") ? "video" : "image");
    setCamera(metadata.camera ?? "");
    setPlaceName(null);
    setSuggestDismissed(false);

    const point = metadata.lat != null && metadata.lng != null ? { lat: metadata.lat, lng: metadata.lng } : null;
    const exifDate = metadata.dateSource === "exif";
    setFileInfo({
      width: metadata.width,
      height: metadata.height,
      fileSize: metadata.fileSize,
      gps: point,
      dateSource: metadata.dateSource,
    });
    setAutoFilled({
      date: metadata.dateTaken,
      time: metadata.timeTaken,
      dateSource: exifDate ? "photo" : "file date",
      camera: metadata.camera,
    });

    const notes = [];
    if (metadata.dateTaken) {
      setDate(metadata.dateTaken);
      setTime(metadata.timeTaken ?? "");
      notes.push(
        formatDate(metadata.dateTaken) + (metadata.timeTaken ? ` ${metadata.timeTaken}` : "") + (exifDate ? "" : " (file date)")
      );
    }

    setCoords(point);
    // Suggest the location the photo was taken at, unless one was already chosen.
    let targetPin = pinChoice;
    if (point && !pinTouched) {
      const near = pinsNear(pins, point)[0];
      targetPin = near ? near.id : NEW_LOCATION;
      if (near) notes.push(`near ${near.title}`);
    } else if (!point && pinChoice === NEW_LOCATION) {
      targetPin = ""; // "new location at this photo's spot" needs GPS
    }
    if (targetPin !== pinChoice) {
      setPinChoice(targetPin);
      setTripChoice("");
      setBlogChoice("");
    }
    // ...and the trip covering the day it was taken, unless one is already chosen there.
    // A file's modified date is often just when it was downloaded, so only a real capture date counts.
    if (exifDate && !(tripChoice && targetPin === pinChoice)) {
      const trip = tripCovering(trips, targetPin, metadata.dateTaken);
      if (trip) {
        setTripChoice(trip.id);
        notes.push(`trip “${trip.title}”`);
      }
    }

    if (point) {
      const match = countries.length > 0 ? findCountryForPoint(point.lat, point.lng, countries) : null;
      if (match) {
        const found = { code: match.code, name: match.name };
        setCountry(found);
        setAutoFilled((prev) => ({ ...prev, country: found, locationName: match.name }));
        if (!locationTouchedRef.current) setLocationName(match.name);
        notes.push(match.name);
      }
      // Refine the country to "City, Country" once Photon answers; best-effort.
      reverseGeocode(point.lat, point.lng).then((name) => {
        if (token !== pickTokenRef.current || !name) return;
        setPlaceName(name);
        setAutoFilled((prev) => ({ ...prev, locationName: name }));
        if (!locationTouchedRef.current) setLocationName(name);
      });
    }
    if (metadata.camera) notes.push(`📷 ${metadata.camera}`);

    setExifFound({ date: exifDate, location: Boolean(point) });
    const hasExif = exifDate || point || metadata.camera;
    setDetectedNote(
      hasExif
        ? `Detected from photo: ${notes.join(", ")}`
        : notes.length > 0
        ? `No EXIF metadata found — using the file's date (${notes.join(", ")}). Check the details below.`
        : "No EXIF metadata found — fill in the details below."
    );
    setExtracting(false);
  };

  // Ignore (or re-apply) the photo's GPS — e.g. it was taken somewhere other than where it belongs.
  const toggleGps = () => {
    const next = coords ? null : fileInfo?.gps ?? null;
    setCoords(next);
    setExifFound((prev) => ({ ...prev, location: Boolean(next) }));
    if (!next && pinChoice === NEW_LOCATION) choosePin("");
  };

  const handleFilePick = (e) => {
    loadFile(e.target.files?.[0]);
    e.target.value = ""; // so re-picking the same file fires onChange again
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    loadFile(e.dataTransfer.files?.[0]);
  };

  // "We found photos from Kyoto taken on May 12, 2026. Create a trip?"
  const suggestedCity = cityFromPlaceName(placeName) ?? placeName ?? country?.name ?? null;
  const showTripSuggestion =
    Boolean(exifFound?.location && exifFound?.date && suggestedCity && pinChoice) && tripChoice === "" && !suggestDismissed;

  const createSuggestedTrip = () => {
    setTripChoice(NEW_TRIP);
    setBlogChoice("");
    setTripDraft({ ...emptyTripDraft(date), title: `${suggestedCity} trip` });
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
          placeName,
          countryCode: country.code,
          countryName: country.name,
          city: cityFromPlaceName(placeName) ?? "",
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
        timeTaken: time || null,
        camera: camera.trim() || null,
        locationSource: exifFound?.location ? "exif" : "manual",
        width: fileInfo?.width ?? null,
        height: fileInfo?.height ?? null,
        fileSize: fileInfo?.fileSize ?? null,
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

        <div
          className={`upload-modal-picker ${dragging ? "is-dragging" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {previewUrl ? (
            <MediaView item={{ type: mediaType, url: previewUrl }} alt="Selected upload preview" />
          ) : (
            <span>{dragging ? "Drop it here" : "Click or drop an image or video"}</span>
          )}
          {previewUrl && exifFound && !extracting && (
            <div className="upload-modal-badges">
              <span className={`upload-modal-badge ${exifFound.location ? "is-auto" : country ? "" : "is-needed"}`}>
                {exifFound.location
                  ? "📍 Location auto-detected from EXIF"
                  : country
                  ? "✎ Location set manually"
                  : "Manual location required"}
              </span>
              <span className={`upload-modal-badge ${exifFound.date ? "is-auto" : ""}`}>
                {exifFound.date
                  ? "🕒 Date & time from EXIF"
                  : fileInfo?.dateSource === "file"
                  ? "🗂 Date from file — check it"
                  : "✎ Set the date manually"}
              </span>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*,video/*" hidden onChange={handleFilePick} />
        </div>

        {/* One native picker: on phones it already offers Take Photo / Photo Library / Browse. */}
        <div className="upload-modal-sources">
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={extracting}>
            <ImagePlus size={16} aria-hidden="true" /> Choose photo or video
          </button>
        </div>

        {extracting && <p className="upload-modal-status">Reading photo metadata…</p>}
        {!extracting && detectedNote && <p className="upload-modal-status">{detectedNote}</p>}
        {!extracting && previewUrl && fileInfo && (
          <ul className="upload-modal-meta" aria-label="File details">
            {fileInfo.width && (
              <li>
                📐 {fileInfo.width} × {fileInfo.height}
              </li>
            )}
            {fileInfo.fileSize && <li>💾 {formatFileSize(fileInfo.fileSize)}</li>}
            {fileInfo.gps && (
              <li className={coords ? "" : "is-off"}>
                📍 {fileInfo.gps.lat.toFixed(4)}, {fileInfo.gps.lng.toFixed(4)}
                <button type="button" onClick={toggleGps}>
                  {coords ? "Ignore GPS" : "Use GPS"}
                </button>
              </li>
            )}
          </ul>
        )}
        {error && <p className="upload-modal-status" role="alert">{error}</p>}

        {showTripSuggestion && (
          <div className="upload-modal-suggest" role="status">
            <p>
              We found a photo from <strong>{suggestedCity}</strong> taken on <strong>{formatDate(date, "long")}</strong>.
              Create a trip?
            </p>
            <div>
              <button type="button" className="upload-modal-primary" onClick={createSuggestedTrip}>
                Create trip
              </button>
              <button type="button" onClick={() => setSuggestDismissed(true)}>
                Not now
              </button>
            </div>
          </div>
        )}

        <section className="upload-modal-cascade" aria-label="Where this belongs">
          <label className="upload-modal-field">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} aria-hidden="true" />
              Location
            </span>
            <Select value={pinChoice} onChange={(e) => choosePin(e.target.value)}>
              <option value="">Unfiled (no location)</option>
              {pinOptions.map((pin) => (
                <option key={pin.id} value={pin.id}>
                  {pin.title}
                  {pin.distanceKm != null && ` · ${pin.distanceKm < 1 ? "here" : `${Math.round(pin.distanceKm)} km`}`}
                </option>
              ))}
              {coords && <option value={NEW_LOCATION}>+ New location at this photo&rsquo;s spot</option>}
            </Select>
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
              <Select value={blogChoice} onChange={(e) => setBlogChoice(e.target.value)}>
                <option value="">Standalone in the trip gallery</option>
                {tripPosts.map((post) => (
                  <option key={post.id} value={post.id}>
                    Story: {post.title}
                    {post.status === "draft" ? " (draft)" : ""}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </section>

        <label className="upload-modal-field">
          <span>
            Country {!country && <em>(required)</em>}
            <AutoFillHint
              value={country?.code}
              auto={autoFilled.country?.code}
              source="photo GPS"
              onRestore={() => {
                setCountry(autoFilled.country);
                if (!locationTouchedRef.current) setLocationName(autoFilled.locationName ?? autoFilled.country.name);
              }}
            />
          </span>
          <CountrySelect
            value={country}
            onChange={(next) => {
              setCountry(next);
              if (next && !locationTouchedRef.current) setLocationName(next.name);
            }}
          />
        </label>

        <label className="upload-modal-field">
          <span>
            Date taken
            <AutoFillHint
              value={date}
              auto={autoFilled.date}
              source={autoFilled.dateSource}
              onClear={() => setDate("")}
              onRestore={() => setDate(autoFilled.date)}
            />
          </span>
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
          <span>
            Time taken <em>(optional)</em>
            <AutoFillHint
              value={time}
              auto={autoFilled.time}
              source={autoFilled.dateSource}
              onClear={() => setTime("")}
              onRestore={() => setTime(autoFilled.time)}
            />
          </span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="upload-modal-date" />
        </label>

        <label className="upload-modal-field">
          <span>
            Place name
            <AutoFillHint
              value={locationName}
              auto={autoFilled.locationName}
              source="photo GPS"
              onClear={() => {
                locationTouchedRef.current = true;
                setLocationName("");
              }}
              onRestore={() => {
                locationTouchedRef.current = false;
                setLocationName(autoFilled.locationName);
              }}
            />
          </span>
          <input
            type="text"
            value={locationName}
            placeholder="e.g. Shibuya, Tokyo"
            onChange={(e) => {
              locationTouchedRef.current = true;
              setLocationName(e.target.value);
            }}
          />
        </label>

        <label className="upload-modal-field">
          <span>
            Camera <em>(optional)</em>
            <AutoFillHint
              value={camera}
              auto={autoFilled.camera}
              source="photo"
              onClear={() => setCamera("")}
              onRestore={() => setCamera(autoFilled.camera)}
            />
          </span>
          <input type="text" value={camera} placeholder="e.g. FUJIFILM X100V" onChange={(e) => setCamera(e.target.value)} />
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
