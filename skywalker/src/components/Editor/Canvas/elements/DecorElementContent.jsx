import { MapPin, Plane } from "lucide-react";
import EditableText from "./EditableText";

const WASHI_PATTERN = {
  "washi-stripe": "stripe",
  "washi-dots": "dots",
  "washi-grid": "grid",
  "washi-plain": "plain",
};

/** Washi tape, stamps, wax seals, paperclips, push pins and location badges. */
export default function DecorElementContent({ element, editing, actions }) {
  const { tint, decorId } = element;
  const text = (props) => <EditableText element={element} editing={editing} actions={actions} {...props} />;

  if (WASHI_PATTERN[decorId]) {
    return <div className={`sb-washi sb-washi--${WASHI_PATTERN[decorId]} w-full h-full`} style={{ "--tint": tint }} />;
  }

  switch (decorId) {
    case "stamp-postage":
      return (
        <div className="sb-stamp relative w-full h-full">
          <div
            className="absolute inset-[7px] flex flex-col border-2 p-[7%]"
            style={{ borderColor: tint, background: `color-mix(in srgb, ${tint} 9%, #fffdf7)`, color: tint }}
          >
            <div className="flex justify-between text-[10px] font-bold tracking-wider">
              <span>AIR MAIL</span>
              <span>50¢</span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <Plane className="h-[60%] w-[60%] -rotate-12" strokeWidth={1.5} />
            </div>
            {text({ placeholder: "Stamp text", className: "shrink-0 overflow-hidden" })}
          </div>
        </div>
      );

    case "stamp-seal":
      return (
        <div className="sb-seal relative flex w-full h-full items-center justify-center" style={{ "--tint": tint }}>
          <div className="sb-seal-ring pointer-events-none absolute inset-[17%] rounded-full" />
          {text({ placeholder: "A", className: "relative w-[60%] overflow-hidden [text-shadow:0_-1px_0_rgba(0,0,0,0.35)]" })}
        </div>
      );

    case "paperclip":
      return (
        <svg viewBox="0 0 28 70" preserveAspectRatio="none" className="w-full h-full drop-shadow-[1px_2px_1.5px_rgba(0,0,0,0.3)]">
          <path d="M18 20v34a5 5 0 0 1-10 0V12a8 8 0 0 1 16 0v42a11 11 0 0 1-22 0V22" fill="none" stroke={tint} strokeWidth="2.8" strokeLinecap="round" />
          <path d="M18 20v34a5 5 0 0 1-10 0V12a8 8 0 0 1 16 0v42" fill="none" stroke="white" strokeOpacity="0.45" strokeWidth="0.8" strokeLinecap="round" />
        </svg>
      );

    case "pushpin":
      return (
        <svg viewBox="0 0 54 60" className="w-full h-full overflow-visible">
          <ellipse cx="31" cy="57" rx="7" ry="2" fill="rgba(0,0,0,0.25)" />
          <line x1="27" y1="32" x2="29" y2="56" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="27" cy="33" rx="12" ry="4.5" fill={tint} />
          <ellipse cx="27" cy="33" rx="12" ry="4.5" fill="rgba(0,0,0,0.22)" />
          <circle cx="27" cy="20" r="15" fill={tint} />
          <circle cx="27" cy="20" r="15" fill="url(#sb-pin-shade)" />
          <circle cx="21" cy="14" r="4.5" fill="white" fillOpacity="0.5" />
          <defs>
            <radialGradient id="sb-pin-shade" cx="35%" cy="30%" r="75%">
              <stop offset="0.5" stopColor="black" stopOpacity="0" />
              <stop offset="1" stopColor="black" stopOpacity="0.3" />
            </radialGradient>
          </defs>
        </svg>
      );

    case "badge-location":
      return (
        <div className="relative flex w-full h-full items-center gap-2 rounded-full px-[7%] shadow-md" style={{ background: tint }}>
          <div className="pointer-events-none absolute inset-[4px] rounded-full border-2 border-dashed border-white/55" />
          <MapPin className="relative shrink-0 text-white" size={20} strokeWidth={2.5} />
          {text({ placeholder: "Place name", className: "relative min-w-0 flex-1 overflow-hidden whitespace-nowrap" })}
        </div>
      );

    default:
      return null;
  }
}
