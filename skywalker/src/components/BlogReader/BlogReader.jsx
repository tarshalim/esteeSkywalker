import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getBlogMusic, musicKey } from "../../lib/music";
import BlockView from "../Editor/BlockView";
import CanvasReadOnlyView from "../Editor/Canvas/CanvasReadOnlyView";
import BackgroundAudioPlayer from "../BackgroundAudioPlayer/BackgroundAudioPlayer";
import CoverPlaceholder from "../CoverPlaceholder/CoverPlaceholder";
import { realCover } from "../../lib/media";
import { importCanvasLayout } from "../../lib/canvasLayout";
import { countryCodeToFlagEmoji } from "../../utils/countries";
import { formatBlogDate } from "../../utils/dateFilters";
import { hasCoords } from "../../utils/geo";
import { GLOBE_HASH } from "../../utils/routes";
import { useAuth } from "../../lib/auth";
import SectionThread from "../SectionComments/SectionThread";
import { useSectionThreads } from "../SectionComments/useSectionThreads";
import "../../pages/BlogDetail/BlogDetail.css";

// What a reader would call each kind of section; stickers and decor aren't
// worth a discussion, so they get no trigger.
const SECTION_LABELS = {
  text: "this passage",
  textbox: "this passage",
  note: "this note",
  image: "this photo",
  polaroid: "this photo",
  collage: "these photos",
  video: "this video",
  viewfinder: "this video",
  audio: "this audio",
};

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
  const cover = realCover(blog.coverImage);
  const { user } = useAuth();
  // Comments are for published posts; the editor preview may not even be saved.
  const threads = useSectionThreads(blog.id, { enabled: !preview && blog.status === "published", viewerKey: user?.id });
  const canvasDoc = useMemo(() => importCanvasLayout(blog.canvas), [blog.canvas]);
  const anchorFor = (section) => {
    const label = SECTION_LABELS[section.kind];
    return threads.enabled && label ? <SectionThread sectionId={section.id} threads={threads} label={label} /> : null;
  };

  return (
    <div className="blog-detail-page">
      <div className="blog-detail-hero" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
        {!cover && <CoverPlaceholder variant="blog" seed={blog.id} />}
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
        className={`blog-detail-canvas ${canvasDoc ? "blog-detail-canvas--scrapbook" : ""}`}
      >
        {/* Canvas-authored posts render as their scrapbook page; older posts keep the block list. */}
        {canvasDoc ? (
          <CanvasReadOnlyView doc={canvasDoc} renderAnchor={threads.enabled ? anchorFor : null} />
        ) : (
          (blog.blocks ?? []).map((block) => (
            <div key={block.id} className="section-anchor">
              <BlockView block={block} editable={false} />
              {anchorFor(block)}
            </div>
          ))
        )}
      </motion.div>

      {music && <BackgroundAudioPlayer key={musicKey(music)} music={music} fallbackTitle={blog.title} />}
    </div>
  );
}
