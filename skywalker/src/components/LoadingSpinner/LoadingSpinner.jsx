import "./LoadingSpinner.css";

/**
 * The app's one loading indicator: a spinning ring with optional status text,
 * announced to screen readers via role="status".
 *
 * - default: centered block that fills its container's width (lists, grids).
 * - `fullPage`: fills the viewport under the floating nav (route-level loads).
 * - `overlay`: covers a positioned parent without blocking pointer input
 *   (e.g. the globe stage while its scene and pins load).
 * - `tone="light"`: white ring/text for dark or photographic backdrops.
 */
export default function LoadingSpinner({ label = "Loading…", size = "md", fullPage = false, overlay = false, tone, className = "", style }) {
  const classes = [
    "loading-spinner",
    `loading-spinner--${size}`,
    fullPage && "loading-spinner--page",
    overlay && "loading-spinner--overlay",
    tone && `loading-spinner--${tone}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} style={style} role="status" aria-live="polite">
      <span className="loading-spinner-ring" aria-hidden="true" />
      {label ? <span className="loading-spinner-label">{label}</span> : <span className="sr-only">Loading…</span>}
    </div>
  );
}
