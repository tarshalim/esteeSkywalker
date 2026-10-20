import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { countryCodeToFlagEmoji } from "../../utils/countries";
import { formatBlogDate } from "../../utils/dateFilters";
import "./Signpost.css";

export default function Signpost({ blog, trackX, laneOffset, isNear, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const revealed = hovered || isNear;

  return (
    <div
      className="signpost"
      style={{ left: trackX, transform: `translateY(${-laneOffset}px)` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence>
        {revealed && (
          <motion.button
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="signpost-card glass-panel"
            onClick={() => onSelect(blog.id)}
          >
            <img src={blog.coverImage} alt="" className="signpost-thumb" />
            <div className="signpost-info">
              <span className="signpost-status">{blog.status === "draft" ? "Draft" : "Published"}</span>
              <strong>{blog.title}</strong>
              <span className="signpost-date">
                {blog.countryCode && (
                  <span className="signpost-flag">{countryCodeToFlagEmoji(blog.countryCode)}</span>
                )}
                {formatBlogDate(blog)}
              </span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <button
        className={`signpost-marker ${revealed ? "is-active" : ""}`}
        onClick={() => onSelect(blog.id)}
        aria-label={`Open blog: ${blog.title}`}
      >
        <span className="signpost-marker-dot" />
      </button>
      <div className="signpost-pole" />
    </div>
  );
}
