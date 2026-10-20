import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { fileToUrl } from "../../lib/files";
import { extractPhotoMetadata } from "../../lib/exif";
import { useCountriesGeoJson } from "../../hooks/useCountriesGeoJson";
import { findCountryForPoint, continentForCountryCode } from "../../utils/geo";
import { COUNTRY_TO_CONTINENT, countryCodeToFlagEmoji } from "../../utils/countries";
import CountrySelect from "../CountrySelect/CountrySelect";
import "./PhotoUploadModal.css";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "+ Add Photo" flow for the Gallery: picks a file, extracts EXIF date+GPS
 * client-side (src/lib/exif.js), reverse-geocodes GPS to a country via
 * point-in-polygon against countries.geojson (src/utils/geo.js), and falls
 * back to manual Country/Date input when EXIF/GPS is missing or absent.
 */
export default function PhotoUploadModal({ onClose, onSubmit }) {
  const countries = useCountriesGeoJson();
  const fileInputRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [coords, setCoords] = useState(null); // { lat, lng } | null
  const [country, setCountry] = useState(null); // { code, name } | null
  const [locationName, setLocationName] = useState("");
  const [locationTouched, setLocationTouched] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [extracting, setExtracting] = useState(false);
  const [detectedNote, setDetectedNote] = useState(null);
  const [saving, setSaving] = useState(false);

  const continent = useMemo(
    () => (country ? continentForCountryCode(country.code, countries, COUNTRY_TO_CONTINENT) : ""),
    [country, countries]
  );

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    setDetectedNote(null);
    const [dataUrl, metadata] = await Promise.all([fileToUrl(file), extractPhotoMetadata(file)]);
    setPreviewUrl(dataUrl);

    const notes = [];
    if (metadata.dateTaken) {
      setDate(metadata.dateTaken.slice(0, 10));
      notes.push(`date ${metadata.dateTaken.slice(0, 10)}`);
    }
    if (metadata.lat != null && metadata.lng != null && countries.length > 0) {
      setCoords({ lat: metadata.lat, lng: metadata.lng });
      const match = findCountryForPoint(metadata.lat, metadata.lng, countries);
      if (match) {
        setCountry({ code: match.code, name: match.name });
        if (!locationTouched) setLocationName(match.name);
        notes.push(match.name);
      }
    }
    setDetectedNote(notes.length > 0 ? `Detected from photo: ${notes.join(", ")}` : "No EXIF metadata found — fill in the details below.");
    setExtracting(false);
  };

  const handleSubmit = async () => {
    if (!previewUrl || !country || !date) return;
    setSaving(true);
    await onSubmit({
      url: previewUrl,
      thumbUrl: previewUrl,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      countryCode: country.code,
      countryName: country.name,
      continent,
      locationName: locationName.trim() || country.name,
      timestamp: new Date(date).toISOString(),
    });
    setSaving(false);
  };

  const canSubmit = Boolean(previewUrl && country && date) && !saving;

  return (
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
        <h3>Add a photo</h3>

        <div className="upload-modal-picker" onClick={() => fileInputRef.current?.click()}>
          {previewUrl ? (
            <img src={previewUrl} alt="Selected upload preview" />
          ) : (
            <span>Click to choose an image</span>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFilePick} />
        </div>

        {extracting && <p className="upload-modal-status">Reading photo metadata…</p>}
        {!extracting && detectedNote && <p className="upload-modal-status">{detectedNote}</p>}

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
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="upload-modal-date" />
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
            {saving ? "Adding…" : "Add photo"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
