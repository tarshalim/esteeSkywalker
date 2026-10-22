import { Feather, Luggage } from "lucide-react";
import "./CoverPlaceholder.css";

// Paper tones per kind: kraft/parcel for trips, soft pastel stationery for stories.
const PALETTES = {
  trip: [
    ["#ead8b6", "#c9a46b"],
    ["#dfd0b2", "#a98a5e"],
    ["#d5ddc8", "#8fa58a"],
    ["#cdd6e0", "#7f95ad"],
  ],
  blog: [
    ["#fdf0c4", "#f8b4a6"],
    ["#dbe7fb", "#c9b8f5"],
    ["#d9f4e3", "#a9dfe8"],
    ["#fde3cc", "#f5bfd6"],
  ],
};

const ICONS = { trip: Luggage, blog: Feather };

function hash(str) {
  let h = 0;
  for (const ch of String(str ?? "")) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/**
 * Scrapbook-paper stand-in for a missing cover: a gradient picked
 * deterministically from `seed` (so a card keeps its colour) with a stamped
 * icon. `compact` drops the stamp ring for small thumbnails.
 *
 * @param {{ variant?: "trip"|"blog", seed?: string, compact?: boolean, className?: string }} props
 */
export default function CoverPlaceholder({ variant = "blog", seed = "", compact = false, className = "" }) {
  const palette = PALETTES[variant] ?? PALETTES.blog;
  const [from, to] = palette[hash(seed) % palette.length];
  const Icon = ICONS[variant] ?? Feather;

  return (
    <div
      className={`cover-ph cover-ph--${variant}${compact ? " is-compact" : ""} ${className}`}
      style={{ "--ph-from": from, "--ph-to": to }}
      aria-hidden="true"
    >
      <span className="cover-ph-stamp">
        <Icon size={compact ? 18 : 26} strokeWidth={1.6} />
      </span>
    </div>
  );
}
