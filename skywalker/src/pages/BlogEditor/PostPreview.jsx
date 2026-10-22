import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import BlogReader from "../../components/BlogReader/BlogReader";

/**
 * Full-screen reader-mode preview of the unsaved post, rendered by the same
 * BlogReader the public page uses. Portalled to <body> so it covers the nav;
 * the editor stays mounted underneath, so closing loses nothing.
 */
export default function PostPreview({ blog, trip, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <motion.div
      className="editor-preview"
      role="dialog"
      aria-modal="true"
      aria-label="Post preview"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="editor-preview-bar glass-panel">
        <span className="editor-preview-label">👁️ Preview · how readers will see this post</span>
        <button type="button" className="editor-btn editor-btn-primary" onClick={onClose} autoFocus>
          <Pencil size={15} aria-hidden="true" />
          Back to editing
        </button>
      </div>
      <BlogReader blog={blog} trip={trip} preview />
    </motion.div>,
    document.body
  );
}
