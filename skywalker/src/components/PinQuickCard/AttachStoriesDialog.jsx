import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Check, Search, X } from "lucide-react";
import { matchesQuery } from "../../lib/textMatch";
import { formatBlogDate } from "../../lib/dateFilters";
import { realCover } from "../../lib/media";
import CoverPlaceholder from "../CoverPlaceholder/CoverPlaceholder";

/**
 * Pick existing posts (drafts included) to file under a pin. Posts already
 * on another pin are listed with where they'd move from.
 *
 * @param {import("../../lib/pinStore").StoryPin} pin
 * @param {import("../../lib/pinStore").BlogPost[]} blogs - every post the editor can see
 * @param {Map<string, string>} pinTitles - pin id -> title, for "moves from …"
 * @param {function(string[]): void} onConfirm
 */
export default function AttachStoriesDialog({ pin, blogs, pinTitles, onConfirm, onCancel }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(() => new Set());

  const candidates = useMemo(() => {
    const onThisPin = new Set(pin.posts.map((p) => p.id));
    return blogs
      .filter((b) => !onThisPin.has(b.id))
      .filter((b) => matchesQuery(query, b.title, b.location?.name, b.city, b.countryName))
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }, [blogs, pin.posts, query]);

  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return createPortal(
    <motion.div
      className="fixed inset-0 flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-6"
      style={{ zIndex: "var(--z-modal)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        role="dialog"
        aria-labelledby="attach-stories-title"
        className="glass-panel flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-w-md sm:rounded-2xl"
        style={{ background: "var(--bg-panel-strong)", color: "var(--text)" }}
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 32, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 p-4 pb-2">
          <div className="min-w-0 flex-1">
            <h2 id="attach-stories-title" className="text-lg font-bold">
              Attach stories
            </h2>
            <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
              to {pin.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="-m-1 inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/10"
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <label className="mx-4 mb-2 flex items-center gap-2 rounded-full border px-3" style={{ borderColor: "var(--border)" }}>
          <Search size={15} aria-hidden="true" style={{ color: "var(--text-muted)" }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your posts & drafts…"
            aria-label="Search posts"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>

        <ul className="min-h-0 flex-1 overflow-y-auto px-2 glass-scrollbar">
          {candidates.length === 0 && (
            <li className="px-3 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              {query ? "No posts match." : "Every post is already on this pin."}
            </li>
          )}
          {candidates.map((blog) => {
            const isPicked = picked.has(blog.id);
            const from = blog.pinId ? pinTitles.get(blog.pinId) : null;
            return (
              <li key={blog.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isPicked}
                  onClick={() => toggle(blog.id)}
                  className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors ${isPicked ? "bg-red-500/10" : "hover:bg-black/5"}`}
                >
                  {realCover(blog.coverImage) ? (
                    <img src={blog.coverImage} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <CoverPlaceholder variant="blog" seed={blog.id} compact className="h-11! w-11! shrink-0 rounded-lg" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{blog.title}</span>
                      {blog.status === "draft" && (
                        <span className="shrink-0 rounded-full bg-amber-400/25 px-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                          Draft
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs" style={{ color: "var(--text-muted)" }}>
                      {[formatBlogDate(blog), blog.location?.name, from && `moves from ${from}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${isPicked ? "border-transparent text-white" : ""}`}
                    style={isPicked ? { background: "var(--pin-red)" } : { borderColor: "var(--border)" }}
                    aria-hidden="true"
                  >
                    {isPicked && <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <footer className="flex gap-2 border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" style={{ borderColor: "var(--glass-border)" }}>
          <button type="button" onClick={onCancel} className="h-10 flex-1 rounded-full text-sm font-semibold hover:bg-black/5">
            Cancel
          </button>
          <button
            type="button"
            disabled={picked.size === 0}
            onClick={() => onConfirm([...picked])}
            className="h-10 flex-1 rounded-full text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
            style={{ background: "var(--pin-red)" }}
          >
            Attach {picked.size > 0 ? picked.size : ""}
          </button>
        </footer>
      </motion.div>
    </motion.div>,
    document.body
  );
}
