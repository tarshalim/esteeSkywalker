/**
 * Shared date formatting/range helpers for the country+date tagging &
 * filtering feature, plus the DateFilter used by both filter bars.
 */
function formatWith(dateStr, opts) {
  // "2024-02-11" parses as UTC midnight, which renders as Feb 10 west of
  // Greenwich — format date-only tags in UTC so the day never shifts.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) opts = { ...opts, timeZone: "UTC" };
  return new Date(dateStr).toLocaleDateString(undefined, opts);
}

function styleOptions(style) {
  return style === "long"
    ? { year: "numeric", month: "long", day: "numeric" }
    : style === "short"
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" };
}

export function formatDate(dateStr, style = "medium") {
  if (!dateStr) return "";
  return formatWith(dateStr, styleOptions(style));
}

/**
 * "Oct 12, 2026" for a single day, "Oct 12 – Oct 20, 2026" for a range in one
 * year, "Dec 28, 2025 – Jan 3, 2026" across years.
 */
export function formatDateRange(start, end, style = "medium") {
  if (!start) return "";
  if (!end || end === start) return formatDate(start, style);
  const opts = styleOptions(style);
  const sameYear = new Date(start).getUTCFullYear() === new Date(end).getUTCFullYear();
  const { year, ...noYear } = opts;
  const startText = formatWith(start, year && sameYear ? noYear : opts);
  return `${startText} – ${formatWith(end, opts)}`;
}

/**
 * Calendar year of a yyyy-mm-dd date or ISO timestamp, read from its date part
 * (the same part matchesDateFilter compares). `new Date("2025-01-01")` is UTC
 * midnight, so `.getFullYear()` gives 2024 west of Greenwich. NaN if there's no date.
 */
export function dateYear(value) {
  const match = /^(\d{4})-\d{2}-\d{2}/.exec(String(value ?? ""));
  return match ? Number(match[1]) : NaN;
}

/** Sort key for a date or timestamp: ms since the epoch, or 0 when missing or invalid (so a sort comparator never returns NaN). */
export function dateTime(value) {
  const t = value ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** A post's date tag: its single date, or its start–end range. */
export function formatBlogDate(blog, style = "medium") {
  return formatDateRange(blog.startDate ?? blog.postDate ?? blog.date, blog.endDate, style);
}

/**
 * A date filter, shared by the blog trail and the gallery (`DateFilter` in
 * FilterControls). `day`: `start` is yyyy-mm-dd. `month`: `start` is yyyy-mm.
 * `range`: `start`/`end` are yyyy-mm-dd and either may be blank (open-ended).
 * @typedef {{ mode: "day"|"month"|"range", start: string, end: string }} DateFilter
 */

/** Inclusive [from, to] yyyy-mm-dd bounds of a date filter ("" = open-ended), or null if it's incomplete. */
export function dateFilterBounds(d) {
  if (!d) return null;
  if (d.mode === "day") return d.start ? [d.start, d.start] : null;
  // "-31" works for every month: these are compared as strings, never parsed.
  if (d.mode === "month") return d.start ? [`${d.start}-01`, `${d.start}-31`] : null;
  return d.start || d.end ? [d.start || "", d.end || ""] : null;
}

/** Short label for the date filter pill: "Mar 4, 2025", "March 2025", "Mar 1 – Mar 9, 2025", "From Mar 1, 2025". */
export function dateFilterLabel(d) {
  const bounds = dateFilterBounds(d);
  if (!bounds) return "";
  if (d.mode === "month") {
    return new Date(`${d.start}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  }
  const [from, to] = bounds;
  if (from && to) return formatDateRange(from, to);
  return from ? `From ${formatDate(from)}` : `Until ${formatDate(to)}`;
}

/**
 * Does the span `start`..`end` (yyyy-mm-dd, or ISO timestamps: only the date
 * part is compared) overlap the filter? A missing `end` means a single day.
 * No filter, or an incomplete one, matches everything; no `start` matches nothing.
 * @param {?DateFilter} filter
 */
export function matchesDateFilter(start, end, filter) {
  const bounds = dateFilterBounds(filter);
  if (!bounds) return true;
  const first = String(start ?? "").slice(0, 10);
  if (!first) return false;
  const last = end ? String(end).slice(0, 10) : first;
  const [from, to] = bounds;
  return !(to && first > to) && !(from && last < from);
}
