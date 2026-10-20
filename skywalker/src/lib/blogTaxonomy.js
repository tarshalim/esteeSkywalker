import { PLACEHOLDER_COVER } from "./media";

// Travel-story categories. Stored on the blog object itself (the `blogs.data`
// jsonb column), so adding one here needs no migration.
//   vibes: ids from VIBES      city: free text

/**
 * @typedef {{ id: string, label: string }} Option
 */

/** @type {Option[]} */
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
  if (blog.city?.trim()) return blog.city.trim();
  const first = (blog.location?.name ?? "").split(",")[0].trim();
  if (PLACEHOLDER_NAMES.has(first.toLowerCase())) return "";
  if (first.toLowerCase() === (blog.countryName ?? "").toLowerCase()) return "";
  return first;
}

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
    const city = cityOf(blog);
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

/** @typedef {{ country: string, city: string, vibe: string }} BlogFilters */

/** @type {BlogFilters} */
export const EMPTY_FILTERS = { country: "", city: "", vibe: "" };

export function matchesFilters(blog, f) {
  if (f.country && blog.countryCode !== f.country) return false;
  if (f.city && cityOf(blog).toLowerCase() !== f.city.toLowerCase()) return false;
  if (f.vibe && !(blog.vibes ?? []).includes(f.vibe)) return false;
  return true;
}

/**
 * Page heading for the active filters: "Kyoto, Japan", "Japan Stories",
 * "Foodie & Dining Stories", or "Beyond the Map". Category labels that
 * aren't in the title come back as `subtitle`.
 */
export function filterHeading(f, countryName) {
  const tags = [labelFor(VIBES, f.vibe)].filter(Boolean);
  const place = f.city ? [f.city, countryName].filter(Boolean).join(", ") : countryName ? `${countryName} Stories` : null;
  if (place) return { title: place, subtitle: tags.join(" · ") };
  if (tags.length) return { title: `${tags.join(" · ")} Stories`, subtitle: "" };
  return { title: "Beyond the Map", subtitle: "" };
}

/** What a draft still needs before it reads as a finished story. */
export function draftChecklist(blog) {
  const hasStory = (blog.canvas?.elements?.length ?? 0) > 0 || (blog.blocks?.length ?? 0) > 0;
  return [
    { label: "Title", done: Boolean(blog.title?.trim()) && blog.title !== "Untitled Blog Post" },
    { label: "Cover image", done: Boolean(blog.coverImage) && blog.coverImage !== PLACEHOLDER_COVER },
    { label: "Country", done: Boolean(blog.countryCode) },
    { label: "Story content", done: hasStory },
  ];
}
