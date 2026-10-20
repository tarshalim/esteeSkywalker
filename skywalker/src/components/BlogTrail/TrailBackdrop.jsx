import { motion, useTransform } from "framer-motion";
import { LANDSCAPES } from "./trailAssets";

const FADE_HALF_WIDTH = 0.08;

function BackdropLayer({ src, index, count, progress }) {
  const boundary = index / count;
  const opacity = useTransform(
    progress,
    [boundary - FADE_HALF_WIDTH, boundary + FADE_HALF_WIDTH],
    index === 0 ? [1, 1] : [0, 1]
  );
  return (
    <motion.img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      style={{ opacity }}
      className="absolute inset-0 h-full w-full select-none object-cover object-bottom will-change-[opacity]"
    />
  );
}

/**
 * Fixed scenery behind the trail: landscapes cross-fade as the rider progresses,
 * with a slow pan for a touch of parallax against the faster-moving trail.
 */
export default function TrailBackdrop({ progress }) {
  const x = useTransform(progress, [0, 1], ["0%", "-7%"]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden dark:brightness-[0.72] dark:saturate-[0.85]">
      <motion.div style={{ x }} className="absolute inset-y-0 left-0 w-[115%] will-change-transform">
        {LANDSCAPES.map((src, i) => (
          <BackdropLayer key={src} src={src} index={i} count={LANDSCAPES.length} progress={progress} />
        ))}
      </motion.div>
      {/* Top wash keeps the floating nav and page title legible over bright skies. */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-slate-900/35 to-transparent" />
    </div>
  );
}
