/** Vertical bands of the stage, as % of its height from the bottom edge. */
export const TRAIL = {
  bottomPct: 7,
  heightPct: 11,
};

/** Signposts sit on the back edge of the trail. */
export const SIGNPOST_BASE_PCT = TRAIL.bottomPct + TRAIL.heightPct - 2;

/** Tyres touch down a little inside the trail's front edge (the sprite box is cropped to the wheels). */
export const RIDER_BASE_PCT = TRAIL.bottomPct + 3;

/** Rider's start/end inset from each end of the world, as a fraction of viewport width. */
const RIDER_INSET = 0.14;

// Signpost range, as % of the world (trail) width.
const FIRST_POST_PCT = 14;
const LAST_POST_PCT = 86;

/** Where on screen the camera tries to keep the rider (fraction of viewport width). */
export const CAMERA_LEAD = 0.35;

/** The create post takes a shorter slot than a story, so it hugs the first signpost. */
export const CREATE_SLOT_SPAN = 0.6;

/**
 * Signposts are spaced at even percentage intervals between the first and last slots.
 * `index` and `count` may be fractional (see CREATE_SLOT_SPAN).
 */
export function signpostPercent(index, count) {
  if (count <= 1) return 40;
  return FIRST_POST_PCT + (index / (count - 1)) * (LAST_POST_PCT - FIRST_POST_PCT);
}

/** Each post gets roughly 45% of a screen of trail, never less than one screen in total. */
export function worldWidthFor(count, viewportWidth) {
  return Math.max(viewportWidth, count * Math.max(340, viewportWidth * 0.45));
}

export function riderWorldX(progress, worldWidth, viewportWidth) {
  const start = viewportWidth * RIDER_INSET;
  const end = worldWidth - viewportWidth * RIDER_INSET;
  return start + (end - start) * progress;
}

/** Inverse of riderWorldX: the scroll progress at which the rider reaches world x. */
export function riderProgressAt(x, worldWidth, viewportWidth) {
  const start = viewportWidth * RIDER_INSET;
  const end = worldWidth - viewportWidth * RIDER_INSET;
  return end > start ? Math.min(Math.max((x - start) / (end - start), 0), 1) : 0;
}

/** Tags shown beside a signpost: explicit `tags` if the post has them, else derived from its location. */
export function blogTags(blog) {
  const raw = blog.tags?.length
    ? blog.tags
    : [blog.countryName, blog.location?.name !== blog.countryName && blog.location?.name, blog.continent];
  return [...new Set(raw.filter(Boolean))].map((t) => `#${String(t).replace(/^#/, "").replace(/\s+/g, "")}`);
}
