import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import MediaView from "../MediaView/MediaView";
import { countryCodeToFlagEmoji } from "../../utils/countries";
import { formatDate } from "../../utils/dateFilters";
import "./PhotoLightbox.css";

/**
 * Full-size media modal (image or video), shared by GlobeExplorer and the
 * Gallery page: AnimatePresence + layoutId morph, scrim, click-outside-to-close.
 * `photo.blog` (or `photo.blogId`) adds a link to the post it belongs to.
 */
export default function PhotoLightbox({ photo, onClose }) {
  const blogId = photo.blog?.id ?? photo.blogId;
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
        <MediaView item={photo} variant="full" alt={photo.locationName} />
        <div className="photo-lightbox-meta">
          <div className="photo-lightbox-meta-text">
            <strong>
              {photo.countryCode && `${countryCodeToFlagEmoji(photo.countryCode)} `}
              {photo.locationName}
            </strong>
            <span>{formatDate(photo.timestamp, "long")}</span>
          </div>
          {blogId && (
            <Link to={`/blogs/${blogId}`} className="photo-lightbox-blog-badge">
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
