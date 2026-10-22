import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getBlogMusic, musicKey } from "../../lib/music";
import BlockView from "../Editor/BlockView";
import CanvasReadOnlyView from "../Editor/Canvas/CanvasReadOnlyView";
import BackgroundAudioPlayer from "../BackgroundAudioPlayer/BackgroundAudioPlayer";
import { countryCodeToFlagEmoji } from "../../utils/countries";
import { formatBlogDate } from "../../utils/dateFilters";
import { hasCoords } from "../../utils/geo";
import { GLOBE_HASH } from "../../utils/routes";
import "../../pages/BlogDetail/BlogDetail.css";

/**
 * The public reading view of a post: hero, trip badge, scrapbook page and
 * background music. Shared by BlogDetail and the editor's Preview so the
 * preview is exactly what readers get. `toolbar` sits between hero and page;
 * `preview` keeps links from navigating away from unsaved edits.
 */
export default function BlogReader({ blog, trip = null, toolbar = null, preview = false }) {
  const navigate = useNavigate();
  const music = getBlogMusic(blog);
  const linkLocation = hasCoords(blog.location) && !preview;

  return (
    <div className="blog-detail-page">
      <div className="blog-detail-hero" style={{ backgroundImage: `url(${blog.coverImage})` }}>
        <div className="blog-detail-hero-scrim" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="blog-detail-hero-content"
        >
          <span className={`blog-detail-status-pill ${blog.status}`}>{blog.status === "draft" ? "Draft" : "Published"}</span>
          {trip?.title && (
            <span className="blog-detail-trip-badge">
              📍 Part of Trip: <strong>{trip.title}</strong>
            </span>
          )}
          <h1>{blog.title}</h1>
          <div className="blog-detail-meta">
            {blog.location && !linkLocation && <span>📍 {blog.location.name}</span>}
            {linkLocation && (
              <button
                type="button"
                className="blog-detail-location"
                onClick={() =>
                  navigate({ pathname: "/", hash: GLOBE_HASH }, {
                    state: {
                      focusLat: blog.location.lat,
                      focusLng: blog.location.lng,
                      focusBlogId: blog.id,
                    },
                  })
                }
                title="View on the globe"
              >
                📍 {blog.location.name}
              </button>
            )}
            {blog.countryCode && (
              <span className="blog-detail-country">
                {countryCodeToFlagEmoji(blog.countryCode)} {blog.countryName}
              </span>
            )}
            <span>{formatBlogDate(blog, "long")}</span>
          </div>
        </motion.div>
      </div>

      {toolbar}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className={`blog-detail-canvas ${blog.canvas ? "blog-detail-canvas--scrapbook" : ""}`}
      >
        {/* Canvas-authored posts render as their scrapbook page; older posts keep the block list. */}
        {blog.canvas ? (
          <CanvasReadOnlyView doc={blog.canvas} />
        ) : (
          (blog.blocks ?? []).map((block) => <BlockView key={block.id} block={block} editable={false} />)
        )}
      </motion.div>

      {music && <BackgroundAudioPlayer key={musicKey(music)} music={music} fallbackTitle={blog.title} />}
    </div>
  );
}
