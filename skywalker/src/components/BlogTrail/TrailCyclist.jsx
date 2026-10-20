import { motion } from "framer-motion";
import CyclistSprite from "../CyclistSprite/CyclistSprite";
import { RIDER_BASE_PCT } from "./trailLayout";

/** Places the pedalling sprite at the scroll-driven on-screen x, tyres planted on the trail. */
export default function TrailCyclist({ x, isMoving, direction }) {
  return (
    <motion.div
      style={{ x, bottom: `${RIDER_BASE_PCT}%` }}
      className="pointer-events-none absolute left-0 z-30 -translate-x-1/2 will-change-transform"
    >
      <CyclistSprite isMoving={isMoving} direction={direction} inline />
    </motion.div>
  );
}
