import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderCircle, Trash2, TriangleAlert } from "lucide-react";

/**
 * Confirms deleting the post open in the editor. Escape and the backdrop
 * cancel, except while the delete is in flight — it can't be recalled then.
 */
export default function DeletePostDialog({ title, isPublished, deleting, error, onConfirm, onCancel }) {
  const cancel = () => {
    if (!deleting) onCancel();
  };

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !deleting && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleting, onCancel]);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-(--z-modal) flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={cancel}
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-post-title"
        aria-describedby="delete-post-desc"
        className="w-full rounded-t-2xl border p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-2xl sm:pb-5"
        style={{ background: "var(--bg-panel-strong)", borderColor: "var(--border)" }}
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-600" aria-hidden="true">
            <TriangleAlert size={20} />
          </span>
          <div className="min-w-0">
            <h3 id="delete-post-title" className="truncate text-base font-bold" style={{ color: "var(--text)" }}>
              Delete &ldquo;{title}&rdquo;?
            </h3>
            <p id="delete-post-desc" className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Are you sure you want to delete this {isPublished ? "published post" : "draft"}? This action cannot be undone.
            </p>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              role="alert"
              className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            autoFocus
            className="h-11 rounded-full border px-5 text-sm font-semibold transition-colors hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            aria-busy={deleting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70 sm:h-10"
          >
            {deleting ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
            {deleting ? "Deleting…" : "Confirm Delete"}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
