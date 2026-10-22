import { attachTrim, hasTrim, readTrim, youTubeTrimParams } from "./mediaTrim";

// Playback engines for a post's background track (and trimmed canvas embeds).
// Each one takes a mount element plus callbacks and returns the same small
// controller, so the CD widget doesn't care where the sound comes from:
//
//   createMusicEngine(music, mountEl, { onPlay, onPause, onBlocked, onError, onTitle }, options)
//     → { play(), pause(), destroy() }
//
// onBlocked fires when the browser refuses to start sound without a user
// gesture; the widget then retries play() on the reader's next tap.
//
// `music.startSec`/`endSec`/`loop` (see lib/mediaTrim.js) limit playback to a
// segment; background tracks loop unless told otherwise. `options` lets a
// visible, reader-controlled embed reuse an engine:
//   { autoplay = true, width, height, controls = false }

const YT_API_SRC = "https://www.youtube.com/iframe_api";
const SPOTIFY_API_SRC = "https://open.spotify.com/embed/iframe-api/v1";
// YouTube doesn't report a refused autoplay; if it isn't playing by then, assume it was blocked.
const YT_AUTOPLAY_GRACE_MS = 1500;
// YouTube only honours `end` on the first run, so a trimmed player checks its position itself.
const YT_TRIM_POLL_MS = 250;
// Spotify's position updates lag a seek; ignore them for a moment so one seek isn't repeated.
const SPOTIFY_SEEK_SETTLE_MS = 1000;
// Spotify reports no "ended"; a looping track restarts just before its last position update.
const SPOTIFY_END_MARGIN_SEC = 0.75;
// Starting this far before the trim start (e.g. a fresh play from 0:00) jumps to it.
const SPOTIFY_START_TOLERANCE_SEC = 1;

const NOOP_CALLBACKS = { onPlay() {}, onPause() {}, onBlocked() {}, onError() {}, onTitle() {} };

let youTubeApi = null;
let spotifyApi = null;

function injectScript(src) {
  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  document.head.appendChild(script);
  return script;
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  youTubeApi ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    injectScript(YT_API_SRC).onerror = () => {
      youTubeApi = null;
      reject(new Error("Couldn't load the YouTube player"));
    };
  });
  return youTubeApi;
}

function loadSpotifyApi() {
  spotifyApi ??= new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = resolve;
    injectScript(SPOTIFY_API_SRC).onerror = () => {
      spotifyApi = null;
      reject(new Error("Couldn't load the Spotify player"));
    };
  });
  return spotifyApi;
}

function createHtmlAudioEngine(music, mountEl, cb, { autoplay = true }) {
  const audio = document.createElement("audio");
  audio.src = music.url;
  audio.preload = "auto";
  const detachTrim = attachTrim(audio, readTrim(music, { loop: true }));
  audio.addEventListener("play", cb.onPlay);
  audio.addEventListener("pause", cb.onPause);
  audio.addEventListener("error", () => cb.onError(new Error("Background music failed to load")));
  mountEl.appendChild(audio);

  const play = () =>
    audio.play().catch((err) => {
      if (err.name === "NotAllowedError") cb.onBlocked();
      else if (err.name !== "AbortError") console.warn("Background music couldn't play", err);
    });

  if (autoplay) play();
  return {
    play,
    pause: () => audio.pause(),
    destroy() {
      detachTrim();
      // A detached <audio> keeps playing after navigation unless paused and emptied.
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.remove();
    },
  };
}

function createYouTubeEngine(music, mountEl, cb, { autoplay = true, width = 1, height = 1, controls = false }) {
  let player = null;
  let destroyed = false;
  let wantsPlay = autoplay;
  let graceTimer = null;
  let trimTimer = null;
  // Set when a non-looping segment finishes, so the next play() starts it over.
  let finished = false;
  const trim = readTrim(music, { loop: true });
  const trimmed = hasTrim(trim);
  const host = document.createElement("div");
  mountEl.appendChild(host);

  // `playlist` set to the same id is how the IFrame API loops a single video —
  // but that restarts at 0:00, so a trimmed segment loops by seeking instead.
  const loopVars = trim.loop && !trimmed ? { loop: 1, playlist: music.id } : {};

  const stopTrimWatch = () => {
    clearInterval(trimTimer);
    trimTimer = null;
  };
  const reachEnd = (YT) => {
    if (trim.loop) {
      player.seekTo(trim.start, true);
      player.playVideo();
      return;
    }
    finished = true;
    if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
  };

  loadYouTubeApi()
    .then((YT) => {
      if (destroyed) return;
      player = new YT.Player(host, {
        videoId: music.id,
        width,
        height,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          controls: controls ? 1 : 0,
          disablekb: controls ? 0 : 1,
          playsinline: 1,
          rel: 0,
          ...loopVars,
          ...youTubeTrimParams(trim),
        },
        events: {
          onReady: (e) => {
            const title = e.target.getVideoData?.().title;
            if (title) cb.onTitle(title);
            if (!wantsPlay) return;
            e.target.playVideo();
            graceTimer = setTimeout(() => {
              if (!destroyed && e.target.getPlayerState() !== YT.PlayerState.PLAYING) cb.onBlocked();
            }, YT_AUTOPLAY_GRACE_MS);
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              if (trimmed && !trimTimer && trim.end != null) {
                trimTimer = setInterval(() => {
                  if (player.getCurrentTime() >= trim.end) reachEnd(YT);
                }, YT_TRIM_POLL_MS);
              }
              cb.onPlay();
              return;
            }
            stopTrimWatch();
            if (e.data === YT.PlayerState.ENDED && trimmed) {
              // The `end` param (or the video's real end) was reached.
              reachEnd(YT);
              if (!trim.loop) cb.onPause();
            } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
              cb.onPause();
            }
          },
          // 2/5/100/101/150: bad id, HTML5 error, removed, or embedding disabled.
          onError: (e) => cb.onError(new Error(`YouTube player error ${e.data}`)),
        },
      });
    })
    .catch(cb.onError);

  return {
    play() {
      wantsPlay = true;
      if (finished) {
        finished = false;
        player?.seekTo?.(trim.start, true);
      }
      player?.playVideo?.();
    },
    pause() {
      wantsPlay = false;
      player?.pauseVideo?.();
    },
    destroy() {
      destroyed = true;
      clearTimeout(graceTimer);
      stopTrimWatch();
      try {
        player?.destroy?.();
      } catch {
        // The iframe may already be gone if the page is tearing down.
      }
      host.remove();
    },
  };
}

function createSpotifyEngine(music, mountEl, cb, { width = "100%", height = 80 }) {
  let controller = null;
  let destroyed = false;
  let isPaused = true;
  // resume() only works once something has played; the first start needs play().
  let started = false;
  // Set when a non-looping segment finishes, so the next play() starts it over.
  let finished = false;
  let lastSeekAt = 0;
  const trim = readTrim(music, { loop: true });
  const host = document.createElement("div");
  mountEl.appendChild(host);

  const seek = (sec) => {
    lastSeekAt = Date.now();
    controller.seek(sec);
  };

  // Spotify embeds have no start/end options, so the segment is enforced from position updates.
  const enforceTrim = ({ position, duration }) => {
    if (Date.now() - lastSeekAt < SPOTIFY_SEEK_SETTLE_MS) return;
    const pos = position / 1000;
    const end = trim.end ?? (trim.loop && duration ? duration / 1000 - SPOTIFY_END_MARGIN_SEC : null);
    if (trim.start > 0 && pos < trim.start - SPOTIFY_START_TOLERANCE_SEC) {
      seek(trim.start);
    } else if (end != null && pos >= end) {
      if (trim.loop) {
        seek(trim.start);
      } else {
        finished = true;
        controller.pause();
      }
    }
  };

  loadSpotifyApi()
    .then((IFrameAPI) => {
      if (destroyed) return;
      const uri = music.uri ?? `spotify:track:${music.id}`;
      IFrameAPI.createController(host, { uri, width, height }, (ctrl) => {
        if (destroyed) return ctrl.destroy();
        controller = ctrl;
        ctrl.addListener("playback_update", (e) => {
          if (!e.data.isPaused) enforceTrim(e.data);
          if (e.data.isPaused === isPaused) return;
          isPaused = e.data.isPaused;
          if (!isPaused) started = true;
          (isPaused ? cb.onPause : cb.onPlay)();
        });
        // Spotify never autoplays with sound; start in the "tap for music" state.
        ctrl.addListener("ready", () => cb.onBlocked());
      });
    })
    .catch(cb.onError);

  return {
    play() {
      if (!controller || !isPaused) return;
      if (finished) {
        finished = false;
        seek(trim.start);
      }
      if (started) controller.resume();
      else controller.play();
    },
    pause() {
      if (controller && !isPaused) controller.pause();
    },
    destroy() {
      destroyed = true;
      try {
        controller?.destroy();
      } catch {
        // Already torn down.
      }
      host.remove();
    },
  };
}

const ENGINES = {
  upload: createHtmlAudioEngine,
  youtube: createYouTubeEngine,
  spotify: createSpotifyEngine,
};

export function createMusicEngine(music, mountEl, callbacks, options = {}) {
  const create = ENGINES[music.type];
  if (!create) throw new Error(`Unknown music source "${music.type}"`);
  return create(music, mountEl, { ...NOOP_CALLBACKS, ...callbacks }, options);
}
