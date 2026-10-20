import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import CyclistSprite from "../CyclistSprite/CyclistSprite";
import TrailPath from "../BlogTrail/TrailPath";
import { LANDSCAPES, signpostFor } from "../BlogTrail/trailAssets";
import { RIDER_BASE_PCT, SIGNPOST_BASE_PCT } from "../BlogTrail/trailLayout";
import "./JourneyPortal.css";

const SCENE_MS = 4000;
const POSTS = [
  { left: "34%", delay: 0 },
  { left: "58%", delay: 0.12 },
  { left: "82%", delay: 0.24 },
];

/**
 * "Ride the full journey" — a miniature of the My Blog trail (scenery,
 * signposts, the pedalling rider) that links through to /blogs.
 * Everything only animates while the card is on screen.
 */
export default function JourneyPortal({ storyCount = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.3 });
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [scene, setScene] = useState(0);
  const live = inView && !reduceMotion;

  // Scenery cycles like riding through the trail's landscapes; quicker on hover.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setScene((s) => (s + 1) % LANDSCAPES.length), hovered ? SCENE_MS / 2 : SCENE_MS);
    return () => clearInterval(id);
  }, [live, hovered]);

  return (
    <motion.div
      ref={ref}
      className="journey-portal mx-auto w-full max-w-3xl"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Link
        to="/blogs"
        className="group relative block h-48 sm:h-56 overflow-hidden rounded-2xl border-4 shadow-[0_14px_36px_var(--shadow-color)] transition-transform duration-300 hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
        style={{ borderColor: "var(--bg-elevated)" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-label={`Ride the full journey — open the blog trail${storyCount ? ` (${storyCount} stories)` : ""}`}
      >
        {/* Scenery */}
        {LANDSCAPES.map((src, i) => (
          <motion.img
            key={src}
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover object-bottom"
            initial={false}
            animate={{ opacity: i === scene ? 1 : 0, scale: hovered && !reduceMotion ? 1.06 : 1 }}
            transition={{ opacity: { duration: 1.2 }, scale: { duration: 1.6, ease: "easeOut" } }}
          />
        ))}

        <TrailPath />

        {/* Signposts — they lean in to greet the rider on hover. */}
        {POSTS.map((post, i) => (
          <motion.img
            key={i}
            src={signpostFor(i)}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute h-[46%] -translate-x-1/2 origin-bottom drop-shadow-md"
            style={{ left: post.left, bottom: `${SIGNPOST_BASE_PCT}%` }}
            animate={hovered && !reduceMotion ? { rotate: [0, -6, 3, 0], y: [0, -6, 0, 0] } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.8, delay: post.delay, ease: "easeOut" }}
          />
        ))}

        {/* The rider loops across the trail while the card is visible. */}
        <motion.div
          className="journey-portal-rider pointer-events-none absolute z-10 -translate-x-1/2"
          style={{ bottom: `${RIDER_BASE_PCT}%` }}
          initial={{ left: "12%" }}
          animate={live ? { left: ["-12%", "112%"] } : { left: "12%" }}
          transition={live ? { duration: hovered ? 6 : 12, ease: "linear", repeat: Infinity } : { duration: 0 }}
        >
          <CyclistSprite isMoving={live} direction={1} inline />
        </motion.div>

        {/* Soft wash so the label reads on every landscape. */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-2/3 bg-gradient-to-b from-black/35 via-black/10 to-transparent" />

        <div className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
          <div className="text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
            <p className="m-0 text-xl sm:text-2xl leading-tight" style={{ fontFamily: '"Rock Salt", "Patrick Hand", system-ui, sans-serif' }}>
              Ride the full journey
            </p>
            {storyCount > 0 && (
              <p className="m-0 mt-1 text-sm opacity-90">
                {storyCount} {storyCount === 1 ? "story" : "stories"} waiting along the trail
              </p>
            )}
          </div>

          <span
            aria-hidden="true"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold shadow-[var(--shadow-sharp)] transition-all duration-300 group-hover:gap-3 group-hover:px-5"
            style={{ background: "linear-gradient(135deg, var(--yellow-bright), var(--yellow))", color: "var(--blue-deep)" }}
          >
            Start riding <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
