import { makeId } from "./storage";
import { supabase } from "./supabase";
import { createCollection } from "./collection";
import { deleteBlogAudio, getBlogMusic } from "./music";
import { deleteOrphanedMedia } from "./files";
import { dateYear } from "./dateFilters";
import { notifyDataChanged } from "./liveSync";
import { hasExactCoords, postLocationFields } from "./postLocation";
import { findBuiltInTemplate, normalizeTemplate } from "./templates";
import { MOCK_KEYS, cascadeBlogDelete, cascadeBlogTrip } from "./mockCascades";

// Blogs/templates API: Supabase `blogs`/`templates` tables when configured,
// otherwise a localStorage mock (both through lib/collection). Every function
// returns a Promise so callers don't care which backend is active.

const blogs = createCollection({
  table: "blogs",
  storageKey: MOCK_KEYS.blogs,
  orderBy: "track_x",
  label: "post",
  toRow: (blog) => ({
    track_x: blog.trackX ?? 0,
    status: blog.status ?? "draft",
    start_date: blog.startDate ?? null,
    end_date: blog.endDate ?? null,
    // A trip implies its location; the blogs trigger derives location_id from it.
    location_id: blog.pinId ?? null,
    trip_id: blog.tripId ?? null,
    updated_at: blog.updatedAt ?? new Date().toISOString(),
  }),
});
const templates = createCollection({ table: "templates", storageKey: "skywalker.templates.v1", label: "template" });

/**
 * A post is dated by `startDate` plus an optional `endDate` (null for a
 * single day). `postDate`/`date` stay mirrored to the start date for the
 * sort/filter code that predates ranges.
 */
function resolveDates(blog, prev = {}) {
  const startDate =
    blog.startDate ?? blog.postDate ?? blog.date ?? prev.startDate ?? prev.postDate ?? prev.date ?? new Date().toISOString().slice(0, 10);
  const endDate = "endDate" in blog ? blog.endDate || null : prev.endDate ?? null;
  if (endDate && endDate < startDate) throw new Error("End date can't be before the start date");
  return { startDate, endDate, postDate: startDate, date: startDate, year: dateYear(startDate) };
}

// Fields that were dropped from the model; cleared from posts as they're saved.
const REMOVED_FIELDS = ["tripType", "duration"];

function withoutRemovedFields(blog) {
  const next = { ...blog };
  for (const key of REMOVED_FIELDS) delete next[key];
  return next;
}

const RESERVED_IDS = new Set(["new", "drafts"]);

function slugify(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "post"
  );
}

/** A post's trail position; a missing or broken one counts as 0, like `track_x`'s default. */
const trailX = (blog) => (Number.isFinite(blog.trackX) ? blog.trackX : 0);

/** Where a new story goes: 1000 past the last one, so the trail keeps creation order. */
const FIRST_TRACK_X = 900;
const TRACK_X_STEP = 1000;
function nextTrackX(all) {
  return all.length === 0 ? FIRST_TRACK_X : Math.max(...all.map(trailX)) + TRACK_X_STEP;
}

export async function getBlogs() {
  // Mock mode keeps insertion order, so sort in both.
  return [...(await blogs.list())].sort((a, b) => trailX(a) - trailX(b));
}

export const getBlogById = blogs.get;

/**
 * Saves a post: merges into the existing one when `blog.id` matches, else
 * creates it with a slug id and the next trail position. Returns the post as
 * stored (in Supabase mode, after the triggers have run).
 */
export async function upsertBlog(blog) {
  const all = await blogs.list();
  const now = new Date().toISOString();

  const prev = blog.id ? all.find((b) => b.id === blog.id) : null;
  if (prev) {
    const updated = withoutRemovedFields({
      ...prev,
      ...blog,
      // Shallow-merging would replace `location` wholesale and drop the
      // lat/lng the globe needs whenever the payload only carries a name.
      location: { ...prev.location, ...blog.location },
      ...resolveDates(blog, prev),
      updatedAt: now,
    });
    const saved = await blogs.update(updated);
    notifyDataChanged("blogs");
    // Supabase: the blogs_cascade_trip trigger moves its photos along.
    if (!supabase) cascadeBlogTrip(prev, updated).forEach(notifyDataChanged);
    return saved;
  }

  let id = slugify(blog.title || "untitled");
  // /blogs/new and /blogs/drafts are routes, so a post with either id could never be opened.
  if (RESERVED_IDS.has(id) || all.some((b) => b.id === id)) id = `${id}-${Date.now().toString(36)}`;

  const trackX = Number.isFinite(blog.trackX) ? blog.trackX : nextTrackX(all);

  const created = withoutRemovedFields({
    laneOffset: 0,
    status: "draft",
    countryCode: "",
    countryName: "",
    ...blog,
    id,
    trackX,
    ...resolveDates(blog),
    createdAt: now,
    updatedAt: now,
  });
  const saved = await blogs.insert(created);
  notifyDataChanged("blogs");
  return saved;
}

export async function deleteBlog(id) {
  // Throws if RLS (or a concurrent delete) left the row in place.
  const blog = await blogs.remove(id);
  notifyDataChanged("blogs");
  if (supabase) {
    // The post is gone either way; leftover files are only logged.
    await Promise.all([deleteBlogAudio(getBlogMusic(blog)?.storagePath), deleteOrphanedMedia(blog, `post ${blog.id}`)]);
  } else {
    // Supabase: FK actions drop its comments and reactions and unattach its photos.
    cascadeBlogDelete(id).forEach(notifyDataChanged);
  }
  return true;
}

/**
 * Shows or hides a post without touching its content. A hidden post goes back
 * to being a draft, so it drops off the feed, globe and gallery; making it
 * public again needs the same country the editor's Publish requires.
 */
export async function setBlogVisibility(id, visible) {
  const blog = await getBlogById(id);
  if (!blog) throw new Error("This post no longer exists.");
  if (visible && !blog.countryCode) throw new Error("Add a country in the editor first.");
  const saved = await blogs.update({ ...blog, status: visible ? "published" : "draft", updatedAt: new Date().toISOString() });
  notifyDataChanged("blogs");
  return saved;
}

/**
 * Files posts under a globe pin (`pin` null unpins them). A post with no
 * coordinates of its own takes the pin's, so it can be placed and searched
 * like any other; posts that have their own exact spot keep it. A trip lives
 * at one location, so moving a post elsewhere takes it out of its trip.
 * @param {string[]} blogIds
 * @param {?import("./pinStore").Pin} pin
 */
export async function setBlogsPin(blogIds, pin) {
  const saved = [];
  // One at a time: upsertBlog rewrites the whole list in mock mode.
  for (const id of blogIds) {
    const blog = await getBlogById(id);
    if (!blog) continue;
    // A country-centroid fallback isn't a spot of its own, so the pin's replaces it.
    const location =
      pin && !hasExactCoords(blog.location)
        ? { name: postLocationFields(blog.location).name || pin.placeName || pin.title, lat: pin.lat, lng: pin.lng, approx: false }
        : undefined;
    const tripId = pin && blog.pinId === pin.id ? blog.tripId ?? null : null;
    const stopId = tripId ? blog.stopId ?? null : null;
    saved.push(await upsertBlog({ id, pinId: pin?.id ?? null, tripId, stopId, ...(location && { location }) }));
  }
  return saved;
}

/** The user's saved templates (built-ins live in lib/templates). */
export async function getTemplates() {
  return (await templates.list()).map(normalizeTemplate);
}

/** A saved or built-in template by id, normalized; null if there's none. */
export async function getTemplateById(id) {
  return findBuiltInTemplate(id) ?? normalizeTemplate(await templates.get(id));
}

/**
 * Deletes a saved template and the uploads only it still referenced (a post
 * deleted after the template was saved leaves its photos to the template).
 * `keep` is unsaved work that may use the same files, e.g. the editor's canvas
 * after the template was applied to it.
 */
export async function deleteTemplate(id, keep = null) {
  const removed = await templates.remove(id);
  await deleteOrphanedMedia(removed, `template ${id}`, keep);
  return removed;
}

export async function saveTemplate({ name, description = "", title, excerpt = "", coverImage, vibes = [], weather = null, blocks, canvas }) {
  const saved = await templates.insert({
    id: makeId("tpl"),
    name,
    category: "My template",
    description,
    title,
    excerpt,
    coverImage,
    vibes,
    weather,
    blocks,
    canvas,
    createdAt: new Date().toISOString(),
  });
  return normalizeTemplate(saved);
}
