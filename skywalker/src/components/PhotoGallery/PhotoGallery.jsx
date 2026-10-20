import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import MediaView from "../MediaView/MediaView";
import "./PhotoGallery.css";

// Narrow band near the top of the scroll container: the photo whose card
// crosses this band as the user scrolls is treated as "currently in view"
// and drives the globe fly-to (gallery -> globe sync).
const IN_VIEW_ROOT_MARGIN = "-10% 0px -75% 0px";

export default function PhotoGallery({
  photos,
  filterLabel,
  onClearFilter,
  onPhotoClick,
  onPhotoHover,
  onPhotoInView,
  activePhotoId,
}) {
  const gridRef = useRef(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !onPhotoInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) => (a.intersectionRatio >= b.intersectionRatio ? a : b));
        onPhotoInView(photos.find((p) => p.id === topMost.target.dataset.photoId) ?? null);
      },
      { root: grid, rootMargin: IN_VIEW_ROOT_MARGIN, threshold: [0, 0.5, 1] }
    );

    grid.querySelectorAll("[data-photo-id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [photos, onPhotoInView]);

  return (
    <div className="photo-gallery">
      <div className="photo-gallery-header">
        <span className="photo-gallery-filter">
          {filterLabel}
          {onClearFilter && (
            <button className="photo-gallery-clear" onClick={onClearFilter} aria-label="Clear filter">
              ✕
            </button>
          )}
        </span>
        <span className="photo-gallery-count">{photos.length} photo{photos.length === 1 ? "" : "s"}</span>
      </div>

      {photos.length === 0 ? (
        <div className="photo-gallery-empty">No photos in this area yet. Try zooming out or rotating the globe.</div>
      ) : (
        <div className="photo-gallery-grid" ref={gridRef}>
          {photos.map((photo) => (
            <div
              key={photo.id}
              data-photo-id={photo.id}
              className={`photo-gallery-item${photo.id === activePhotoId ? " is-active" : ""}`}
              onMouseEnter={() => onPhotoHover?.(photo)}
              onMouseLeave={() => onPhotoHover?.(null)}
            >
              <button
                className="photo-gallery-item-button"
                onClick={() => onPhotoClick(photo)}
                title={photo.locationName}
              >
                <MediaView item={photo} alt={photo.locationName} />
                <span className="photo-gallery-item-label">{photo.locationName}</span>
              </button>
              {photo.blog && (
                <Link
                  to={`/blogs/${photo.blog.id}`}
                  className="photo-gallery-item-blog-badge"
                  onClick={(e) => e.stopPropagation()}
                >
                  View Blog Post →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
