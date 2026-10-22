import { useEffect } from "react";
import { motion } from "framer-motion";

/**
 * Shown when leaving the editor with unsaved edits. `saveLabel` is
 * "Save as Draft" for drafts/new posts and "Save Changes" for a post that's
 * already published (saving it as a draft would unpublish it).
 */
export default function UnsavedChangesDialog({ saveLabel, saving, error, onSave, onDiscard, onCancel }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <motion.div
      className="editor-modal-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        aria-describedby="unsaved-desc"
        className="editor-modal editor-exit-modal glass-panel"
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="unsaved-title">Leave this story?</h3>
        <p id="unsaved-desc" className="editor-exit-text">
          You have changes that haven&rsquo;t been saved yet.
        </p>
        {error && (
          <p role="alert" className="editor-exit-error">
            {error}
          </p>
        )}
        <div className="editor-exit-actions">
          <button type="button" className="editor-btn editor-btn-primary" onClick={onSave} disabled={saving} autoFocus>
            {saving ? "Saving…" : saveLabel}
          </button>
          <button type="button" className="editor-btn editor-exit-discard" onClick={onDiscard} disabled={saving}>
            Discard Changes
          </button>
          <button type="button" className="editor-btn" onClick={onCancel} disabled={saving}>
            Keep Editing
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
