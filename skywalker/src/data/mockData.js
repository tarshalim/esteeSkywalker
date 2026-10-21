import { createTextBlock, createImageBlock, createVideoBlock, createTextboxBlock } from "../lib/blocks";
import { COUNTRY_TO_CONTINENT } from "../utils/countries";

/**
 * Single source of truth for every mock dataset the app renders — photos,
 * blogs, and user-placed annotation pins. `src/data/photos.js` and
 * `src/data/blogs.js` re-export from here so existing import sites never
 * had to change when this file was introduced.
 *
 * @typedef {Object} Photo
 * @property {string} id            - Unique photo id (e.g. DB primary key or S3 object key).
 * @property {string} url           - Full-resolution image URL (Supabase Storage public URL).
 * @property {string} thumbUrl      - Smaller thumbnail URL for grid rendering.
 * @property {number} lat           - Latitude in decimal degrees, EXIF GPS or manual pin.
 * @property {number} lng           - Longitude in decimal degrees.
 * @property {string} countryCode   - ISO 3166-1 alpha-2 code (e.g. "SG"), used to match
 *                                     the geojson `ISO_A2` property for choropleth coloring.
 * @property {string} countryName   - Human-readable country name, for filter pills/badges.
 * @property {string} continent     - Derived from countryCode via COUNTRY_TO_CONTINENT.
 * @property {string} locationName  - Human-readable place name shown in the gallery/tooltip.
 * @property {string} timestamp     - ISO 8601 date string of when the photo was taken.
 * @property {number} year          - Derived from timestamp, for the Year filter tier.
 * @property {?string} blogId       - Optional id into `mockBlogs`, when this photo has an
 *                                     accompanying write-up ("View Blog Post" badge/link).
 *
 * @typedef {Object} Blog
 * @property {string} id
 * @property {string} title
 * @property {string} excerpt
 * @property {string} coverImage
 * @property {{name: string, lat: number, lng: number}} location
 * @property {string} countryCode   - ISO 3166-1 alpha-2 code, matches geojson ISO_A2.
 * @property {string} countryName
 * @property {string} continent     - Derived from countryCode via COUNTRY_TO_CONTINENT.
 * @property {string} startDate     - ISO 8601 (yyyy-mm-dd) date (or first day of the trip) set from the editor.
 * @property {?string} endDate      - Last day of the trip (yyyy-mm-dd), or null for a single-day post.
 * @property {string} postDate      - Legacy alias, kept mirrored to startDate.
 * @property {string} date          - Legacy alias, kept mirrored to startDate.
 * @property {number} year          - Derived from startDate, for the Year filter tier.
 * @property {string} [city]
 * @property {string[]} [vibes]     - Ids from VIBES (src/lib/blogTaxonomy.js).
 * @property {import("../lib/weather").Weather} [weather] - Story weather, auto-filled or set by the writer.
 * @property {boolean} [favorite]   - Starred by the writer; the trail's Favorites filter.
 * @property {"draft"|"published"} status
 * @property {number} trackX        - Horizontal position along the BlogsJourney timeline (unrelated to the globe).
 * @property {number} laneOffset    - Vertical nudge along the BlogsJourney timeline (unrelated to the globe).
 * @property {Array} blocks
 *
 * @typedef {Object} CustomPin
 * @property {string} id
 * @property {number} lat
 * @property {number} lng
 * @property {string} title
 * @property {string} note
 * @property {string} createdAt     - ISO 8601 date string.
 */

/** @type {Photo[]} */
const COUNTRY_NAMES = {
  SG: "Singapore",
  JP: "Japan",
  FR: "France",
  US: "United States",
  AU: "Australia",
  GB: "United Kingdom",
  IT: "Italy",
  TH: "Thailand",
  MY: "Malaysia",
  ID: "Indonesia",
  AE: "United Arab Emirates",
  BR: "Brazil",
  RU: "Russia",
  KR: "South Korea",
};

export const mockPhotos = [
  { id: "p01", lat: 1.3521, lng: 103.8198, countryCode: "SG", locationName: "Singapore", timestamp: "2024-02-11T09:00:00Z", blogId: "singapore-loop" },
  { id: "p02", lat: 1.2903, lng: 103.8519, countryCode: "SG", locationName: "Marina Bay, Singapore", timestamp: "2024-02-12T14:30:00Z", blogId: null },
  { id: "p03", lat: 1.4043, lng: 103.9019, countryCode: "SG", locationName: "Punggol, Singapore", timestamp: "2024-02-13T17:15:00Z", blogId: null },

  { id: "p04", lat: 35.6762, lng: 139.6503, countryCode: "JP", locationName: "Tokyo, Japan", timestamp: "2023-11-02T08:00:00Z", blogId: "tokyo-backroads" },
  { id: "p05", lat: 34.6937, lng: 135.5023, countryCode: "JP", locationName: "Osaka, Japan", timestamp: "2023-11-04T11:20:00Z", blogId: null },
  { id: "p06", lat: 36.2048, lng: 138.2529, countryCode: "JP", locationName: "Nagano, Japan", timestamp: "2023-11-06T09:45:00Z", blogId: null },

  { id: "p07", lat: 48.8566, lng: 2.3522, countryCode: "FR", locationName: "Paris, France", timestamp: "2023-06-18T10:00:00Z", blogId: null },
  { id: "p08", lat: 43.7102, lng: 7.2620, countryCode: "FR", locationName: "Nice, France", timestamp: "2023-06-21T16:00:00Z", blogId: "provence-climbs" },

  { id: "p09", lat: 40.7128, lng: -74.0060, countryCode: "US", locationName: "New York, USA", timestamp: "2023-09-01T13:00:00Z", blogId: null },
  { id: "p10", lat: 37.7749, lng: -122.4194, countryCode: "US", locationName: "San Francisco, USA", timestamp: "2023-09-05T18:30:00Z", blogId: "pacific-coast" },
  { id: "p11", lat: 21.3069, lng: -157.8583, countryCode: "US", locationName: "Honolulu, USA", timestamp: "2023-09-09T07:00:00Z", blogId: null },

  { id: "p12", lat: -33.8688, lng: 151.2093, countryCode: "AU", locationName: "Sydney, Australia", timestamp: "2022-12-26T12:00:00Z", blogId: null },
  { id: "p13", lat: -37.8136, lng: 144.9631, countryCode: "AU", locationName: "Melbourne, Australia", timestamp: "2022-12-29T15:40:00Z", blogId: null },

  { id: "p14", lat: 51.5072, lng: -0.1276, countryCode: "GB", locationName: "London, UK", timestamp: "2023-04-14T09:10:00Z", blogId: null },

  { id: "p15", lat: 41.9028, lng: 12.4964, countryCode: "IT", locationName: "Rome, Italy", timestamp: "2023-05-02T11:00:00Z", blogId: null },
  { id: "p16", lat: 45.4408, lng: 12.3155, countryCode: "IT", locationName: "Venice, Italy", timestamp: "2023-05-05T14:20:00Z", blogId: null },

  { id: "p17", lat: 13.7563, lng: 100.5018, countryCode: "TH", locationName: "Bangkok, Thailand", timestamp: "2024-01-10T08:30:00Z", blogId: null },
  { id: "p18", lat: 7.8804, lng: 98.3923, countryCode: "TH", locationName: "Phuket, Thailand", timestamp: "2024-01-13T16:00:00Z", blogId: null },

  { id: "p19", lat: 3.1390, lng: 101.6869, countryCode: "MY", locationName: "Kuala Lumpur, Malaysia", timestamp: "2023-08-20T10:00:00Z", blogId: null },

  { id: "p20", lat: -8.3405, lng: 115.0920, countryCode: "ID", locationName: "Bali, Indonesia", timestamp: "2023-07-03T09:00:00Z", blogId: "bali-rice-terraces" },

  { id: "p21", lat: 25.2048, lng: 55.2708, countryCode: "AE", locationName: "Dubai, UAE", timestamp: "2023-10-11T19:00:00Z", blogId: null },

  { id: "p22", lat: -22.9068, lng: -43.1729, countryCode: "BR", locationName: "Rio de Janeiro, Brazil", timestamp: "2022-08-15T13:00:00Z", blogId: null },

  { id: "p23", lat: 55.7558, lng: 37.6173, countryCode: "RU", locationName: "Moscow, Russia", timestamp: "2019-07-01T10:00:00Z", blogId: null },

  { id: "p24", lat: 37.5665, lng: 126.9780, countryCode: "KR", locationName: "Seoul, South Korea", timestamp: "2024-03-02T09:30:00Z", blogId: null },
].map((p) => ({
  ...p,
  countryName: COUNTRY_NAMES[p.countryCode] ?? p.countryCode,
  continent: COUNTRY_TO_CONTINENT[p.countryCode] ?? "",
  year: new Date(p.timestamp).getFullYear(),
  url: `https://picsum.photos/seed/${p.id}/1200/900`,
  thumbUrl: `https://picsum.photos/seed/${p.id}/400/300`,
}));

/** ISO_A2 codes with at least one photo — used to choropleth-color the globe. */
export const visitedCountryCodes = new Set(mockPhotos.map((p) => p.countryCode));

/**
 * Swap this for a real fetch once the backend exists, e.g.:
 *   const res = await fetch('/api/photos');
 *   return res.json();
 * Keeping it async now means callers (GlobeExplorer, Gallery) never need to change.
 * @returns {Promise<Photo[]>}
 */
export async function fetchPhotos() {
  return mockPhotos;
}

/**
 * Mock blog posts for the cyclist journey. `trackX` is the horizontal pixel
 * position of this post's signpost along the BlogsJourney timeline; `laneOffset`
 * nudges the signpost up/down so the path doesn't look perfectly flat. Neither
 * field has any bearing on the globe — the globe uses `location.lat`/`location.lng`.
 * @type {Blog[]}
 */
export const mockBlogs = [
  {
    id: "singapore-loop",
    title: "The Singapore Loop",
    excerpt: "Where the journey began — humid mornings and hawker centre pit stops.",
    coverImage: "https://picsum.photos/seed/singapore-loop/1600/900",
    location: { name: "Singapore", lat: 1.3521, lng: 103.8198 },
    countryCode: "SG",
    countryName: "Singapore",
    continent: COUNTRY_TO_CONTINENT.SG,
    date: "2024-02-11",
    postDate: "2024-02-11",
    year: 2024,
    status: "published",
    trackX: 900,
    laneOffset: 0,
    blocks: [
      createTextBlock("h1", "Day 1: The Singapore Loop"),
      createTextBlock(
        "paragraph",
        "It started, as most bad ideas do, with a spreadsheet. Somewhere between the East Coast Park bike path and a plate of chwee kueh, I decided a bicycle was the only honest way to see a country."
      ),
      createImageBlock("https://picsum.photos/seed/singapore-01/1200/800", "Sunrise along East Coast Park."),
      createTextBlock(
        "quote",
        "“The city never really sleeps, it just changes gears.”"
      ),
      createTextBlock(
        "paragraph",
        "By Punggol the tide was out and the boardwalk smelled like salt and diesel. I stopped counting kilometres and started counting bridges instead — twelve by lunch."
      ),
    ],
  },
  {
    id: "tokyo-backroads",
    title: "Tokyo Backroads",
    excerpt: "Vending machines, vertical highways, and a very polite flat tyre.",
    coverImage: "https://picsum.photos/seed/tokyo-backroads/1600/900",
    location: { name: "Tokyo, Japan", lat: 35.6762, lng: 139.6503 },
    countryCode: "JP",
    countryName: "Japan",
    continent: COUNTRY_TO_CONTINENT.JP,
    date: "2023-11-02",
    postDate: "2023-11-02",
    year: 2023,
    status: "published",
    trackX: 1900,
    laneOffset: -60,
    blocks: [
      createTextBlock("h1", "Tokyo Backroads"),
      createTextBlock(
        "paragraph",
        "Tokyo doesn't so much have streets as it has suggestions. I followed the river instead — it was the only thing in the city not trying to sell me something."
      ),
      createVideoBlock("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      createTextBlock(
        "paragraph",
        "A flat tyre outside a Family Mart turned into a twenty-minute lesson in patch kits from a stranger named Sato, who refused any thanks beyond a can of hot coffee."
      ),
    ],
  },
  {
    id: "provence-climbs",
    title: "Provence Climbs",
    excerpt: "Lavender fields, switchbacks, and the longest descent of my life.",
    coverImage: "https://picsum.photos/seed/provence-climbs/1600/900",
    location: { name: "Provence, France", lat: 43.9493, lng: 5.3900 },
    countryCode: "FR",
    countryName: "France",
    continent: COUNTRY_TO_CONTINENT.FR,
    date: "2023-06-18",
    postDate: "2023-06-18",
    year: 2023,
    status: "published",
    trackX: 2900,
    laneOffset: 40,
    blocks: [
      createTextBlock("h1", "Provence Climbs"),
      createTextBlock(
        "paragraph",
        "The road to Mont Ventoux doesn't ease you in. It just tilts upward outside Bédoin and stays that way for twenty-one kilometres."
      ),
      createTextboxBlock(
        2,
        "<p><strong>Distance:</strong> 21.5km<br/><strong>Elevation:</strong> 1,617m<br/><strong>Legs:</strong> not consulted</p><p>Notes from the summit: bring a jacket. The temperature drop is not a suggestion, it's a warning.</p>"
      ),
      createImageBlock("https://picsum.photos/seed/provence-02/1200/800", "The bald summit of Mont Ventoux."),
    ],
  },
  {
    id: "pacific-coast",
    title: "Pacific Coast Highway",
    excerpt: "Fog, sea lions, and the cheapest motel with the best view.",
    coverImage: "https://picsum.photos/seed/pacific-coast/1600/900",
    location: { name: "California, USA", lat: 36.5, lng: -121.9 },
    countryCode: "US",
    countryName: "United States",
    continent: COUNTRY_TO_CONTINENT.US,
    date: "2023-09-01",
    postDate: "2023-09-01",
    year: 2023,
    status: "published",
    trackX: 3950,
    laneOffset: -30,
    blocks: [
      createTextBlock("h1", "Pacific Coast Highway"),
      createTextBlock(
        "paragraph",
        "Highway 1 doesn't care about your schedule. The fog rolls in around Big Sur and erases the road twenty feet ahead of you, so you just... slow down and trust the white line."
      ),
      createImageBlock("https://picsum.photos/seed/pch-01/1200/800", "Sea lions arguing over a rock near Piedras Blancas."),
      createTextBlock(
        "quote",
        "“Best $40 motel room I've ever paid for, purely for the view.”"
      ),
    ],
  },
  {
    id: "bali-rice-terraces",
    title: "Bali Rice Terraces",
    excerpt: "Early starts, green stairways to the sky, and the last stop of the trip.",
    coverImage: "https://picsum.photos/seed/bali-rice/1600/900",
    location: { name: "Bali, Indonesia", lat: -8.3405, lng: 115.0920 },
    countryCode: "ID",
    countryName: "Indonesia",
    continent: COUNTRY_TO_CONTINENT.ID,
    date: "2023-07-03",
    postDate: "2023-07-03",
    year: 2023,
    status: "draft",
    trackX: 4950,
    laneOffset: 20,
    blocks: [
      createTextBlock("h1", "Bali Rice Terraces (draft)"),
      createTextBlock(
        "paragraph",
        "Still writing this one up — the Jatiluwih terraces deserve more than a rushed paragraph typed on a ferry."
      ),
      createImageBlock("https://picsum.photos/seed/bali-02/1200/800", "Terraces just after sunrise."),
    ],
  },
];

/**
 * Seed data for user-placed annotation pins (the globe's "toolbox" feature).
 * Persisted/mutated via `src/lib/pinStore.js`, which seeds localStorage from
 * this array on first load — this array itself is never mutated at runtime.
 * @type {CustomPin[]}
 */
export const mockCustomPins = [
  {
    id: "pin-hanoi-noodles",
    lat: 21.0278,
    lng: 105.8342,
    title: "Best pho of the whole trip",
    note: "Tiny stall near the lake, no sign, opens at 6am and sells out by 9.",
    createdAt: "2024-01-05T07:30:00Z",
  },
  {
    id: "pin-swiss-pass",
    lat: 46.5197,
    lng: 7.9591,
    title: "Next year: this pass",
    note: "Someone at a hostel swore this climb beats Ventoux. Need to find out.",
    createdAt: "2024-03-10T12:00:00Z",
  },
];
