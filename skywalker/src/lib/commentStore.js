import { infraErrorMessage } from "./errors";
import { delay, makeId, readJSON, writeJSON } from "./storage";
import { supabase, unwrap } from "./supabase";
import { MOCK_KEYS } from "./mockCascades";

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

const COMMENTS_KEY = MOCK_KEYS.comments;
const REACTIONS_KEY = MOCK_KEYS.reactions;
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

// The shape section_reactor accepts; any other key makes every toggle fail
// with "Missing reactor key".
const GUEST_KEY_RE = /^[A-Za-z0-9-]{16,64}$/;

// crypto.randomUUID only exists in secure contexts (HTTPS, localhost), so a
// phone testing the dev server over the LAN needs the getRandomValues path.
function randomKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A random per-browser id so guests can toggle their own reactions. */
export function guestKey() {
  let key = readJSON(GUEST_KEY, null);
  if (typeof key !== "string" || !GUEST_KEY_RE.test(key)) {
    key = randomKey();
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

// Postgres' char_length counts code points, not UTF-16 units like .length.
const charLength = (s) => [...s].length;

// The same character classes the stamp_section_comment trigger strips, plus
// NUL, which Postgres text can't hold at all (the insert would fail outright).
// eslint-disable-next-line no-control-regex
const BODY_CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
// eslint-disable-next-line no-control-regex
const NAME_CONTROL_RE = /[\u0000-\u001F\u007F]/g;

/** The body as the trigger stores it: control characters other than
 * newline/tab/CR removed, then trimmed. */
export const cleanCommentBody = (body) => body.replace(BODY_CONTROL_RE, "").trim();

/** The guest name as the trigger stores it: control characters removed, runs of
 * whitespace collapsed to one space, trimmed. */
export const cleanGuestName = (name) => name.replace(NAME_CONTROL_RE, "").replace(/\s+/g, " ").trim();

/** @returns {?string} what's wrong with a comment body, or null if it's fine (same rule as the column check) */
export function validateCommentBody(body) {
  const clean = cleanCommentBody(body ?? "");
  if (!clean) return "Please write a comment first.";
  if (charLength(clean) > COMMENT_MAX) return `Comments can be up to ${COMMENT_MAX} characters.`;
  return null;
}

/** @returns {?string} what's wrong with a guest's name/email, or null if it's fine */
export function validateGuest({ name, email }) {
  const n = cleanGuestName(name ?? "");
  if (!n) return "Please enter your name.";
  if (charLength(n) > NAME_MAX) return `Names can be up to ${NAME_MAX} characters.`;
  const e = (email ?? "").trim();
  if (!e || charLength(e) > EMAIL_MAX || !EMAIL_RE.test(e)) return "Please enter a valid email address.";
  return null;
}

// The trigger tags its errors with these hints.
const ERROR_MESSAGES = {
  invalid_name: "Please enter your name.",
  invalid_email: "Please enter a valid email address.",
  rate_limited: "You’re commenting a little fast — please wait a few minutes and try again.",
  duplicate: "You’ve already posted that comment.",
};

// A member's comment only gets a guest error when the server no longer sees the
// account as approved (its role changed since the page loaded). The form shows
// no name/email fields then, so "enter a valid email" would be a dead end.
const MEMBER_DEMOTED = "Your account can’t comment as itself right now. Reload the page and try again.";

/**
 * A reader-facing message for a failed comment post.
 * @param {unknown} err
 * @param {{ member?: boolean }} [opts] whether the post was sent as a signed-in member
 */
export function commentErrorMessage(err, { member = false } = {}) {
  const hint = /** @type {any} */ (err)?.hint;
  if (hint === "invalid_guest" || hint === "invalid_body") return /** @type {any} */ (err).message;
  if (member && (hint === "invalid_name" || hint === "invalid_email")) return MEMBER_DEMOTED;
  return ERROR_MESSAGES[hint] ?? infraErrorMessage(err) ?? "Couldn’t post your comment. Please try again.";
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
  const bodyProblem = validateCommentBody(body);
  if (bodyProblem) throw Object.assign(new Error(bodyProblem), { hint: "invalid_body" });
  if (!user) {
    const problem = validateGuest(guest ?? { name: "", email: "" });
    if (problem) throw Object.assign(new Error(problem), { hint: "invalid_guest" });
  }
  const cleanBody = cleanCommentBody(body);
  if (supabase) {
    const row = unwrap(
      await supabase
        .from("section_comments")
        .insert({
          blog_id: blogId,
          section_id: sectionId,
          body: cleanBody,
          // Required by the column; the trigger overwrites it for accounts.
          author_name: (guest && cleanGuestName(guest.name)) || user?.username || "Guest",
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
    body: cleanBody,
    userId: user?.id ?? null,
    authorName: user ? user.username : cleanGuestName(guest.name),
    authorAvatar: user?.avatar ?? null,
    isGuest: !user,
    createdAt: new Date().toISOString(),
  };
  writeJSON(COMMENTS_KEY, [...readJSON(COMMENTS_KEY, []), comment]);
  return delay(comment);
}

/**
 * Only the comment's author or an admin may delete it (the "delete own comment
 * or moderate" policy). RLS doesn't raise on a refused delete, it just matches
 * no rows, so a 0-row result is checked: still there → refused; gone → someone
 * already deleted it, which is the outcome the caller wanted anyway.
 */
export async function deleteSectionComment(id) {
  if (supabase) {
    const deleted = unwrap(await supabase.from("section_comments").delete().eq("id", id).select("id"));
    if (deleted?.length) return true;
    const still = unwrap(await supabase.from("section_comments").select("id").eq("id", id));
    if (still?.length) throw new Error("You can only delete your own comments.");
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

/**
 * The optimistic local flip of one reaction: on ↔ off, count ±1 (never below 0).
 * @param {ReactionMap} map
 * @returns {ReactionMap} a new map; the input isn't changed
 */
export function flipReaction(map, sectionId, emoji) {
  const section = map[sectionId] ?? {};
  const prev = section[emoji] ?? { count: 0, mine: false };
  const next = { count: Math.max(0, prev.count + (prev.mine ? -1 : 1)), mine: !prev.mine };
  return { ...map, [sectionId]: { ...section, [emoji]: next } };
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
