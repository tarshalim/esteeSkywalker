import { mockBlogs } from "../data/blogs";
import { delay, readJSON, writeJSON } from "./storage";
import { supabase, unwrap, fromRows } from "./supabase";

// Blogs/templates API: Supabase `blogs`/`templates` tables when configured,
// otherwise a localStorage mock. Every function returns a Promise so callers
// don't care which backend is active.

const BLOGS_KEY = "skywalker.blogs.v1";
const TEMPLATES_KEY = "skywalker.templates.v1";

function ensureSeeded() {
  if (localStorage.getItem(BLOGS_KEY) == null) {
    writeJSON(BLOGS_KEY, mockBlogs);
  }
}

function toBlogRow(blog) {
  return {
    id: blog.id,
    track_x: blog.trackX ?? 0,
    status: blog.status ?? "draft",
    data: blog,
    updated_at: blog.updatedAt ?? new Date().toISOString(),
  };
}

async function loadBlogs() {
  if (supabase) {
    return fromRows(unwrap(await supabase.from("blogs").select("data").order("track_x")));
  }
  ensureSeeded();
  return readJSON(BLOGS_KEY, []);
}

async function saveBlog(blog, blogs) {
  if (supabase) {
    unwrap(await supabase.from("blogs").upsert(toBlogRow(blog)));
    return blog;
  }
  writeJSON(BLOGS_KEY, blogs);
  return delay(blog);
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
      const postDate = blog.postDate ?? blog.date ?? blogs[idx].postDate ?? blogs[idx].date;
      const updated = {
        ...blogs[idx],
        ...blog,
        date: postDate,
        postDate,
        year: new Date(postDate).getFullYear(),
        updatedAt: now,
      };
      blogs[idx] = updated;
      return saveBlog(updated, blogs);
    }
  }

  let id = slugify(blog.title || "untitled");
  if (blogs.some((b) => b.id === id)) id = `${id}-${Date.now().toString(36)}`;

  const trackX = blog.trackX ?? (blogs.length === 0 ? 900 : Math.max(...blogs.map((b) => b.trackX)) + 1000);

  const postDate = blog.postDate ?? blog.date ?? now.slice(0, 10);
  const created = {
    laneOffset: 0,
    status: "draft",
    countryCode: "",
    countryName: "",
    ...blog,
    id,
    trackX,
    date: postDate,
    postDate,
    year: new Date(postDate).getFullYear(),
    createdAt: now,
    updatedAt: now,
  };
  blogs.push(created);
  return saveBlog(created, blogs);
}

export async function getTemplates() {
  if (supabase) {
    return fromRows(unwrap(await supabase.from("templates").select("data").order("created_at")));
  }
  return delay(readJSON(TEMPLATES_KEY, []));
}

export async function saveTemplate({ name, title, coverImage, blocks }) {
  const template = {
    id: `tpl_${Date.now().toString(36)}`,
    name,
    title,
    coverImage,
    blocks,
    createdAt: new Date().toISOString(),
  };
  if (supabase) {
    unwrap(await supabase.from("templates").insert({ id: template.id, data: template }));
    return template;
  }
  const templates = readJSON(TEMPLATES_KEY, []);
  templates.push(template);
  writeJSON(TEMPLATES_KEY, templates);
  return delay(template);
}

export async function getTemplateById(id) {
  if (supabase) {
    const row = unwrap(await supabase.from("templates").select("data").eq("id", id).maybeSingle());
    return row?.data ?? null;
  }
  const templates = readJSON(TEMPLATES_KEY, []);
  return delay(templates.find((t) => t.id === id) ?? null);
}

export async function deleteTemplate(id) {
  if (supabase) {
    unwrap(await supabase.from("templates").delete().eq("id", id));
    return true;
  }
  const templates = readJSON(TEMPLATES_KEY, []).filter((t) => t.id !== id);
  writeJSON(TEMPLATES_KEY, templates);
  return delay(true);
}
