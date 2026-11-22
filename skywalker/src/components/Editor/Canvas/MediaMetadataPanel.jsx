import { useEffect, useState } from "react";
import { Camera, Clock, MapPin, MapPinOff, Pencil } from "lucide-react";
import { coordinateStatus, editMediaMeta, mediaSourceOf, mediaTypeOf, readMediaMeta } from "../../../lib/mediaMeta";
import { formatCoords } from "../../../lib/geo";
import { cachedPlaceName, reverseGeocode } from "../../../lib/geocode";
import { formatDate } from "../../../lib/dateFilters";
import { formatFileSize } from "../../../lib/exif";

const STATUS_CHIP = {
  exif: { cls: "bg-emerald-500/20 text-emerald-300", text: "GPS from file" },
  manual: { cls: "bg-sky-500/20 text-sky-300", text: "Set by hand" },
  missing: { cls: "bg-amber-500/20 text-amber-300", text: "No location" },
};

const DATE_SOURCE = {
  exif: { text: "from file", title: "Read from the photo or clip's own capture date" },
  file: { text: "file date", title: "The file's last-modified date — may be when it was downloaded rather than taken" },
  manual: { text: "set by hand", title: "Entered in the editor" },
};

const inputCls =
  "h-8 w-full rounded-md border border-slate-600 bg-slate-800 px-2 text-[12px] text-slate-100 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none";

/** "Kyoto, Japan" for the photo's coordinates, looked up once and cached by lib/geocode. */
function usePlaceName(lat, lng) {
  const key = lat != null && lng != null ? `${lat},${lng}` : null;
  const [found, setFound] = useState({ key: null, name: null });
  useEffect(() => {
    if (!key || cachedPlaceName(lat, lng)) return;
    const ctrl = new AbortController();
    reverseGeocode(lat, lng, { signal: ctrl.signal })
      .then((name) => setFound({ key, name }))
      .catch(() => {}); // aborted
    return () => ctrl.abort();
  }, [key, lat, lng]);
  if (!key) return null;
  return cachedPlaceName(lat, lng) ?? (found.key === key ? found.name : null);
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-2">
      <Icon size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
        {children}
      </div>
    </div>
  );
}

const formFor = (meta) => ({
  locationTitle: meta?.locationTitle ?? "",
  lat: meta?.lat != null ? String(Number(meta.lat.toFixed(6))) : "",
  lng: meta?.lng != null ? String(Number(meta.lng.toFixed(6))) : "",
  dateTaken: meta?.dateTaken ?? "",
  timeTaken: meta?.timeTaken ?? "",
});

/**
 * "Media metadata" inspector for a photo or clip on the canvas: where it was
 * taken (coordinates, how they were found, a location title), when, and on
 * what camera — read from the file on upload, and editable by hand.
 * `onSave(mediaMeta)` stores the edited record on the element.
 */
export default function MediaMetadataPanel({ element, onSave }) {
  const meta = readMediaMeta(element);
  const src = mediaSourceOf(element);
  const mediaType = mediaTypeOf(element);
  const status = coordinateStatus(meta);
  const placeName = usePlaceName(meta?.lat ?? null, meta?.lng ?? null);
  const [form, setForm] = useState(null); // non-null while editing
  const [error, setError] = useState(null);

  const startEdit = () => {
    setForm(formFor(meta));
    setError(null);
  };
  const save = (values) => {
    const result = editMediaMeta(meta, { src, mediaType }, values);
    if (result.error) return setError(result.error);
    onSave(result.meta);
    setForm(null);
    setError(null);
  };
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const chip = STATUS_CHIP[status];
  const dateSource = meta?.dateTaken ? DATE_SOURCE[meta.dateSource] : null;
  const what = mediaType === "video" ? "clip" : "photo";

  return (
    <div className="flex w-[min(288px,calc(100vw-40px))] flex-col gap-2.5 text-slate-200" aria-label="Media metadata">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold">Media metadata</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${chip.cls}`}>{chip.text}</span>
      </div>

      {form ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(form);
          }}
        >
          <label className="flex flex-col gap-1 text-[11px] text-slate-400">
            Location title
            <input className={inputCls} value={form.locationTitle} onChange={set("locationTitle")} placeholder={placeName || "e.g. Fushimi Inari"} maxLength={120} autoFocus />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[11px] text-slate-400">
              Latitude
              <input className={inputCls} value={form.lat} onChange={set("lat")} placeholder="35.6895" inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-slate-400">
              Longitude
              <input className={inputCls} value={form.lng} onChange={set("lng")} placeholder="139.6917" inputMode="decimal" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-slate-400">
              Date taken
              <input type="date" className={`${inputCls} [color-scheme:dark]`} value={form.dateTaken} onChange={set("dateTaken")} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-slate-400">
              Time
              <input type="time" className={`${inputCls} [color-scheme:dark]`} value={form.timeTaken} onChange={set("timeTaken")} disabled={!form.dateTaken} />
            </label>
          </div>
          {error && (
            <p className="text-[11px] text-rose-300" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-1.5">
            <button type="button" className="rounded-md px-2.5 py-1 text-[12px] text-slate-300 hover:bg-slate-800" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button type="submit" className="rounded-md bg-blue-500 px-3 py-1 text-[12px] font-semibold text-white hover:bg-blue-400">
              Save
            </button>
          </div>
        </form>
      ) : (
        <>
          <Row icon={status === "missing" ? MapPinOff : MapPin} label="Location">
            {status === "missing" ? (
              <p className="text-[12px] text-slate-400">No coordinates in this {what}. Add them so it can be placed on the globe.</p>
            ) : (
              <>
                <p className="truncate text-[13px] font-medium" title={meta.locationTitle || placeName || undefined}>
                  {meta.locationTitle || placeName || "Untitled spot"}
                </p>
                <p className="text-[11px] tabular-nums text-slate-400">
                  {formatCoords(meta.lat, meta.lng)}
                  {meta.locationTitle && placeName ? ` · near ${placeName}` : ""}
                </p>
              </>
            )}
          </Row>

          <Row icon={Clock} label="Taken">
            {meta?.dateTaken ? (
              <p className="flex flex-wrap items-center gap-1.5 text-[13px]">
                {formatDate(meta.dateTaken)}
                {meta.timeTaken && <span className="tabular-nums text-slate-300">· {meta.timeTaken}</span>}
                {dateSource && (
                  <span className="rounded-full bg-slate-700/80 px-1.5 py-px text-[10px] text-slate-300" title={dateSource.title}>
                    {dateSource.text}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-[12px] text-slate-400">Unknown</p>
            )}
          </Row>

          {(meta?.camera || meta?.width || meta?.fileSize) && (
            <Row icon={Camera} label="File">
              {meta.camera && <p className="truncate text-[13px]">{meta.camera}</p>}
              <p className="text-[11px] tabular-nums text-slate-400">
                {[meta.width && meta.height ? `${meta.width} × ${meta.height}` : "", formatFileSize(meta.fileSize)].filter(Boolean).join(" · ")}
              </p>
            </Row>
          )}

          {!meta && <p className="text-[11px] text-slate-500">Nothing was read from this {what}&rsquo;s file (links and older uploads carry none). You can add details by hand.</p>}

          <div className="flex flex-wrap justify-end gap-1.5 border-t border-slate-700/80 pt-2">
            {status !== "missing" && (
              <button
                type="button"
                className="rounded-md px-2.5 py-1 text-[12px] text-slate-300 hover:bg-slate-800 hover:text-white"
                onClick={() => save({ ...formFor(meta), lat: "", lng: "" })}
              >
                Remove location
              </button>
            )}
            <button type="button" className="flex items-center gap-1 rounded-md bg-blue-500/25 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-blue-500/45" onClick={startEdit}>
              <Pencil size={12} aria-hidden="true" /> {meta ? "Edit details" : "Add details"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
