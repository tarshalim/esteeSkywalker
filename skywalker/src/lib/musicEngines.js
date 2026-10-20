// Playback engines for a post's background track. Each one takes a mount
// element plus callbacks and returns the same small controller, so the CD
// widget doesn't care where the sound comes from:
//
//   createMusicEngine(music, mountEl, { onPlay, onPause, onBlocked, onError, onTitle })
//     → { play(), pause(), destroy() }
//
// onBlocked fires when the browser refuses to start sound without a user
// gesture; the widget then retries play() on the reader's next tap.

const YT_API_SRC = "https://www.youtube.com/iframe_api";
const SPOTIFY_API_SRC = "https://open.spotify.com/embed/iframe-api/v1";
// YouTube doesn't report a refused autoplay; if it isn't playing by then, assume it was blocked.
const YT_AUTOPLAY_GRACE_MS = 1500;

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

function createHtmlAudioEngine(music, mountEl, cb) {
  const audio = document.createElement("audio");
  audio.src = music.url;
  audio.loop = true;
  audio.preload = "auto";
  audio.addEventListener("play", cb.onPlay);
  audio.addEventListener("pause", cb.onPause);
  audio.addEventListener("error", () => cb.onError(new Error("Background music failed to load")));
  mountEl.appendChild(audio);

  const play = () =>
    audio.play().catch((err) => {
      if (err.name === "NotAllowedError") cb.onBlocked();
      else if (err.name !== "AbortError") console.warn("Background music couldn't play", err);
    });

  play();
  return {
    play,
    pause: () => audio.pause(),
    destroy() {
      // A detached <audio> keeps playing after navigation unless paused and emptied.
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.remove();
    },
  };
}

function createYouTubeEngine(music, mountEl, cb) {
  let player = null;
  let destroyed = false;
  let wantsPlay = true;
  let graceTimer = null;
  const host = document.createElement("div");
  mountEl.appendChild(host);

  loadYouTubeApi()
    .then((YT) => {
      if (destroyed) return;
      player = new YT.Player(host, {
        videoId: music.id,
        width: 1,
        height: 1,
        // `playlist` set to the same id is how the IFrame API loops a single video.
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, loop: 1, playlist: music.id, playsinline: 1, rel: 0 },
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
            if (e.data === YT.PlayerState.PLAYING) cb.onPlay();
            else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) cb.onPause();
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
      player?.playVideo?.();
    },
    pause() {
      wantsPlay = false;
      player?.pauseVideo?.();
    },
    destroy() {
      destroyed = true;
      clearTimeout(graceTimer);
      try {
        player?.destroy?.();
      } catch {
        // The iframe may already be gone if the page is tearing down.
      }
      host.remove();
    },
  };
}

function createSpotifyEngine(music, mountEl, cb) {
  let controller = null;
  let destroyed = false;
  let isPaused = true;
  // resume() only works once something has played; the first start needs play().
  let started = false;
  const host = document.createElement("div");
  mountEl.appendChild(host);

  loadSpotifyApi()
    .then((IFrameAPI) => {
      if (destroyed) return;
      IFrameAPI.createController(host, { uri: `spotify:track:${music.id}`, width: "100%", height: 80 }, (ctrl) => {
        if (destroyed) return ctrl.destroy();
        controller = ctrl;
        ctrl.addListener("playback_update", (e) => {
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

export function createMusicEngine(music, mountEl, callbacks) {
  const create = ENGINES[music.type];
  if (!create) throw new Error(`Unknown music source "${music.type}"`);
  return create(music, mountEl, callbacks);
}
