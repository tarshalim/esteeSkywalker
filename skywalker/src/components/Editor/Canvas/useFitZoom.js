import { useLayoutEffect, useState } from "react";

/** Scale factor that fits a fixed-width page into its container (never upscales). */
export function useFitZoom(containerRef, pageWidth) {
  const [zoom, setZoom] = useState(1);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const measure = () => setZoom(Math.min(1, node.clientWidth / pageWidth) || 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef, pageWidth]);

  return zoom;
}

/** Client (screen) point → unscaled page point. */
export function clientToCanvasPoint(pageEl, zoom, clientX, clientY) {
  const rect = pageEl.getBoundingClientRect();
  return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
}
