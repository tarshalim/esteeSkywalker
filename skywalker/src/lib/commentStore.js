import { delay, makeId, readJSON, writeJSON } from "./storage";
import { supabase, unwrap } from "./supabase";

// Section-anchored comments and emoji reactions: Supabase `section_comments`
// / `section_reactions` (see the section_comments migration) when configured,
// otherwise a localStorage mock. A section is a block id or canvas element id.

/**
 * @typedef {{ id: string, sectionId: string, body: string, userId: ?string, authorName: string,
 *   authorAvatar: ?string, isGuest: boolean, createdAt: string }} SectionComment
 * @typedef {{ [sectionId: string]: { [emoji: string]: { count: number, mine: boolean } } }} ReactionMap
 */

export const REACTION_EMOJIS = ["❤️", "👏", "😍", "📍", "😂"];
export const COMMENT_MAX = 2000;
export const NAME_MAX = 60;
export const EMAIL_MAX = 254;
// Same shape the stamp_section_comment trigger enforces.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const COMMENTS_KEY = "skywalker.sectionComments.v1";
const REACTIONS_KEY = "skywalker.sectionReactions.v1";
const GUEST_KEY = "skywalker.guestKey.v1";
const GUEST_PROFILE_KEY = "skywalker.guestProfile.v1";

const COMMENT_COLUMNS = "id, section_id, body, user_id, author_name, author_avatar, is_guest, created_at";

const fromRow = (r) => ({
  id: r.id,
  sectionId: r.section_id,
  body: r.body,
  userId: r.user_id,
  authorName: r.author_name,
  authorAvatar: r.author_avatar,
  isGuest: r.is_guest,
  createdAt: r.created_at,
});

/** A random per-browser id so guests can toggle their own reactions. */
export function guestKey() {
  let key = readJSON(GUEST_KEY, null);
  if (!key) {
    key = crypto.randomUUID();
    try {
      writeJSON(GUEST_KEY, key);
    } catch {
      // Storage blocked: reactions still work for this page view.
    }
  }
  return key;
}

/** The name/email a guest last commented with, so they don't retype it. */
export const getGuestProfile = () => readJSON(GUEST_PROFILE_KEY, { name: "", email: "" });
export function saveGuestProfile(profile) {
  try {
    writeJSON(GUEST_PROFILE_KEY, profile);
  } catch {
    // Not worth failing a comment over.
  }
}

/** @returns {?string} what's wrong with a guest's name/email, or null if it's fine */
export function validateGuest({ name, email }) {
  if (!name.trim()) return "Please enter your name.";
  if (name.trim().length > NAME_MAX) return `Names can be up to ${NAME_MAX} characters.`;
  const e = email.trim();
  if (!e || e.length > EMAIL_MAX || !EMAIL_RE.test(e)) return "Please enter a valid email address.";
  return null;
}

// The trigger tags its errors with these hints.
const ERROR_MESSAGES = {
  invalid_name: "Please enter your name.",
  invalid_email: "Please enter a valid email address.",
  rate_limited: "You’re commenting a little fast — please wait a few minutes and try again.",
  duplicate: "You’ve already posted that comment.",
};

/** A reader-facing message for a failed comment post. */
export function commentErrorMessage(err) {
  if (err?.hint === "invalid_guest") return err.message;
  return ERROR_MESSAGES[err?.hint] ?? "Couldn’t post your comment. Please try again.";
}

/** @returns {Promise<SectionComment[]>} oldest first */
export async function getSectionComments(blogId) {
  if (supabase) {
    const rows = unwrap(
      await supabase.from("section_comments").select(COMMENT_COLUMNS).eq("blog_id", blogId).order("created_at")
    );
    return rows.map(fromRow);
  }
  return delay(readJSON(COMMENTS_KEY, []).filter((c) => c.blogId === blogId));
}

/**
 * Signed-in, approved users post as themselves (the server fills in their
 * name and avatar); everyone else needs `guest.name` and `guest.email`.
 * @param {{ blogId: string, sectionId: string, body: string, guest?: ?{ name: string, email: string }, user?: ?{ id: string, username: string, avatar?: string } }} input
 * @returns {Promise<SectionComment>}
 */
export async function addSectionComment({ blogId, sectionId, body, guest = null, user = null }) {
  if (!user) {
    const problem = validateGuest(guest ?? { name: "", email: "" });
    if (problem) throw Object.assign(new Error(problem), { hint: "invalid_guest" });
  }
  if (supabase) {
    const row = unwrap(
      await supabase
        .from("section_comments")
        .insert({
          blog_id: blogId,
          section_id: sectionId,
          body: body.trim(),
          // Required by the column; the trigger overwrites it for accounts.
          author_name: guest?.name.trim() || user?.username || "Guest",
          author_email: guest?.email?.trim() || null,
        })
        .select(COMMENT_COLUMNS)
        .single()
    );
    return fromRow(row);
  }
  const comment = {
    id: makeId("cmt"),
    blogId,
    sectionId,
    body: body.trim(),
    userId: user?.id ?? null,
    authorName: user ? user.username : guest.name.trim(),
    authorAvatar: user?.avatar ?? null,
    isGuest: !user,
    createdAt: new Date().toISOString(),
  };
  writeJSON(COMMENTS_KEY, [...readJSON(COMMENTS_KEY, []), comment]);
  return delay(comment);
}

export async function deleteSectionComment(id) {
  if (supabase) {
    unwrap(await supabase.from("section_comments").delete().eq("id", id));
    return true;
  }
  writeJSON(COMMENTS_KEY, readJSON(COMMENTS_KEY, []).filter((c) => c.id !== id));
  return delay(true);
}

/** @returns {Promise<ReactionMap>} */
export async function getSectionReactions(blogId) {
  /** @type {ReactionMap} */
  const map = {};
  if (supabase) {
    const rows = unwrap(await supabase.rpc("section_reaction_counts", { p_blog: blogId, guest_key: guestKey() }));
    for (const r of rows ?? []) {
      (map[r.section_id] ??= {})[r.emoji] = { count: Number(r.count), mine: r.mine };
    }
    return map;
  }
  const me = guestKey();
  for (const r of readJSON(REACTIONS_KEY, []).filter((r) => r.blogId === blogId)) {
    const entry = ((map[r.sectionId] ??= {})[r.emoji] ??= { count: 0, mine: false });
    entry.count += 1;
    entry.mine ||= r.reactor === me;
  }
  return delay(map);
}

/** Adds or removes this reader's reaction. @returns {Promise<boolean>} whether it's now on */
export async function toggleSectionReaction(blogId, sectionId, emoji) {
  if (supabase) {
    return unwrap(
      await supabase.rpc("toggle_section_reaction", {
        p_blog: blogId,
        p_section: sectionId,
        p_emoji: emoji,
        guest_key: guestKey(),
      })
    );
  }
  const me = guestKey();
  const all = readJSON(REACTIONS_KEY, []);
  const match = (r) => r.blogId === blogId && r.sectionId === sectionId && r.emoji === emoji && r.reactor === me;
  const on = !all.some(match);
  writeJSON(REACTIONS_KEY, on ? [...all, { blogId, sectionId, emoji, reactor: me }] : all.filter((r) => !match(r)));
  return delay(on);
}
