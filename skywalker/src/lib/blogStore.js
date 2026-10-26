import { delay, readJSON, writeJSON, makeId } from "./storage";
import { supabase, unwrap, fromRows } from "./supabase";
import { createCollection } from "./collection";
import { deleteBlogAudio, getBlogMusic } from "./music";
import { deleteOrphanedMedia } from "./files";
import { notifyDataChanged } from "./liveSync";
import { hasCoords } from "./geo";
import { findBuiltInTemplate, normalizeTemplate } from "./templates";

// Blogs/templates API: Supabase `blogs`/`templates` tables when configured,
// otherwise a localStorage mock. Every function returns a Promise so callers
// don't care which backend is active.

const BLOGS_KEY = "skywalker.blogs.v1";
const templates = createCollection({ table: "templates", storageKey: "skywalker.templates.v1" });

function toBlogRow(blog) {
  return {
    id: blog.id,
    track_x: blog.trackX ?? 0,
    status: blog.status ?? "draft",
    start_date: blog.startDate ?? null,
    end_date: blog.endDate ?? null,
    // A trip implies its location; the blogs trigger derives location_id from it.
    location_id: blog.pinId ?? null,
    trip_id: blog.tripId ?? null,
    data: blog,
    updated_at: blog.updatedAt ?? new Date().toISOString(),
  };
}

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
  return { startDate, endDate, postDate: startDate, date: startDate, year: new Date(startDate).getFullYear() };
}

// Fields that were dropped from the model; cleared from posts as they're saved.
const REMOVED_FIELDS = ["tripType", "duration"];

function withoutRemovedFields(blog) {
  const next = { ...blog };
  for (const key of REMOVED_FIELDS) delete next[key];
  return next;
}

async function loadBlogs() {
  if (supabase) {
    return fromRows(unwrap(await supabase.from("blogs").select("data").order("track_x")));
  }
  return readJSON(BLOGS_KEY, []);
}

async function saveBlog(blog, blogs) {
  if (supabase) {
    unwrap(await supabase.from("blogs").upsert(toBlogRow(blog)));
  } else {
    writeJSON(BLOGS_KEY, blogs);
    await delay();
  }
  notifyDataChanged("blogs");
  return blog;
}

function slugify(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "post"
  );
}

export async function getBlogs() {
  const blogs = await loadBlogs();
  return delay([...blogs].sort((a, b) => a.trackX - b.trackX));
}

export async function getBlogById(id) {
  if (supabase) {
    const row = unwrap(await supabase.from("blogs").select("data").eq("id", id).maybeSingle());
    return row?.data ?? null;
  }
  const blogs = await loadBlogs();
  return delay(blogs.find((b) => b.id === id) ?? null);
}

export async function getNextTrackX() {
  const blogs = await loadBlogs();
  if (blogs.length === 0) return delay(900);
  return delay(Math.max(...blogs.map((b) => b.trackX)) + 1000);
}

export async function upsertBlog(blog) {
  const blogs = await loadBlogs();
  const now = new Date().toISOString();

  if (blog.id) {
    const idx = blogs.findIndex((b) => b.id === blog.id);
    if (idx !== -1) {
      const updated = withoutRemovedFields({
        ...blogs[idx],
        ...blog,
        // Shallow-merging would replace `location` wholesale and drop the
        // lat/lng the globe needs whenever the payload only carries a name.
        location: { ...blogs[idx].location, ...blog.location },
        ...resolveDates(blog, blogs[idx]),
        updatedAt: now,
      });
      blogs[idx] = updated;
      return saveBlog(updated, blogs);
    }
  }

  let id = slugify(blog.title || "untitled");
  if (blogs.some((b) => b.id === id)) id = `${id}-${Date.now().toString(36)}`;

  const trackX = blog.trackX ?? (blogs.length === 0 ? 900 : Math.max(...blogs.map((b) => b.trackX)) + 1000);

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
  blogs.push(created);
  return saveBlog(created, blogs);
}

export async function deleteBlog(id) {
  if (supabase) {
    const blog = await getBlogById(id);
    // RLS turns a forbidden delete into a silent no-op, so check a row actually went.
    const deleted = unwrap(await supabase.from("blogs").delete().eq("id", id).select("id"));
    if (deleted.length === 0) throw new Error("This post may already be gone, or you don't have permission to delete it.");
    // The post is gone either way; leftover files are only logged.
    notifyDataChanged("blogs");
    await Promise.all([deleteBlogAudio(getBlogMusic(blog)?.storagePath), deleteOrphanedMedia(blog, `post ${blog.id}`)]);
    return true;
  }
  const blogs = await loadBlogs();
  writeJSON(BLOGS_KEY, blogs.filter((b) => b.id !== id));
  await delay();
  notifyDataChanged("blogs");
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
  const updated = { ...blog, status: visible ? "published" : "draft", updatedAt: new Date().toISOString() };
  if (supabase) {
    // RLS turns a forbidden update into a silent no-op, so check a row actually changed.
    const rows = unwrap(await supabase.from("blogs").update(toBlogRow(updated)).eq("id", id).select("id"));
    if (rows.length === 0) throw new Error("You don't have permission to change this post.");
    notifyDataChanged("blogs");
    return updated;
  }
  return upsertBlog(updated);
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
    const location =
      pin && !hasCoords(blog.location)
        ? { name: blog.location?.name || pin.placeName || pin.title, lat: pin.lat, lng: pin.lng }
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

export const deleteTemplate = templates.remove;

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
