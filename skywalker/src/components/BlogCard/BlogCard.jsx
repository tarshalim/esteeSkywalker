import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import CoverPlaceholder from "../CoverPlaceholder/CoverPlaceholder";
import { formatBlogDate } from "../../lib/dateFilters";
import { realCover } from "../../lib/media";
import "./BlogCard.css";

/**
 * Steps a card's location text down as it grows (multi-city or long region
 * names) so it can share one row with the date; anything still too long is
 * ellipsized by the `truncate` wrapper, with the full name in the tooltip.
 */
const locationFontScale = (place) => {
  const len = place.length;
  if (len <= 18) return "1em";
  if (len <= 26) return "0.92em";
  if (len <= 34) return "0.85em";
  return "0.78em";
};

/**
 * One post as a scrapbook-page card: cover (or placeholder), continent badge,
 * place + date, title, a text snippet and "Read story". Fades up on scroll,
 * staggered by `delay` seconds.
 *
 * @param {{ blog: object, snippet?: string, delay?: number }} props - `snippet`
 *   defaults to the post's excerpt.
 */
export default function BlogCard({ blog, snippet = blog.excerpt, delay = 0 }) {
  const place = blog.location?.name ?? blog.countryName ?? "";
  return (
    <motion.article
      className="blog-card"
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      <Link to={`/blogs/${blog.id}`} className="blog-card-link">
        <div className="blog-card-media">
          {realCover(blog.coverImage) ? (
            <img src={blog.coverImage} alt="" loading="lazy" />
          ) : (
            <CoverPlaceholder variant="blog" seed={blog.id} />
          )}
          {blog.continent && <span className="blog-card-badge">{blog.continent}</span>}
        </div>
        <div className="blog-card-body">
          <div className="blog-card-meta flex items-center justify-between gap-2 w-full min-w-0">
            <span className="blog-card-place min-w-0" title={place}>
              <MapPin size={13} className="shrink-0" />
              <span className="truncate" style={{ fontSize: locationFontScale(place) }}>
                {place}
              </span>
            </span>
            <span className="blog-card-date shrink-0 whitespace-nowrap">
              <CalendarDays size={13} className="shrink-0" /> {formatBlogDate(blog)}
            </span>
          </div>
          <h3 className="blog-card-title">{blog.title}</h3>
          {snippet && <p className="blog-card-excerpt">{snippet}</p>}
          <span className="blog-card-cta">
            Read story <ArrowRight size={14} />
          </span>
        </div>
      </Link>
    </motion.article>
  );
}
