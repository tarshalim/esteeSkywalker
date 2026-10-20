import { useEffect, useState } from "react";
import {
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "framer-motion";
import { CAMERA_LEAD, riderWorldX } from "../components/BlogTrail/trailLayout";

const MOVING_VELOCITY = 0.004;

/**
 * Maps vertical scroll through `targetRef` onto a horizontal ride. Framer's useScroll reads
 * scroll position in a passive listener and batches into its rAF loop, and everything below is a
 * motion value, so scrolling never re-renders React except when the rider starts/stops/turns.
 * - `scrollProgress` raw 0 → 1 (where the page actually is)
 * - `progress`      smoothed 0 → 1
 * - `riderX`        rider's position along the world (trail) in px
 * - `cameraX`       translateX for the world layer, keeping the rider near CAMERA_LEAD of the screen
 * - `riderScreenX`  rider's on-screen x
 * - `isMoving` / `direction` for the pedalling sprite
 */
export function useTrailScroll(targetRef, worldWidth, viewportWidth) {
  const { scrollYProgress } = useScroll({ target: targetRef, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.6 });

  // Sizes live in motion values so the transforms below stay reactive without re-subscribing.
  const worldMV = useMotionValue(worldWidth);
  const viewportMV = useMotionValue(viewportWidth);
  useEffect(() => {
    worldMV.set(worldWidth);
    viewportMV.set(viewportWidth);
  }, [worldWidth, viewportWidth, worldMV, viewportMV]);

  const riderX = useTransform([progress, worldMV, viewportMV], ([p, w, vw]) => riderWorldX(p, w, vw));
  const cameraX = useTransform([riderX, worldMV, viewportMV], ([x, w, vw]) =>
    -Math.min(Math.max(x - vw * CAMERA_LEAD, 0), Math.max(w - vw, 0))
  );
  const riderScreenX = useTransform([riderX, cameraX], ([x, cam]) => x + cam);

  const [ride, setRide] = useState({ isMoving: false, direction: 1 });
  const velocity = useVelocity(progress);
  useMotionValueEvent(velocity, "change", (v) => {
    const isMoving = Math.abs(v) > MOVING_VELOCITY;
    const direction = isMoving ? Math.sign(v) : null;
    setRide((prev) =>
      prev.isMoving === isMoving && (direction == null || prev.direction === direction)
        ? prev
        : { isMoving, direction: direction ?? prev.direction }
    );
  });

  return { scrollProgress: scrollYProgress, progress, riderX, cameraX, riderScreenX, ...ride };
}
