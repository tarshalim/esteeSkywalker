import { describe, expect, it } from "vitest";
import { parseSpotifyItem, parseYouTubeId, spotifyEmbedUrl, youTubeEmbedUrl } from "./mediaUrl";
import { toEmbedUrl } from "./blocks";
import { audioEmbedSrc, canTrimAudioSource, trimmedAudioEmbed, videoPoster } from "./media";
import { musicFromLink } from "./music";

const YT = "dQw4w9WgXcQ";
const SP = "4uLU6hMCjMI75M1A2tKUQC";

describe("parseYouTubeId", () => {
  it.each([
    `https://www.youtube.com/watch?v=${YT}`,
    `https://www.youtube.com/watch?feature=share&v=${YT}`,
    `https://youtu.be/${YT}?t=42`,
    `https://www.youtube.com/embed/${YT}`,
    `https://www.youtube-nocookie.com/embed/${YT}`,
    `https://youtube.com/shorts/${YT}`,
    `https://www.youtube.com/live/${YT}`,
    `https://music.youtube.com/watch?v=${YT}&list=RD`,
    `HTTPS://WWW.YOUTUBE.COM/watch?v=${YT}`,
    `  https://youtu.be/${YT}  `,
  ])("reads %s", (url) => {
    expect(parseYouTubeId(url)).toBe(YT);
  });

  it("accepts a bare id unless told not to", () => {
    expect(parseYouTubeId(YT)).toBe(YT);
    expect(parseYouTubeId(YT, { allowBareId: false })).toBeNull();
  });

  it("rejects non-video links and empty input", () => {
    expect(parseYouTubeId("https://www.youtube.com/channel/UC123")).toBeNull();
    expect(parseYouTubeId("https://vimeo.com/123456")).toBeNull();
    expect(parseYouTubeId("")).toBeNull();
    expect(parseYouTubeId(undefined)).toBeNull();
  });
});

describe("parseSpotifyItem", () => {
  it.each([
    [`https://open.spotify.com/track/${SP}?si=abc`, "track"],
    [`https://open.spotify.com/intl-de/track/${SP}`, "track"],
    [`https://open.spotify.com/embed/album/${SP}`, "album"],
    [`https://open.spotify.com/playlist/${SP}`, "playlist"],
    [`https://open.spotify.com/episode/${SP}`, "episode"],
    [`spotify:track:${SP}`, "track"],
    [`spotify:playlist:${SP}`, "playlist"],
  ])("reads %s", (url, kind) => {
    expect(parseSpotifyItem(url)).toEqual({ kind, id: SP });
  });

  it("rejects artist pages, malformed ids and empty input", () => {
    expect(parseSpotifyItem(`https://open.spotify.com/artist/${SP}`)).toBeNull();
    expect(parseSpotifyItem("https://open.spotify.com/track/short")).toBeNull();
    expect(parseSpotifyItem(null)).toBeNull();
  });
});

describe("embed URL builders", () => {
  it("builds provider player URLs", () => {
    expect(youTubeEmbedUrl(YT)).toBe(`https://www.youtube.com/embed/${YT}`);
    expect(spotifyEmbedUrl({ kind: "album", id: SP })).toBe(`https://open.spotify.com/embed/album/${SP}`);
  });
});

describe("call sites", () => {
  it("toEmbedUrl normalises YouTube links but never guesses a bare id", () => {
    expect(toEmbedUrl(`https://www.youtube.com/live/${YT}`)).toBe(`https://www.youtube.com/embed/${YT}`);
    expect(toEmbedUrl("https://vimeo.com/76979871")).toBe("https://player.vimeo.com/video/76979871");
    expect(toEmbedUrl(YT)).toBe(YT);
  });

  it("videoPoster derives a YouTube thumbnail", () => {
    expect(videoPoster(`https://youtu.be/${YT}`)).toBe(`https://img.youtube.com/vi/${YT}/hqdefault.jpg`);
    expect(videoPoster("https://example.com/clip.mp4")).toBeNull();
  });

  it("audioEmbedSrc accepts regional Spotify links (regression)", () => {
    const src = `https://open.spotify.com/intl-fr/track/${SP}`;
    expect(audioEmbedSrc({ sourceType: "spotify", src })).toBe(`https://open.spotify.com/embed/track/${SP}`);
    expect(audioEmbedSrc({ sourceType: "youtube", src: `https://youtube.com/shorts/${YT}` })).toBe(
      `https://www.youtube.com/embed/${YT}?autoplay=0`,
    );
    expect(audioEmbedSrc({ sourceType: "spotify", src: "https://open.spotify.com/artist/x" })).toBe("");
  });

  it("canTrimAudioSource allows Spotify tracks and episodes only", () => {
    expect(canTrimAudioSource("spotify", `https://open.spotify.com/track/${SP}`)).toBe(true);
    expect(canTrimAudioSource("spotify", `https://open.spotify.com/episode/${SP}`)).toBe(true);
    expect(canTrimAudioSource("spotify", `https://open.spotify.com/playlist/${SP}`)).toBe(false);
    expect(canTrimAudioSource("youtube", `https://youtu.be/${YT}`)).toBe(true);
  });

  it("trimmedAudioEmbed builds a Spotify URI for the engine", () => {
    const element = { sourceType: "spotify", src: `https://open.spotify.com/episode/${SP}`, startSec: 10, endSec: 20 };
    expect(trimmedAudioEmbed(element)).toEqual({
      type: "spotify",
      id: SP,
      uri: `spotify:episode:${SP}`,
      startSec: 10,
      endSec: 20,
      loop: false,
    });
  });

  it("musicFromLink takes Spotify tracks but not albums for background music", () => {
    expect(musicFromLink("spotify", `spotify:track:${SP}`)).toEqual({
      type: "spotify",
      id: SP,
      url: `https://open.spotify.com/track/${SP}`,
      title: "",
    });
    expect(musicFromLink("spotify", `https://open.spotify.com/album/${SP}`)).toBeNull();
    expect(musicFromLink("youtube", YT)?.url).toBe(`https://www.youtube.com/watch?v=${YT}`);
  });
});
