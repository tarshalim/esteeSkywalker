import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, ImageOff, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteBlog, getBlogs } from "../../lib/blogStore";
import { draftChecklist } from "../../lib/blogTaxonomy";
import { PLACEHOLDER_COVER } from "../../lib/media";
import { useAsync } from "../../hooks/useAsync";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function lastModified(blog) {
  const iso = blog.updatedAt ?? blog.createdAt;
  return iso ? dateFormat.format(new Date(iso)) : "Unknown";
}

function TabSwitch() {
  const base = "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors";
  return (
    <nav aria-label="Blog views" className="inline-flex gap-1 rounded-full border-2 p-1" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
      <Link to="/blogs" className={base} style={{ color: "var(--text)" }}>
        Published
      </Link>
      <span aria-current="page" className={base} style={{ background: "var(--blue)", color: "#ffffff" }}>
        Saved Drafts
      </span>
    </nav>
  );
}

function DraftCard({ draft, onDelete, deleting }) {
  const checklist = draftChecklist(draft);
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = Math.round((doneCount / checklist.length) * 100);
  const place = [draft.city, draft.countryName].filter(Boolean).join(", ") || draft.location?.name;
  const hasCover = Boolean(draft.coverImage) && draft.coverImage !== PLACEHOLDER_COVER;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex flex-col overflow-hidden rounded-2xl border-2 sm:flex-row"
      style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
    >
      {hasCover ? (
        <img src={draft.coverImage} alt="" className="h-36 w-full shrink-0 object-cover sm:h-auto sm:w-44" loading="lazy" />
      ) : (
        <div
          className="flex h-36 w-full shrink-0 items-center justify-center sm:h-auto sm:w-44"
          style={{ background: "var(--bg-panel)", color: "var(--text-muted)" }}
        >
          <ImageOff size={28} aria-hidden="true" />
          <span className="sr-only">No cover image yet</span>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold" style={{ color: "var(--text-strong, var(--text))" }}>
            {draft.title || "Untitled Blog Post"}
          </h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {place && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} aria-hidden="true" />
                {place}
              </span>
            )}
            <span>Last edited {lastModified(draft)}</span>
          </p>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            <span>{doneCount === checklist.length ? "Ready to publish" : `${doneCount} of ${checklist.length} ready`}</span>
            <span>{pct}%</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full"
            style={{ background: "var(--border)" }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Draft completion"
          >
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--blue)" }} />
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {checklist.map((c) => (
              <li key={c.label} className="inline-flex items-center gap-1">
                {c.done ? (
                  <CheckCircle2 size={12} style={{ color: "var(--blue)" }} aria-hidden="true" />
                ) : (
                  <Circle size={12} aria-hidden="true" />
                )}
                <span className={c.done ? "" : "font-semibold"}>
                  {c.label}
                  <span className="sr-only">{c.done ? " (done)" : " (missing)"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto flex gap-2">
          <Link
            to={`/blogs/edit/${draft.id}`}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-bold sm:flex-none sm:px-5"
            style={{ background: "linear-gradient(135deg, var(--yellow-bright), var(--yellow))", color: "var(--blue-deep)" }}
          >
            <Pencil size={14} aria-hidden="true" />
            Edit
          </Link>
          <button
            type="button"
            onClick={() => onDelete(draft)}
            disabled={deleting}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border-2 text-sm font-semibold text-red-600 disabled:opacity-50 sm:flex-none sm:px-5"
            style={{ borderColor: "var(--border)" }}
          >
            <Trash2 size={14} aria-hidden="true" />
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </motion.li>
  );
}

/** "Saved Drafts" tab: every unpublished post, most recently edited first. */
export default function Drafts() {
  const { data: blogs, loading, error, setData } = useAsync(getBlogs, [], []);
  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const drafts = blogs
    .filter((b) => b.status === "draft")
    .sort((a, b) => (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? ""));

  const handleDelete = async (draft) => {
    if (!window.confirm(`Delete the draft “${draft.title || "Untitled Blog Post"}”? This can't be undone.`)) return;
    setDeletingId(draft.id);
    setActionError(null);
    try {
      await deleteBlog(draft.id);
      setData((prev) => prev.filter((b) => b.id !== draft.id));
    } catch (err) {
      setActionError(`Couldn't delete: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="min-h-dvh px-4 pt-[calc(var(--nav-bottom)+3rem)] pb-16 sm:pt-[calc(var(--nav-bottom)+4.5rem)]"
      style={{ background: "var(--bg)" }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabSwitch />
          <Link
            to="/blogs/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold"
            style={{ background: "var(--bg-panel)", color: "var(--text)" }}
          >
            <Plus size={15} aria-hidden="true" />
            New story
          </Link>
        </div>

        <header>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl" style={{ color: "var(--text-strong, var(--text))" }}>
            Saved Drafts
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {loading ? "Loading drafts…" : `${drafts.length} ${drafts.length === 1 ? "story" : "stories"} in progress`}
          </p>
        </header>

        {(error || actionError) && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{actionError ?? "Couldn't load your drafts."}</p>
        )}

        {!loading && drafts.length === 0 && !error && (
          <p className="rounded-2xl border-2 border-dashed px-4 py-10 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            No drafts yet.
          </p>
        )}

        <ul className="flex flex-col gap-4">
          {drafts.map((d) => (
            <DraftCard key={d.id} draft={d} onDelete={handleDelete} deleting={deletingId === d.id} />
          ))}
        </ul>
      </div>
    </div>
  );
}
