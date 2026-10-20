import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { getBlogById } from "../../lib/blogStore";
import BlockView from "../../components/Editor/BlockView";
import { countryCodeToFlagEmoji } from "../../utils/countries";
import { useAuth } from "../../lib/auth";
import "./BlogDetail.css";

export default function BlogDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const [blog, setBlog] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    let cancelled = false;
    setBlog(undefined);
    getBlogById(id).then((b) => {
      if (!cancelled) setBlog(b);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (blog === undefined) {
    return <div className="blog-detail-status">Loading blog…</div>;
  }

  if (blog === null) {
    return (
      <div className="blog-detail-status">
        <p>We couldn&rsquo;t find that blog post.</p>
        <Link to="/blogs" className="blog-detail-back-link">
          ← Back to the journey
        </Link>
      </div>
    );
  }

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
            {blog.location && (
              <button
                type="button"
                className="blog-detail-location"
                onClick={() =>
                  navigate("/", {
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
            <span>
              {new Date(blog.postDate ?? blog.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </span>
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
        className="blog-detail-canvas"
      >
        {blog.blocks.map((block) => (
          <BlockView key={block.id} block={block} editable={false} />
        ))}
      </motion.div>
    </div>
  );
}
