import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { getBlogById } from "../../lib/blogStore";
import { getBlogMusic, musicKey } from "../../lib/music";
import BlockView from "../../components/Editor/BlockView";
import CanvasReadOnlyView from "../../components/Editor/Canvas/CanvasReadOnlyView";
import BackgroundAudioPlayer from "../../components/BackgroundAudioPlayer/BackgroundAudioPlayer";
import { countryCodeToFlagEmoji } from "../../utils/countries";
import { formatBlogDate } from "../../utils/dateFilters";
import { hasCoords } from "../../utils/geo";
import { GLOBE_HASH } from "../../utils/routes";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../lib/auth";
import "./BlogDetail.css";

export default function BlogDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  // A failed fetch used to leave "Loading blog…" up forever.
  const { data: blog, loading, error } = useAsync(() => getBlogById(id), [id]);

  if (loading) {
    return <div className="blog-detail-status">Loading blog…</div>;
  }

  if (error || !blog) {
    return (
      <div className="blog-detail-status">
        <p>{error ? "We couldn\u2019t load that blog post." : "We couldn\u2019t find that blog post."}</p>
        <Link to="/blogs" className="blog-detail-back-link">
          ← Back to the journey
        </Link>
      </div>
    );
  }

  const music = getBlogMusic(blog);

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
          <h1>{blog.title}</h1>
          <div className="blog-detail-meta">
            {blog.location && !hasCoords(blog.location) && <span>📍 {blog.location.name}</span>}
            {hasCoords(blog.location) && (
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

      <div className="blog-detail-toolbar">
        <button className="blog-detail-back" onClick={() => navigate("/blogs")}>
          ← Back to journey
        </button>
        {canEdit && (
          <Link to={`/blogs/edit/${blog.id}`} className="blog-detail-edit">
            Edit post
          </Link>
        )}
      </div>

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
