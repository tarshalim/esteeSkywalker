// Sticker catalog for the blog canvas. Every decorative visual element in the
// editor — hand-drawn illustrations, emoji, and image-frame stickers — is
// called a "Sticker" in the UI. This file is the single source of truth: add
// a sticker here and it shows up in the drawer automatically.

// Cute single-stroke line-art, viewBox 0 0 64 64, drawn with currentColor so
// StickerElementContent can tint them. Kept intentionally simple/consistent.
const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const NATURE_STICKERS = [
  {
    id: "mountain",
    label: "Mountain",
    render: (p) => (
      <svg viewBox="0 0 64 64" {...p}>
        <path {...strokeProps} d="M4 52 24 20l10 14 6-8 20 26z" />
        <path {...strokeProps} d="M18 40l6-8 5 6" />
      </svg>
    ),
  },
  {
    id: "sun",
    label: "Sun",
    render: (p) => (
      <svg viewBox="0 0 64 64" {...p}>
        <circle {...strokeProps} cx="32" cy="32" r="12" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line
            key={a}
            {...strokeProps}
            x1={32 + Math.cos((a * Math.PI) / 180) * 18}
            y1={32 + Math.sin((a * Math.PI) / 180) * 18}
            x2={32 + Math.cos((a * Math.PI) / 180) * 26}
            y2={32 + Math.sin((a * Math.PI) / 180) * 26}
          />
        ))}
      </svg>
    ),
  },
  {
    id: "cloud",
    label: "Cloud",
    render: (p) => (
      <svg viewBox="0 0 64 64" {...p}>
        <path {...strokeProps} d="M14 42a10 10 0 0 1-2-19.8A13 13 0 0 1 37 16a11 11 0 0 1 13 15.6A9 9 0 0 1 48 42z" />
      </svg>
    ),
  },
  {
    id: "tree",
    label: "Tree",
    render: (p) => (
      <svg viewBox="0 0 64 64" {...p}>
        <path {...strokeProps} d="M32 58V36" />
        <path {...strokeProps} d="M32 10 18 32h9L16 46h32L37 32h9z" />
      </svg>
    ),
  },
  {
    id: "flower",
    label: "Flower",
    render: (p) => (
      <svg viewBox="0 0 64 64" {...p}>
        <circle {...strokeProps} cx="32" cy="26" r="5" />
        {[0, 72, 144, 216, 288].map((a) => (
          <circle
            key={a}
            {...strokeProps}
            cx={32 + Math.cos((a * Math.PI) / 180) * 11}
            cy={26 + Math.sin((a * Math.PI) / 180) * 11}
            r="7"
          />
        ))}
        <path {...strokeProps} d="M32 40v18" />
      </svg>
    ),
  },
  {
    id: "river",
    label: "River",
    render: (p) => (
      <svg viewBox="0 0 64 64" {...p}>
        <path {...strokeProps} d="M4 24c8-8 12 8 20 0s12 8 20 0 12 8 16 0" />
        <path {...strokeProps} d="M4 40c8-8 12 8 20 0s12 8 20 0 12 8 16 0" />
      </svg>
    ),
  },
  {
    id: "footprints",
    label: "Footprints",
    render: (p) => (
      <svg viewBox="0 0 64 64" {...p}>
        <ellipse {...strokeProps} cx="20" cy="22" rx="5" ry="8" />
        <ellipse {...strokeProps} cx="40" cy="40" rx="5" ry="8" />
      </svg>
    ),
  },
  {
    id: "arrow",
    label: "Arrow",
    render: (p) => (
      <svg viewBox="0 0 64 64" {...p}>
        <path {...strokeProps} d="M8 32h44" />
        <path {...strokeProps} d="M40 18l14 14-14 14" />
      </svg>
    ),
  },
  {
    id: "polaroid-outline",
    label: "Polaroid",
    render: (p) => (
      <svg viewBox="0 0 64 64" {...p}>
        <rect {...strokeProps} x="10" y="8" width="44" height="48" rx="2" />
        <path {...strokeProps} d="M18 18h28v22H18z" />
      </svg>
    ),
  },
  {
    id: "airplane",
    label: "Airplane",
    render: (p) => (
      <svg viewBox="0 0 64 64" {...p}>
        <path {...strokeProps} d="M6 34l52-16-16 52-6-20-20-6z" />
      </svg>
    ),
  },
  {
    id: "compass",
    label: "Compass",
    render: (p) => (
      <svg viewBox="0 0 64 64" {...p}>
        <circle {...strokeProps} cx="32" cy="32" r="22" />
        <path {...strokeProps} d="M40 24l-6 16-10-4 6-16z" />
      </svg>
    ),
  },
  {
    id: "suitcase",
    label: "Suitcase",
    render: (p) => (
      <svg viewBox="0 0 64 64" {...p}>
        <rect {...strokeProps} x="8" y="22" width="48" height="32" rx="4" />
        <path {...strokeProps} d="M24 22v-6a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v6" />
        <path {...strokeProps} d="M8 36h48" />
      </svg>
    ),
  },
  {
    id: "heart",
    label: "Heart",
    render: (p) => (
      <svg viewBox="0 0 64 64" {...p}>
        <path {...strokeProps} d="M32 52C14 40 6 30 6 20a12 12 0 0 1 22-6 12 12 0 0 1 22 6c0 10-8 20-26 32z" />
      </svg>
    ),
  },
  {
    id: "grass",
    label: "Grass",
    render: (p) => (
      <svg viewBox="0 0 64 64" {...p}>
        <path {...strokeProps} d="M14 52c0-16 4-26 4-26" />
        <path {...strokeProps} d="M26 52c0-20 6-32 6-32" />
        <path {...strokeProps} d="M38 52c0-16-4-26-4-26" />
        <path {...strokeProps} d="M50 52c0-12-6-20-6-20" />
      </svg>
    ),
  },
];

export const EMOJI_STICKERS = [
  { id: "e-plane", char: "✈️", label: "Airplane" },
  { id: "e-luggage", char: "🧳", label: "Luggage" },
  { id: "e-map", char: "🗺️", label: "Map" },
  { id: "e-camera", char: "📸", label: "Camera" },
  { id: "e-beach", char: "🏖️", label: "Beach" },
  { id: "e-mountain", char: "⛰️", label: "Mountain" },
  { id: "e-car", char: "🚗", label: "Car" },
  { id: "e-train", char: "🚆", label: "Train" },
  { id: "e-anchor", char: "⚓", label: "Anchor" },
  { id: "e-tent", char: "🏕️", label: "Tent" },
  { id: "e-globe", char: "🌍", label: "Globe" },
  { id: "e-compass", char: "🧭", label: "Compass" },
  { id: "e-blossom", char: "🌸", label: "Blossom" },
  { id: "e-sun", char: "☀️", label: "Sun" },
  { id: "e-moon", char: "🌙", label: "Moon" },
  { id: "e-star", char: "⭐", label: "Star" },
  { id: "e-sparkles", char: "✨", label: "Sparkles" },
  { id: "e-heart", char: "❤️", label: "Heart" },
  { id: "e-footprints", char: "👣", label: "Footprints" },
  { id: "e-party", char: "🎉", label: "Party" },
];

// Frame stickers: decorative masks the user's own photo gets placed inside.
// `clipPath` is SVG path data in a 0..220 x 0..260 box (the element's default
// size — FrameStickerElementContent scales the viewBox to fit whatever size
// the user resizes the element to).
export const FRAME_STICKERS = [
  {
    id: "polaroid",
    label: "Polaroid",
    viewBox: "0 0 220 260",
    clipPath: "M10 10h200v190H10z",
    decoration: (p) => (
      <svg viewBox="0 0 220 260" {...p}>
        <rect x="2" y="2" width="216" height="256" rx="4" fill="#fdfdfd" stroke="#e2e8f0" />
      </svg>
    ),
  },
  {
    id: "torn-paper",
    label: "Torn Paper",
    viewBox: "0 0 220 260",
    clipPath:
      "M6 14 22 6 40 16 58 4 78 14 98 6 118 16 138 5 158 15 178 6 198 14 214 8 " +
      "214 246 196 254 176 244 156 256 136 246 116 254 96 244 76 256 56 246 36 254 16 244 6 250z",
    decoration: null,
  },
  {
    id: "wavy",
    label: "Wavy Border",
    viewBox: "0 0 220 260",
    clipPath:
      "M12 20q10-14 20 0t20 0 20 0 20 0 20 0 20 0 20 0 20 0 20 0v210q-10 14-20 0t-20 0-20 0-20 0-20 0-20 0-20 0-20 0-20 0z",
    decoration: null,
  },
];

export function findSticker(stickerId) {
  return NATURE_STICKERS.find((s) => s.id === stickerId);
}

export function findEmoji(stickerId) {
  return EMOJI_STICKERS.find((s) => s.id === stickerId);
}

export function findFrame(frameId) {
  return FRAME_STICKERS.find((f) => f.id === frameId) || FRAME_STICKERS[0];
}
