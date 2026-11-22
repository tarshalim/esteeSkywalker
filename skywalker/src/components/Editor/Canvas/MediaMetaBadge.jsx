import { MapPin, MapPinOff } from "lucide-react";
import { coordinateStatus, mediaSourceOf, readMediaMeta } from "../../../lib/mediaMeta";
import { formatCoords } from "../../../lib/geo";

const MIN_SIDE = 64; // canvas px: smaller pieces skip the badge rather than be covered by it

const STATUS = {
  exif: { cls: "bg-emerald-600/90 text-white", label: "GPS from file" },
  manual: { cls: "bg-sky-600/90 text-white", label: "Location set by hand" },
  missing: { cls: "bg-slate-900/70 text-amber-300", label: "No location" },
};

/**
 * Editor-only corner badge on a photo or clip showing whether it knows where
 * it was taken; tapping it selects the piece and opens its metadata inspector.
 * Not rendered in the reader (CanvasReadOnlyView doesn't use it).
 */
export default function MediaMetaBadge({ element, zoom, onOpen }) {
  if (!mediaSourceOf(element) || element.width < MIN_SIDE || element.height < MIN_SIDE) return null;
  const meta = readMediaMeta(element);
  const status = coordinateStatus(meta);
  const { cls, label } = STATUS[status];
  const where = status === "missing" ? "" : ` · ${meta.locationTitle || formatCoords(meta.lat, meta.lng)}`;
  const Icon = status === "missing" ? MapPinOff : MapPin;
  const size = 24 / zoom;

  return (
    <button
      type="button"
      className={`absolute z-10 flex items-center justify-center rounded-full shadow-md ring-1 ring-white/60 transition-opacity hover:opacity-100 ${cls}`}
      style={{ left: 6 / zoom, top: 6 / zoom, width: size, height: size, opacity: 0.88 }}
      title={`${label}${where} — media metadata`}
      aria-label={`Media metadata: ${label}${where}`}
      // Its own tap: not a drag of the piece, and not a second tap that starts typing into it.
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <Icon size={14 / zoom} strokeWidth={2.4} aria-hidden="true" />
    </button>
  );
}
