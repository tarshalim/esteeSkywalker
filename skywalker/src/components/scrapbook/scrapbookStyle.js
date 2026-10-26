// Shared sizing, tilt, shadow and placement rules for the decorative scrapbook
// elements in ./elements. Kept apart from the components so they stay
// fast-refresh friendly and can be reused by custom one-off decorations.

/** Named sizes: the length of the piece's long side, in px. */
export const SIZES = { xs: 40, sm: 64, md: 96, lg: 140, xl: 200 };

/** Long-side length in px for a `size` prop (a preset name or a number). */
export function sizePx(size, fallback = SIZES.md) {
  if (typeof size === "number") return size;
  return SIZES[size] ?? fallback;
}

/** Deterministic tilt in [-range, range] degrees, so a piece keeps its angle across renders. */
export function seededTilt(seed, range = 4) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.round((((h >>> 0) % 1000) / 1000) * range * 2 - range);
}

// `filter: drop-shadow` follows the art's transparent edges, unlike box-shadow.
export const SHADOWS = {
  soft: "drop-shadow(0 1px 1.5px rgba(40,28,14,0.28))",
  lifted: "drop-shadow(0 4px 6px rgba(40,28,14,0.3)) drop-shadow(0 1px 1px rgba(40,28,14,0.2))",
};

/**
 * Free-placement presets over a `relative` parent (a blog card, trip ticket…).
 * Each pins the piece to an anchor and nudges it outward so it overhangs the
 * edge like something stuck on by hand.
 */
export const PLACEMENTS = {
  "top-left": { pos: { top: 0, left: 0 }, shift: "-30%, -30%" },
  "top-center": { pos: { top: 0, left: "50%" }, shift: "-50%, -50%" },
  "top-right": { pos: { top: 0, right: 0 }, shift: "30%, -30%" },
  "center-left": { pos: { top: "50%", left: 0 }, shift: "-40%, -50%" },
  center: { pos: { top: "50%", left: "50%" }, shift: "-50%, -50%" },
  "center-right": { pos: { top: "50%", right: 0 }, shift: "40%, -50%" },
  "bottom-left": { pos: { bottom: 0, left: 0 }, shift: "-30%, 30%" },
  "bottom-center": { pos: { bottom: 0, left: "50%" }, shift: "-50%, 50%" },
  "bottom-right": { pos: { bottom: 0, right: 0 }, shift: "30%, 30%" },
};

/**
 * Positioning style for a `place` prop: a preset name, or an object of
 * `top/right/bottom/left` (plus optional `shift`, a CSS translate value) for
 * exact placement. Returns `{ style, shift }`; no `place` means in-flow.
 */
export function placement(place) {
  if (!place) return { style: null, shift: null };
  const preset = typeof place === "string" ? PLACEMENTS[place] : null;
  if (preset) return { style: { position: "absolute", ...preset.pos }, shift: preset.shift };
  const { shift = null, ...pos } = place;
  return { style: { position: "absolute", ...pos }, shift };
}
