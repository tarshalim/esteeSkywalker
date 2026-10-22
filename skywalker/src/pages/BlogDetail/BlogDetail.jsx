import { Link, useNavigate, useParams } from "react-router-dom";
import { getBlogById } from "../../lib/blogStore";
import { getTripById } from "../../lib/tripStore";
import BlogReader from "../../components/BlogReader/BlogReader";
import VisibilityToggle from "../../components/VisibilityToggle/VisibilityToggle";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../lib/auth";
import "./BlogDetail.css";

export default function BlogDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  // A failed fetch used to leave "Loading blog…" up forever.
  const { data: blog, loading, error, setData: setBlog } = useAsync(() => getBlogById(id), [id]);
  // The trip badge is a nicety: a failed lookup just leaves it off.
  const tripId = blog?.tripId;
  const { data: trip } = useAsync(() => (tripId ? getTripById(tripId) : null), [tripId]);

  if (loading) {
    return <div className="blog-detail-status">Loading blog…</div>;
  }

  if (error || !blog) {
    return (
      <div className="blog-detail-status">
        <p>{error ? "We couldn’t load that blog post." : "We couldn’t find that blog post."}</p>
        <Link to="/blogs" className="blog-detail-back-link">
          ← Back to the journey
        </Link>
      </div>
    );
  }

  return (
    <BlogReader
      blog={blog}
      trip={trip}
      toolbar={
        <div className="blog-detail-toolbar">
          <button className="blog-detail-back" onClick={() => navigate("/blogs")}>
            ← Back to journey
          </button>
          {canEdit && (
            <div className="blog-detail-actions">
              <VisibilityToggle blog={blog} onChange={setBlog} />
              <Link to={`/blogs/edit/${blog.id}`} className="blog-detail-edit">
                Edit post
              </Link>
            </div>
          )}
        </div>
      }
    />
  );
}
