import { toEmbedUrl } from "../../lib/blocks";
import { isDirectVideo } from "../../lib/media";
import "./MediaView.css";

/**
 * Renders one normalized media item (see lib/media.js). `variant="thumb"` is
 * a silent, non-interactive preview for grids; `variant="full"` plays.
 */
export default function MediaView({ item, variant = "thumb", alt = "" }) {
  const isThumb = variant === "thumb";

  if (item.type !== "video") {
    return <img src={isThumb ? item.thumbUrl || item.url : item.url} alt={alt} loading={isThumb ? "lazy" : undefined} />;
  }

  let media;
  if (isDirectVideo(item.url)) {
    media = isThumb ? (
      <video src={item.url} muted playsInline preload="metadata" />
    ) : (
      <video src={item.url} controls autoPlay playsInline />
    );
  } else if (!isThumb) {
    media = (
      <iframe
        src={toEmbedUrl(item.url)}
        title={alt || "Video"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  } else if (item.thumbUrl) {
    media = <img src={item.thumbUrl} alt={alt} loading="lazy" />;
  } else {
    media = <div className="media-view-placeholder" />;
  }

  return (
    <div className={`media-view media-view--${variant}`}>
      {media}
      {isThumb && (
        <span className="media-view-play" aria-label="Video">
          ▶
        </span>
      )}
    </div>
  );
}
