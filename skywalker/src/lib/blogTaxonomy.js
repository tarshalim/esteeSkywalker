import { realCover } from "./media";
import { formatDate, formatDateRange } from "./dateFilters";
import { companionsForPost } from "./hierarchy";

// Travel-story categories. Stored on the blog object itself (the `blogs.data`
// jsonb column), so adding one here needs no migration.
//   vibes: ids from the user's vibe list (lib/vibes.js)      city: free text

/**
 * @typedef {{ id: string, label: string }} Option
 */

/** Starter vibes; each user can rename, add and delete from here (lib/vibes.js). @type {Option[]} */
export const VIBES = [
  { id: "foodie", label: "Foodie & Dining" },
  { id: "nature", label: "Nature & Hiking" },
  { id: "city-walk", label: "City Walk" },
  { id: "culture", label: "Culture & Heritage" },
  { id: "relaxing", label: "Relaxing" },
];

export function labelFor(options, id) {
  return options.find((o) => o.id === id)?.label ?? null;
}

const PLACEHOLDER_NAMES = new Set(["", "unnamed waypoint"]);

/**
 * The post's city: the explicit `city` field, else the first part of the
 * location waypoint ("Kyoto, Japan" → "Kyoto") unless that's just the country.
 */
export function cityOf(blog) {
  const country = (blog.countryName ?? "").toLowerCase();
  const explicit = blog.city?.trim() ?? "";
  if (explicit) return explicit.toLowerCase() === country ? "" : explicit;
  const first = (blog.location?.name ?? "").split(",")[0].trim();
  if (PLACEHOLDER_NAMES.has(first.toLowerCase())) return "";
  if (first.toLowerCase() === country) return "";
  return first;
}

/**
 * Single-tier territories where the city *is* the country, so a City filter
 * would only ever repeat it ("Singapore → Singapore"). Their posts list no
 * cities, which hides the City dropdown for them.
 */
export const CITY_STATES = new Set(["SG", "MC", "VA", "HK", "MO", "GI"]);

/**
 * Filter options built from the posts themselves, so only places that
 * actually appear in a story are offered. Cities carry their country code so
 * the city list can narrow to the selected country.
 */
export function locationOptions(blogs) {
  const countries = new Map();
  const cities = new Map();
  for (const blog of blogs) {
    if (blog.countryCode) countries.set(blog.countryCode, blog.countryName || blog.countryCode);
    const city = CITY_STATES.has(blog.countryCode) ? "" : cityOf(blog);
    if (city) {
      const key = `${blog.countryCode}|${city.toLowerCase()}`;
      if (!cities.has(key)) cities.set(key, { name: city, countryCode: blog.countryCode });
    }
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  return {
    countries: [...countries].map(([code, name]) => ({ code, name })).sort(byName),
    cities: [...cities.values()].sort(byName),
  };
}

/**
 * A date filter. `day`: `start` is yyyy-mm-dd. `month`: `start` is yyyy-mm.
 * `range`: `start`/`end` are yyyy-mm-dd and either may be blank (open-ended).
 * @typedef {{ mode: "day"|"month"|"range", start: string, end: string }} DateFilter
 */

/**
 * @typedef {{
 *   country: string,          // ISO alpha-2 code, "" for any
 *   city: string,             // city name within `country`, "" for any
 *   trip: string,             // trip id within the place, "" for any
 *   companion: string,        // someone on the trip during the post's dates, "" for any
 *   date: ?DateFilter,
 *   favoritesOnly: boolean,
 * }} BlogFilters
 */

/** @type {BlogFilters} */
export const EMPTY_FILTERS = { country: "", city: "", trip: "", companion: "", date: null, favoritesOnly: false };

export const hasActiveFilters = (f) => Boolean(f.country || f.city || f.trip || f.companion || f.date || f.favoritesOnly);

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

const NO_TRIPS = new Map();

/**
 * Does the post pass every filter tier (place -> trip -> companion, plus date
 * and favorites)?
 * @param {Map<string, import("../types/hierarchy").Trip>} [tripsById] - needed for the companion filter
 */
export function matchesFilters(blog, f, tripsById = NO_TRIPS) {
  if (f.country && blog.countryCode !== f.country) return false;
  if (f.city && cityOf(blog).toLowerCase() !== f.city.toLowerCase()) return false;
  if (f.trip && blog.tripId !== f.trip) return false;
  if (f.companion && !companionsForPost(blog, tripsById.get(blog.tripId)).includes(f.companion)) return false;
  if (f.favoritesOnly && !blog.favorite) return false;
  const bounds = dateFilterBounds(f.date);
  if (bounds) {
    // A trip matches when any of its days falls inside the filter.
    const start = blog.startDate ?? blog.postDate ?? blog.date ?? "";
    const end = blog.endDate || start;
    const [from, to] = bounds;
    if (!start || (to && start > to) || (from && end < from)) return false;
  }
  return true;
}

/**
 * Page heading for the active filters: a trip's name, "Kyoto, Japan", "Japan
 * Stories", "Favorite Stories", or "Beyond the Map". Filters that aren't in
 * the title (place under a trip, companion, date, favorites) come back as `subtitle`.
 */
export function filterHeading(f, countryName, tripTitle = "") {
  const place = f.city ? [f.city, countryName].filter(Boolean).join(", ") : countryName ? `${countryName} Stories` : null;
  const date = dateFilterLabel(f.date);
  const companion = f.companion && `With ${f.companion}`;
  if (f.trip && tripTitle) {
    const where = f.city ? place : countryName;
    return { title: tripTitle, subtitle: [where, companion, f.favoritesOnly && "Favorites", date].filter(Boolean).join(" · ") };
  }
  if (place) return { title: place, subtitle: [companion, f.favoritesOnly && "Favorites", date].filter(Boolean).join(" · ") };
  if (companion) return { title: `Stories with ${f.companion}`, subtitle: [f.favoritesOnly && "Favorites", date].filter(Boolean).join(" · ") };
  if (f.favoritesOnly) return { title: "Favorite Stories", subtitle: date };
  return { title: "Beyond the Map", subtitle: date };
}

/** What a draft still needs before it reads as a finished story. */
export function draftChecklist(blog) {
  const hasStory = (blog.canvas?.elements?.length ?? 0) > 0 || (blog.blocks?.length ?? 0) > 0;
  return [
    { label: "Title", done: Boolean(blog.title?.trim()) && blog.title !== "Untitled Blog Post" },
    { label: "Cover image", done: Boolean(realCover(blog.coverImage)) },
    { label: "Country", done: Boolean(blog.countryCode) },
    { label: "Story content", done: hasStory },
  ];
}
