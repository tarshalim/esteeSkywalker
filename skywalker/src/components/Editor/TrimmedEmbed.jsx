import { useEffect, useRef } from "react";
import { createMusicEngine } from "../../lib/musicEngines";

/**
 * A visible YouTube/Spotify player that keeps to a trimmed segment
 * (music.startSec/endSec/loop). Plain iframes can't loop a segment or stop
 * Spotify at a time, so this drives the providers' iframe APIs instead. It
 * never autoplays; the reader starts it from the player's own controls.
 * `music` is { type: "youtube"|"spotify", id, uri?, startSec, endSec, loop }.
 */
export default function TrimmedEmbed({ music, className = "", height = "100%" }) {
  const mountRef = useRef(null);
  const { type, id, uri, startSec, endSec, loop } = music;

  useEffect(() => {
    const engine = createMusicEngine(
      { type, id, uri, startSec, endSec, loop },
      mountRef.current,
      { onError: (err) => console.warn("Embedded player unavailable", err) },
      { autoplay: false, controls: true, width: "100%", height }
    );
    return () => engine.destroy();
  }, [type, id, uri, startSec, endSec, loop, height]);

  return <div ref={mountRef} className={className} />;
}
