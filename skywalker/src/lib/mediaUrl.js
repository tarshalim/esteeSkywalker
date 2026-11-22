// The one place YouTube and Spotify links are recognised. Used by the
// background-music picker (music.js), canvas audio/video elements (media.js,
// MediaFill) and video block embeds (blocks.js), so every surface accepts the
// same link shapes.

// watch?v= (any param order), youtu.be/, /embed/, /shorts/, /live/, /v/,
// music.youtube.com and youtube-nocookie.com.
const YOUTUBE_URL =
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/i;
const BARE_YOUTUBE_ID = /^[\w-]{11}$/;
// open.spotify.com/{kind}/…, /intl-xx/{kind}/…, /embed/{kind}/…, or a spotify:{kind}: URI.
const SPOTIFY_ITEM =
  /(?:open\.spotify\.com\/(?:intl-[\w-]+\/)?(?:embed\/)?(track|album|playlist|episode)\/|spotify:(track|album|playlist|episode):)([A-Za-z0-9]{22})/;

/**
 * YouTube video id from a link, else null. A bare 11-character id is accepted
 * too unless `allowBareId` is false (for free-form URLs, where a short word
 * shouldn't turn into a video).
 */
export function parseYouTubeId(input, { allowBareId = true } = {}) {
  const text = (input ?? "").trim();
  if (allowBareId && BARE_YOUTUBE_ID.test(text)) return text;
  return text.match(YOUTUBE_URL)?.[1] ?? null;
}

/** `{ kind, id }` for a Spotify track/album/playlist/episode link or URI, else null. */
export function parseSpotifyItem(input) {
  const match = (input ?? "").trim().match(SPOTIFY_ITEM);
  return match ? { kind: match[1] ?? match[2], id: match[3] } : null;
}

export function youTubeEmbedUrl(id) {
  return `https://www.youtube.com/embed/${id}`;
}

export function spotifyEmbedUrl({ kind, id }) {
  return `https://open.spotify.com/embed/${kind}/${id}`;
}
