/**
 * Shared date formatting/range helpers for the country+date tagging &
 * filtering feature (BlogEditor, Gallery, BlogsJourney, Signpost, BlogDetail).
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

/** A post's date tag: its single date, or its start–end range. */
export function formatBlogDate(blog, style = "medium") {
  return formatDateRange(blog.startDate ?? blog.postDate ?? blog.date, blog.endDate, style);
}

export function isWithinRange(dateStr, range) {
  if (!range || (!range.start && !range.end)) return true;
  const time = new Date(dateStr).getTime();
  if (range.start && time < new Date(range.start).getTime()) return false;
  if (range.end && time > new Date(range.end).getTime()) return false;
  return true;
}
