import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../lib/auth";
import { AVATARS, avatarFor } from "../../lib/avatars";
import {
  COMMENT_MAX,
  EMAIL_MAX,
  NAME_MAX,
  REACTION_EMOJIS,
  commentErrorMessage,
  getGuestProfile,
  saveGuestProfile,
  validateGuest,
} from "../../lib/commentStore";
import "./SectionComments.css";

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];
function timeAgo(iso) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

function CommentAvatar({ comment }) {
  if (comment.isGuest) {
    return (
      <span className="sc-avatar sc-avatar--guest" aria-hidden="true">
        {comment.authorName.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }
  const avatar = AVATARS.find((a) => a.id === comment.authorAvatar) ?? avatarFor({ id: comment.userId });
  return <img className="sc-avatar" src={avatar.src} alt="" />;
}

// The reaction summary shows at most this many emojis, most used first.
const TOP_REACTIONS = 3;

/**
 * The activity bar pinned beside one section, and the popover it opens.
 * Sections with comments or reactions always show count badges; the 💬/❤️
 * action buttons stay hidden until the reader clicks the section (or tabs
 * to it). `threads` comes from useSectionThreads.
 */
export default function SectionThread({ sectionId, threads, label = "this section" }) {
  const { bySection, reactions, openId, setOpenId, revealedId } = threads;
  const open = openId === sectionId;
  const revealed = open || revealedId === sectionId;
  const comments = bySection[sectionId] ?? [];
  const sectionReactions = reactions[sectionId] ?? {};
  const reactionTotal = Object.values(sectionReactions).reduce((sum, r) => sum + r.count, 0);
  const reactedByMe = Object.values(sectionReactions).some((r) => r.mine);
  const topReactions = Object.entries(sectionReactions)
    .filter(([, r]) => r.count > 0)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, TOP_REACTIONS)
    .map(([emoji]) => emoji);
  const wrapRef = useRef(null);
  const reactionsRef = useRef(null);
  const commentsRef = useRef(null);
  // Which part of the popover the reader asked for: "comments" or "reactions".
  const [focusPart, setFocusPart] = useState("comments");

  const openAt = (part) => {
    if (open && focusPart === part) {
      setOpenId(null);
      return;
    }
    setFocusPart(part);
    setOpenId(sectionId);
  };

  useEffect(() => {
    if (!open) return;
    const target = focusPart === "reactions" ? reactionsRef : commentsRef;
    target.current?.scrollIntoView({ block: "nearest" });
  }, [open, focusPart]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpenId(null);
    };
    const onKey = (e) => e.key === "Escape" && setOpenId(null);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpenId]);

  return (
    <div ref={wrapRef} className={`sc-wrap ${open ? "is-open" : ""} ${revealed ? "is-revealed" : ""}`}>
      <div className="sc-bar">
        {/* Passive badges: always visible once the section has activity. */}
        {comments.length > 0 && (
          <button
            type="button"
            className="sc-badge sc-badge--comments"
            aria-expanded={open && focusPart === "comments"}
            aria-label={`${comments.length} ${comments.length === 1 ? "comment" : "comments"} on ${label}`}
            onClick={() => openAt("comments")}
          >
            <span aria-hidden="true">💬</span>
            <span className="sc-badge-count">{comments.length}</span>
          </button>
        )}
        {reactionTotal > 0 && (
          <button
            type="button"
            className={`sc-badge sc-badge--reactions ${reactedByMe ? "is-mine" : ""}`}
            aria-expanded={open && focusPart === "reactions"}
            aria-label={`${reactionTotal} ${reactionTotal === 1 ? "reaction" : "reactions"} on ${label}: ${topReactions.join(" ")}`}
            onClick={() => openAt("reactions")}
          >
            <span className="sc-badge-stack" aria-hidden="true">
              {topReactions.map((emoji) => (
                <span key={emoji}>{emoji}</span>
              ))}
            </span>
            <span className="sc-badge-count">{reactionTotal}</span>
          </button>
        )}

        {/* Active controls: revealed when the reader clicks or tabs into the section. */}
        <div className="sc-actions" role="group" aria-label={`Discuss ${label}`}>
          <button
            type="button"
            className="sc-action"
            aria-label={`Comment on ${label}`}
            onClick={() => openAt("comments")}
          >
            <span aria-hidden="true">💬</span>
          </button>
          <button
            type="button"
            className="sc-action"
            aria-label={`React to ${label}`}
            onClick={() => openAt("reactions")}
          >
            <span aria-hidden="true">❤️</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="sc-popover" role="dialog" aria-label={`Discussion on ${label}`}>
          <div className="sc-head">
            <strong>On {label}</strong>
            <button type="button" className="sc-close" aria-label="Close" onClick={() => setOpenId(null)}>
              ×
            </button>
          </div>

          <div ref={reactionsRef} className="sc-reactions" role="group" aria-label="Reactions">
            {REACTION_EMOJIS.map((emoji) => {
              const r = sectionReactions[emoji];
              return (
                <button
                  key={emoji}
                  type="button"
                  className={`sc-reaction ${r?.mine ? "is-mine" : ""}`}
                  aria-pressed={Boolean(r?.mine)}
                  onClick={() => threads.toggleReaction(sectionId, emoji)}
                >
                  <span aria-hidden="true">{emoji}</span>
                  {r?.count > 0 && <span className="sc-reaction-count">{r.count}</span>}
                </button>
              );
            })}
          </div>

          <div ref={commentsRef}>
            <CommentList comments={comments} threads={threads} />
          </div>
          <CommentForm sectionId={sectionId} threads={threads} />
        </div>
      )}
    </div>
  );
}

function CommentList({ comments, threads }) {
  const { user, isAdmin, enabled } = useAuth();
  // The offline mock has no accounts; its single user moderates everything.
  const canDelete = (c) => !enabled || isAdmin || (user && c.userId === user.id);

  if (comments.length === 0) return <p className="sc-empty">No comments here yet — start the conversation.</p>;
  return (
    <ul className="sc-list">
      {comments.map((c) => (
        <li key={c.id} className="sc-comment">
          <CommentAvatar comment={c} />
          <div className="sc-comment-main">
            <div className="sc-comment-meta">
              <span className="sc-name">{c.authorName}</span>
              {c.isGuest && <span className="sc-guest-badge">Guest</span>}
              <time dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString()}>
                {timeAgo(c.createdAt)}
              </time>
              {canDelete(c) && (
                <button
                  type="button"
                  className="sc-delete"
                  onClick={() => {
                    if (window.confirm("Delete this comment?")) {
                      threads.removeComment(c.id).catch((err) => console.error("Failed to delete comment", err));
                    }
                  }}
                >
                  Delete
                </button>
              )}
            </div>
            <p className="sc-body">{c.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Spam bots tend to fill every field and submit instantly; people do neither.
const MIN_FILL_MS = 2000;

function CommentForm({ sectionId, threads }) {
  const { user, username, isPending, enabled } = useAuth();
  // Pending accounts can't act as themselves yet, so they comment as guests.
  const member = enabled && user && username && !isPending ? { id: user.id, username, avatar: user.user_metadata?.avatar } : null;
  const [guest, setGuest] = useState(() => {
    const saved = getGuestProfile();
    return { name: saved.name ?? "", email: saved.email || user?.email || "" };
  });
  const [body, setBody] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const openedAt = useRef(Date.now());

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    if (!member) {
      const problem = validateGuest(guest);
      if (problem) {
        setError(problem);
        return;
      }
    }
    // Looks like a bot: act as if it worked so it doesn't learn to adapt.
    if (honeypot || Date.now() - openedAt.current < MIN_FILL_MS) {
      setBody("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await threads.addComment({ sectionId, body, guest: member ? null : guest, user: member });
      if (!member) saveGuestProfile({ name: guest.name.trim(), email: guest.email.trim() });
      setBody("");
    } catch (err) {
      console.error("Failed to post comment", err);
      setError(commentErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="sc-form" onSubmit={submit}>
      {member ? (
        <p className="sc-as">
          <img className="sc-avatar sc-avatar--sm" src={avatarFor(user).src} alt="" />
          Commenting as <strong>@{member.username}</strong>
        </p>
      ) : (
        <div className="sc-guest-fields">
          <input
            type="text"
            required
            maxLength={NAME_MAX}
            placeholder="Your name *"
            aria-label="Your name (required)"
            autoComplete="name"
            value={guest.name}
            onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))}
          />
          <input
            type="email"
            required
            maxLength={EMAIL_MAX}
            placeholder="Email * (never shown)"
            aria-label="Email (required, never shown publicly)"
            autoComplete="email"
            value={guest.email}
            onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
          />
        </div>
      )}
      {/* Honeypot: hidden from people and screen readers, irresistible to bots. */}
      <div className="sc-hp" aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>
      <textarea
        required
        rows={3}
        maxLength={COMMENT_MAX}
        placeholder="Add a comment…"
        aria-label="Comment"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {error && (
        <p className="sc-error" role="alert">
          {error}
        </p>
      )}
      <div className="sc-form-foot">
        {!member && <span className="sc-hint">Posting as a guest</span>}
        <button
          type="submit"
          className="sc-submit"
          disabled={busy || !body.trim() || (!member && (!guest.name.trim() || !guest.email.trim()))}
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
