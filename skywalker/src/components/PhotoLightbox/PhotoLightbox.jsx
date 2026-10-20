import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import "./PhotoLightbox.css";

/**
 * High-res photo modal. Shared between GlobeExplorer (globe/gallery photo
 * click) and, eventually, Gallery.jsx's standalone lightbox — extracted from
 * the pattern already proven there (AnimatePresence + layoutId morph, scrim,
 * click-outside-to-close).
 */
export default function PhotoLightbox({ photo, onClose }) {
  return (
    <motion.div
      className="photo-lightbox"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        layoutId={`photo-${photo.id}`}
        className="photo-lightbox-card"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={photo.url} alt={photo.locationName} />
        <div className="photo-lightbox-meta">
          <div className="photo-lightbox-meta-text">
            <strong>{photo.locationName}</strong>
            <span>
              {new Date(photo.timestamp).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          {photo.blog && (
            <Link to={`/blogs/${photo.blog.id}`} className="photo-lightbox-blog-badge">
              View Blog Post →
            </Link>
          )}
        </div>
        <button className="photo-lightbox-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </motion.div>
    </motion.div>
  );
}
