# Pins, Trips, Blogs & Photos — Data Architecture Audit & Globe UX Spec

Scope: the four core entities and how the 3D globe (`components/PhotoGlobe`,
`components/GlobeExplorer`, `components/PinQuickCard`) draws them.

Source of truth today: `supabase/migrations/20261021030000_location_trip_hierarchy.sql`,
`src/types/hierarchy.d.ts`, `src/lib/{pinStore,tripStore,blogStore,photoStore,hierarchy}.js`.

---

## 0. TL;DR

The requested model puts **Trip at the top**, holding **many pins** joined by
**route arcs**. The code today does the reverse: **Location (pin) is at the top**, and
each trip sits at **exactly one** location (`trips.location_id NOT NULL`). So a
multi-city trip (Tokyo → Kyoto → Osaka) can't be stored at all, and there is nothing
to draw arcs between.

Recommendation: keep `locations` as shared, reusable places, and add an ordered
**`trip_stops`** join table so one trip can visit many locations. Trip becomes the
organizing container, and pins stay the spatial anchors. Every existing row migrates
1:1, because each current trip becomes a trip with a single stop.

---

## 1. Audit: what exists today

### 1.1 Current hierarchy

```text
locations (UI: "pin")                      lat/lng, name, country, city
 ├── trips            trips.location_id    NOT NULL, CASCADE on delete
 │    ├── trip_companions                  date intervals inside the trip
 │    ├── blogs       blogs.trip_id        SET NULL; location_id derived from trip
 │    └── gallery_items .trip_id           SET NULL; location_id derived from trip
 │          └── .blog_id (optional)        must be the same trip as the post
 ├── blogs (no trip)  blogs.location_id    "loose" stories filed under a pin
 └── (empty)          plain annotation pin
gallery_items (no trip, no blog)           "unfiled"
blogs (no location, has coords)            rendered as a `virtual` pin
```

### 1.2 Findings (sources of ambiguity)

| # | Issue | Where | Impact |
|---|---|---|---|
| A1 | **A trip is single-location.** | `trips.location_id NOT NULL`; `cascade_trip_location` trigger | No multi-city trips and no itinerary to draw. This blocks the requested model. |
| A2 | **Naming drift.** One entity goes by four names: `pins` → `locations` table, `pinId` in JS = `location_id` column; `photos` → `gallery_items`, still `photoStore`/`skywalker.photos.v1`. | stores, types, triggers | Readers can't tell whether "pin" means a location row, a photo cluster or a virtual post marker. |
| A3 | **Photos are drawn twice on the globe.** `PhotoGlobe` clusters *every* gallery item by its own EXIF lat/lng into separate `kind: "photo"` markers with pulsing rings. The same items are also counted under their location pin via `buildStoryPins`. | `PhotoGlobe.jsx:279-289`, `pinStore.js:122` | A Kyoto trip photo taken 3 km away shows up as a second, unrelated dot next to the Kyoto pin. |
| A4 | **Post coordinates can disagree with the pin.** A blog keeps its own `location {name, lat, lng}` plus `pinId`. `setBlogsPin` keeps the post's own coords when it has them. | `blogStore.js:205-219` | The post's map position and its pin can be up to 25 km apart (`PIN_MERGE_RADIUS_KM`), or further after manual edits. |
| A5 | **Canvas media are not Photos.** Images and videos placed in a post's collage or canvas are URLs inside `blogs.data.canvas`. They are not `gallery_items` rows. Only uploads made through the Gallery (`createPhoto`, `Gallery.jsx:203`) become entities. | `photoStore.js`, `BlogEditor.jsx` | "Photos of this blog" can mean two different things. Canvas images never appear in the gallery or on the globe. |
| A6 | **Date bounds are enforced only on the client.** A post's or photo's date must fall inside its trip only in `BlogEditor` and `PhotoUploadModal` (`isWithinTrip`). The DB checks companions but not posts or photos. | `hierarchy.js:37`, migration | Imports, admin SQL or a later API can create out-of-range posts. |
| A7 | **Deleting a location cascades its trips away.** `trips.location_id … ON DELETE CASCADE`, while posts and photos only `SET NULL`. | migration | Deleting one pin silently deletes whole trips (titles, companions), and their posts drop out of the hierarchy. |
| A8 | **Virtual pins.** Pre-location posts with coords get a fake `blog:<id>` pin, which is materialized on first edit. | `pinStore.js:139-169` | A third kind of marker that users can't tell apart from real pins. |

---

## 2. Target entity model

### 2.1 Hierarchy

```text
┌──────────────────────────────────────────────────────────────┐
│ 🗺️ TRIP  (organizational container)                           │
│    title, start/end date, cover photo, note, companions      │
│    ├── 📍 STOPS  (ordered)  → each points at a LOCATION pin   │
│    │      ordinal, arrive/depart dates                       │
│    │      consecutive stops ⇒ route arcs on the globe        │
│    └── 📚 BLOG POSTS  (narrative)   trip_id + stop/location   │
│           └── 🖼️ PHOTOS  gallery_items.blog_id (media stream) │
│               + canvas media embedded in the post (not rows) │
│    └── 🖼️ PHOTOS not in a post   gallery_items.trip_id        │
└──────────────────────────────────────────────────────────────┘

📍 LOCATION (shared place, reusable across trips) — "Kyoto, Japan"
```

**Why Location stays a separate table.** A pin is a place, and places recur. If you
visit Kyoto in 2024 and again in 2026, that should be **one pin with two trips' worth of
stops**, not two pins on top of each other. A trip *references* locations through stops.
It does not own them.

### 2.2 Cardinalities

| Relationship | Cardinality | Rule |
|---|---|---|
| Trip → Stop | 1 — 1..* | A trip has ≥1 stop, ordered by `ordinal`. |
| Stop → Location | * — 1 | Many stops (across trips) may point at one location. |
| Trip → Blog | 1 — 0..* | `blogs.trip_id`, nullable. |
| Blog → Location | * — 0..1 | If the post has a trip, its location **must be one of that trip's stops**. |
| Blog → Photo | 1 — 0..* | `gallery_items.blog_id`. The photo inherits the post's trip. |
| Trip → Photo | 1 — 0..* | `gallery_items.trip_id`. Standalone trip photos. |
| Photo → Location | * — 0..1 | Derived: nearest stop of its trip to the photo's EXIF GPS, else the post's stop. |

### 2.3 Schema change (new migration)

```sql
create table public.trip_stops (
  id text primary key default gen_random_uuid()::text,
  trip_id text not null references public.trips (id) on delete cascade,
  location_id text not null references public.locations (id) on delete restrict,
  ordinal int not null,
  arrive_date date,
  depart_date date,
  unique (trip_id, ordinal),
  check (depart_date is null or arrive_date is null or depart_date >= arrive_date)
);

-- Backfill: every existing trip becomes a one-stop trip.
insert into public.trip_stops (trip_id, location_id, ordinal, arrive_date, depart_date)
select id, location_id, 0, start_date, end_date from public.trips;

alter table public.trips add column cover_photo_id text references public.gallery_items (id) on delete set null;
alter table public.trips drop column location_id;   -- after app code reads stops
```

Trigger changes:

- `sync_blog_hierarchy`: stop *deriving* `location_id` from the trip. *Validate*
  instead: the post's `location_id` must be in its trip's stops, and the post's dates
  must fall in the trip's dates (fixes **A6**).
- `sync_gallery_item_hierarchy`: same date check. Location = the nearest stop to
  `lat/lng`, falling back to the post's location.
- Drop `cascade_trip_location`, since a trip no longer has one location.
- `location_id` on stops is `ON DELETE RESTRICT`. A pin that is part of a trip can't
  be deleted until it is removed from the trip (fixes **A7**). Pins with no stops and
  no posts delete freely.

### 2.4 Naming (fixes A2)

Use one term per entity at every layer. Rename gradually, keeping the old JS field names
as read aliases for one release.

| Concept | DB | JS / types | UI copy |
|---|---|---|---|
| Place on the globe | `locations` | `Location`, `locationId` (was `pinId`) | "Pin" / "Place" |
| Visit to a place within a trip | `trip_stops` | `TripStop` | "Stop" |
| Journey | `trips` | `Trip` | "Trip" |
| Story | `blogs` | `BlogPost` | "Story" |
| Uploaded photo/video | `gallery_items` | `GalleryItem` (`photoStore` → `galleryStore`) | "Photo" |
| Image inside a canvas | — (embedded) | `CanvasElement` | "Collage image" |

---

## 3. Globe visual specification

### 3.1 Marker types (after the change)

Only two kinds of marker exist at rest. Photo clusters are removed as separate markers
(fixes **A3**), and virtual pins are restyled (**A8**).

| Marker | Represents | Look | Size | Tooltip |
|---|---|---|---|---|
| **Place pin** | a `locations` row with ≥1 published post or photo | solid dot, `palette.blogPin` | `0.22 + 0.03 × (posts + photos/5)`, capped at 0.45 | Name · *N stories · M photos · K trips* |
| **Annotation pin** | a location with nothing under it | hollow ring, `palette.customPin` | 0.18 | Name · note |
| **Loose photo** | an **unfiled** gallery item with GPS (no trip, no post) | small dot, no pulse ring | 0.12 | Location name · *N photos · Add to a trip* |
| Legacy story *(transitional)* | a post with coords but no location | dashed ring | 0.2 | *"Not pinned yet. Open to pin."* |

Filed photos (with a trip or a post) **never** get their own marker. They add to their
place pin's count, and the pulsing ring moves to place pins that have new content in the
last 30 days.

### 3.2 Trip arcs (itinerary)

Use the `react-globe.gl` `arcsData` layer, which isn't used yet.

- **Data:** for each trip, pairs of consecutive stops `(stop[i], stop[i+1])` ordered by
  `ordinal`. One-stop trips produce no arcs.
- **At rest (no selection):** show arcs only for the 3 most recent trips. Colour them
  `palette.blogPin` at 35 % opacity, `arcAltitudeAutoScale 0.35`, static.
- **Trip selected** (from the quick card, the trip list or search):
  - Draw that trip's arcs at full opacity with `arcDashLength 0.4`, `arcDashGap 0.2`,
    `arcDashAnimateTime 2500`, so the dashes run in travel direction.
  - Label stops `1, 2, 3…` with `labelsData`, and dim pins outside the trip to 30 %.
  - Point the camera at the bounding box of the stops (`pointOfView`, 1000 ms).
- **Same location twice in one trip** (Tokyo → Kyoto → Tokyo): draw both arcs. The
  return leg gets `arcAltitude + 0.05` so the two don't overlap.
- Arcs are **not clickable**. Clicking a stop's pin opens the quick card scrolled to
  that trip.

### 3.3 Pin quick card (`PinQuickCard`)

Organize it by trip, not by flat lists:

```text
📍 Kyoto, Japan                       3 trips · 7 stories · 64 photos
──────────────────────────────────────────────────────────────────
▸ Japan Food Tour · Oct 1–9, 2026     stop 2 of 3  ⟶ Show route
     Stories at this stop (2)   ·   Photos at this stop (18)
▸ Cherry Blossom · Apr 2024           stop 1 of 1
──────────────────────────────────────────────────────────────────
Not in a trip: 1 story · 4 photos
```

Only content at **this stop** is listed. *Show route* selects the trip (§3.2).

---

## 4. User flows

1. **Create a trip.** Enter title and dates, then add stops by searching or by dropping
   pins on the globe. Each stop reuses an existing pin within `PIN_MERGE_RADIUS_KM`, or
   creates one. Arcs preview live as stops are added and reordered.
2. **Write a story.** Pick a trip. The stop defaults to the trip stop nearest the post's
   location (or the stop whose dates cover the post's start date). The post's own
   coordinates are cleared, and its globe position is its stop's pin (fixes **A4**).
3. **Upload photos.** EXIF date picks the trip (`tripCovering`, now over stops' dates),
   and EXIF GPS picks the nearest stop. Without GPS, the uploader picks a stop.
   Photos with no trip remain *unfiled* and show as loose photo markers.
4. **Photos in a story.** "Add from trip photos" in the editor sets `blog_id` on existing
   gallery items. Fresh uploads into a canvas stay embedded canvas media (**A5**). They
   are deliberately not gallery items, so a collage sticker sheet doesn't spill into
   the gallery. The read view lists both under "Photos in this story".

---

## 5. Implementation order

1. Migration: `trip_stops` + backfill + `cover_photo_id`. Keep `trips.location_id`
   for now, kept in sync with stop 0.
2. `tripStore` reads and writes stops. `buildStoryPins` joins via stops.
   `tripCovering` / `isWithinTrip` take stops into account.
3. Trip form: a stop list with drag-reorder.
4. Globe: remove photo-cluster markers for filed items, then add `arcsData` and trip
   selection.
5. DB-side date and stop validation triggers, and `ON DELETE RESTRICT` for stops.
6. Drop `trips.location_id`, then do the naming cleanup (`pinId` → `locationId`,
   `photoStore` → `galleryStore`).

## 6. Open questions

- Should a story be allowed to span several stops (a "Kyoto → Osaka day trip" post)?
  This spec says no: one stop per post. A road-trip blog may want `blog_stops`.
- Should arcs be shown at rest at all, or only on selection? With many trips, at-rest
  arcs may clutter the globe.
- Should a trip's cover photo come only from its gallery items, or can it be a separate
  upload?
