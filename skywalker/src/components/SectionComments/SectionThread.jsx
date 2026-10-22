import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../lib/auth";
import { AVATARS, avatarFor } from "../../lib/avatars";
import { COMMENT_MAX, NAME_MAX, REACTION_EMOJIS, getGuestProfile, saveGuestProfile } from "../../lib/commentStore";
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

/**
 * The comment/reaction trigger pinned beside one section, and the popover it
 * opens. `threads` comes from useSectionThreads.
 */
export default function SectionThread({ sectionId, threads, label = "this section" }) {
  const { bySection, reactions, openId, setOpenId } = threads;
  const open = openId === sectionId;
  const comments = bySection[sectionId] ?? [];
  const sectionReactions = reactions[sectionId] ?? {};
  const reactionTotal = Object.values(sectionReactions).reduce((sum, r) => sum + r.count, 0);
  const wrapRef = useRef(null);

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

  const active = comments.length > 0 || reactionTotal > 0;

  return (
    <div ref={wrapRef} className={`sc-wrap ${open ? "is-open" : ""} ${active ? "has-activity" : ""}`}>
      <button
        type="button"
        className="sc-trigger"
        aria-expanded={open}
        aria-label={`Comments and reactions on ${label}: ${comments.length} comments, ${reactionTotal} reactions`}
        onClick={() => setOpenId(open ? null : sectionId)}
      >
        <span className="sc-trigger-item">
          <span aria-hidden="true">💬</span>
          {comments.length > 0 && <span className="sc-trigger-count">{comments.length}</span>}
        </span>
        <span className="sc-trigger-item">
          <span aria-hidden="true">❤️</span>
          {reactionTotal > 0 && <span className="sc-trigger-count">{reactionTotal}</span>}
        </span>
      </button>

      {open && (
        <div className="sc-popover" role="dialog" aria-label={`Discussion on ${label}`}>
          <div className="sc-head">
            <strong>On {label}</strong>
            <button type="button" className="sc-close" aria-label="Close" onClick={() => setOpenId(null)}>
              ×
            </button>
          </div>

          <div className="sc-reactions" role="group" aria-label="Reactions">
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

          <CommentList comments={comments} threads={threads} />
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

function CommentForm({ sectionId, threads }) {
  const { user, username, isPending, enabled } = useAuth();
  // Pending accounts can't act as themselves yet, so they comment as guests.
  const member = enabled && user && username && !isPending ? { id: user.id, username, avatar: user.user_metadata?.avatar } : null;
  const [guest, setGuest] = useState(() => ({ name: "", email: "", ...getGuestProfile() }));
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim() || (!member && !guest.name.trim())) return;
    setBusy(true);
    setError("");
    try {
      await threads.addComment({ sectionId, body, guest: member ? null : guest, user: member });
      if (!member) saveGuestProfile({ name: guest.name.trim(), email: guest.email.trim() });
      setBody("");
    } catch (err) {
      console.error("Failed to post comment", err);
      setError("Couldn’t post your comment. Please try again.");
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
            maxLength={254}
            placeholder="Email (optional, never shown)"
            aria-label="Email (optional, never shown publicly)"
            autoComplete="email"
            value={guest.email}
            onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
          />
        </div>
      )}
      <textarea
        required
        rows={3}
        maxLength={COMMENT_MAX}
        placeholder="Add a comment…"
        aria-label="Comment"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {error && <p className="sc-error">{error}</p>}
      <div className="sc-form-foot">
        {!member && <span className="sc-hint">Posting as a guest</span>}
        <button type="submit" className="sc-submit" disabled={busy || !body.trim() || (!member && !guest.name.trim())}>
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
