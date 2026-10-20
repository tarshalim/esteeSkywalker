import { useEffect, useState } from "react";

/** Client (screen) point → canvas-space point, accounting for the stage's
 * on-screen rect and the current zoom level. */
export function clientToCanvasPoint(stageEl, zoom, clientX, clientY) {
  const rect = stageEl.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / zoom,
    y: (clientY - rect.top) / zoom,
  };
}

/**
 * Tracks the pointer position (in canvas space) while a "spawn" tool
 * (text/image/video/audio/sticker) is armed, so the toolbar item can appear
 * attached to the cursor until the user clicks the canvas to place it.
 */
export function useSpawnAtCursor(stageRef, zoom, active) {
  const [point, setPoint] = useState(null);

  useEffect(() => {
    if (!active) {
      setPoint(null);
      return undefined;
    }
    const onMove = (e) => {
      if (!stageRef.current) return;
      setPoint(clientToCanvasPoint(stageRef.current, zoom, e.clientX, e.clientY));
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [active, stageRef, zoom]);

  return point;
}
