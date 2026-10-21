import { BLOCK_KIND, toEmbedUrl } from "./blocks";

// Default cover the editor assigns when none is picked — not a real asset, so
// the Gallery skips it.
export const PLACEHOLDER_COVER = "https://picsum.photos/seed/new-post/1600/900";

const DIRECT_VIDEO = /^data:video\/|\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;
const YOUTUBE_EMBED = /youtube\.com\/embed\/([\w-]+)/;

export function isDirectVideo(url) {
  return DIRECT_VIDEO.test(url ?? "");
}

/** Poster image for a video, when one can be derived (YouTube only). */
export function videoPoster(url) {
  const match = toEmbedUrl(url).match(YOUTUBE_EMBED);
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

/** Embeddable player URL for a canvas audio element's Spotify/YouTube link, else "". */
export function audioEmbedSrc(element) {
  if (element.sourceType === "youtube") {
    const m = element.src.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/)([\w-]+)/);
    return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=0` : "";
  }
  if (element.sourceType === "spotify") {
    const m = element.src.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([\w]+)/);
    return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : "";
  }
  return "";
}

function blogMediaBase(blog) {
  return {
    blogId: blog.id,
    // Embedded media is "blog-attached" and inherits the post's place in the hierarchy.
    tripId: blog.tripId ?? null,
    pinId: blog.pinId ?? null,
    tags: blog.tags ?? [],
    locationName: blog.location?.name || blog.countryName || "",
    countryCode: blog.countryCode ?? "",
    countryName: blog.countryName ?? "",
    continent: blog.continent ?? "",
    timestamp: blog.postDate ?? blog.date,
    lat: blog.location?.lat ?? null,
    lng: blog.location?.lng ?? null,
  };
}

/**
 * Flattens uploads + every image/video embedded in published posts into one
 * normalized media list: { id, type: "image"|"video", url, thumbUrl, ...geo/date }.
 * Text blocks, titles and excerpts are never carried over, so the Gallery
 * can't accidentally render post content. Duplicate URLs (e.g. a photo that's
 * also a post's cover) collapse to the first occurrence — uploads win.
 */
export function collectMedia(photos, blogs) {
  const items = photos.map((p) => ({ ...p, type: p.type ?? "image", thumbUrl: p.thumbUrl || p.url }));

  for (const blog of blogs) {
    if (blog.status !== "published") continue;
    const base = blogMediaBase(blog);
    if (blog.coverImage && blog.coverImage !== PLACEHOLDER_COVER) {
      items.push({ ...base, id: `${blog.id}:cover`, type: "image", url: blog.coverImage, thumbUrl: blog.coverImage });
    }
    for (const block of blog.blocks ?? []) {
      if (block.kind === BLOCK_KIND.IMAGE && block.src) {
        items.push({ ...base, id: `${blog.id}:${block.id}`, type: "image", url: block.src, thumbUrl: block.src });
      } else if (block.kind === BLOCK_KIND.VIDEO && block.url) {
        items.push({ ...base, id: `${blog.id}:${block.id}`, type: "video", url: block.url, thumbUrl: videoPoster(block.url) });
      }
    }
  }

  const seen = new Set();
  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
