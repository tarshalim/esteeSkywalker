/**
 * Shared date formatting/range helpers for the country+date tagging &
 * filtering feature (BlogEditor, Gallery, BlogsJourney, Signpost, BlogDetail).
 */
export function formatDate(dateStr, style = "medium") {
  if (!dateStr) return "";
  const opts =
    style === "long"
      ? { year: "numeric", month: "long", day: "numeric" }
      : style === "short"
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  return new Date(dateStr).toLocaleDateString(undefined, opts);
}

export function isWithinRange(dateStr, range) {
  if (!range || (!range.start && !range.end)) return true;
  const time = new Date(dateStr).getTime();
  if (range.start && time < new Date(range.start).getTime()) return false;
  if (range.end && time > new Date(range.end).getTime()) return false;
  return true;
}
