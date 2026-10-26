import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const BASE = import.meta.env.BASE_URL;

// The same three riders under four different skies — crossfading keeps the
// silhouettes still while the light changes behind them.
const FRAMES = [
  { src: `${BASE}frames/sil-pictureframe.png`, alt: "Three cyclists silhouetted at the water's edge under a soft golden sky" },
  { src: `${BASE}frames/sil-pictureframe02.png`, alt: "Three cyclists silhouetted at the water's edge, second sky" },
  { src: `${BASE}frames/sil-pictureframe03.png`, alt: "Three cyclists silhouetted at the water's edge under a fiery sunset" },
  { src: `${BASE}frames/sil-pictureframe04.png`, alt: "Three cyclists silhouetted at the water's edge, fourth sky" },
];

const AUTOPLAY_MS = 6000;
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 400;

export default function HeroCarousel({ title, titleId }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const count = FRAMES.length;

  const go = useCallback((delta) => setIndex((i) => (i + delta + count) % count), [count]);

  // Auto-rotate, but never under reduced motion, while hovered/focused, or in
  // a background tab (the interval would otherwise pile up skipped frames).
  useEffect(() => {
    if (reduceMotion || paused) return;
    const id = setInterval(() => {
      if (!document.hidden) go(1);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [reduceMotion, paused, go, index]);

  const handleDragEnd = (_, { offset, velocity }) => {
    if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) go(1);
    else if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) go(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
  };

  return (
    <section
      className="relative mx-auto w-[min(1000px,calc(100%-3rem))] max-sm:w-[calc(100%-1.5rem)] pt-7 sm:pt-9 mb-8 sm:mb-10"
      aria-roledescription="carousel"
      aria-labelledby={titleId}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
      onKeyDown={handleKeyDown}
    >
      {/* Scrapbook print: white border, a slight tilt and washi tape pinning
          the top-left and bottom-right corners. */}
      <div
        className="relative rotate-[-0.6deg] rounded-md p-2 pb-9 sm:p-3 sm:pb-12 shadow-[0_18px_40px_var(--shadow-color)] ring-1 ring-black/5"
        style={{ background: "var(--bg-elevated)" }}
      >
        <span
          aria-hidden="true"
          className="absolute -left-4 top-2 sm:-left-6 sm:top-3 z-20 h-6 w-20 sm:h-7 sm:w-28 -rotate-45 rounded-sm opacity-80 shadow-sm"
          style={{ background: "color-mix(in srgb, var(--yellow) 55%, #fff7ed)" }}
        />
        <span
          aria-hidden="true"
          className="absolute -right-4 bottom-2 sm:-right-6 sm:bottom-3 z-20 h-6 w-20 sm:h-7 sm:w-28 -rotate-45 rounded-sm opacity-80 shadow-sm"
          style={{ background: "color-mix(in srgb, var(--blue-bright) 35%, #fdf2f8)" }}
        />

        <div className="relative aspect-video overflow-hidden rounded-sm bg-slate-900">
          <motion.div
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={handleDragEnd}
            aria-live={paused || reduceMotion ? "polite" : "off"}
          >
            {FRAMES.map((frame, i) => {
              const active = i === index;
              return (
                <motion.img
                  key={frame.src}
                  src={frame.src}
                  alt={active ? frame.alt : ""}
                  aria-hidden={!active}
                  draggable={false}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                  initial={false}
                  animate={{
                    opacity: active ? 1 : 0,
                    // A slow settle-in on the incoming frame for a hint of parallax.
                    scale: active || reduceMotion ? 1 : 1.06,
                  }}
                  transition={{
                    opacity: { duration: reduceMotion ? 0 : 1.1, ease: "easeInOut" },
                    scale: { duration: reduceMotion ? 0 : 6.5, ease: "easeOut" },
                  }}
                />
              );
            })}
          </motion.div>

          {/* Soft top vignette so the title badge never sits on a hard edge. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/25 to-transparent"
          />

          <ArrowButton side="left" label="Previous picture" onClick={() => go(-1)} />
          <ArrowButton side="right" label="Next picture" onClick={() => go(1)} />
        </div>

        <div className="absolute inset-x-0 bottom-3 sm:bottom-4 flex items-center justify-center sm:gap-2" role="group" aria-label="Choose picture">
          {FRAMES.map((frame, i) => (
            <button
              key={frame.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show picture ${i + 1} of ${count}`}
              aria-current={i === index}
              className="group grid h-8 w-8 place-items-center sm:h-6 sm:w-6"
            >
              <span
                className={`block h-2 rounded-full transition-all duration-300 ${
                  i === index ? "w-6 bg-[var(--text-strong)]" : "w-2 bg-[var(--text-muted)] opacity-50 group-hover:opacity-90"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Title badge straddles the top edge of the print, centred, so it stays
          legible on every sky without covering the riders on small screens. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-3">
        <h1
          id={titleId}
          className="pointer-events-auto m-0 max-w-full rounded-2xl border px-5 py-2 sm:px-8 sm:py-3 text-center text-[clamp(1rem,3vw,2rem)] font-normal leading-snug backdrop-blur-md shadow-[0_10px_30px_var(--shadow-color)]"
          style={{
            fontFamily: '"Rock Salt", "Patrick Hand", "Comic Sans MS", system-ui, sans-serif',
            color: "var(--text-strong)",
            background: "var(--bg-panel)",
            borderColor: "var(--glass-border)",
            textShadow: "0 1px 0 rgba(255,255,255,0.35)",
          }}
        >
          {title}
        </h1>
      </div>
    </section>
  );
}

function ArrowButton({ side, label, onClick }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 ${side === "left" ? "left-2 sm:left-4" : "right-2 sm:right-4"} z-10 grid h-9 w-9 sm:h-11 sm:w-11 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-white/25 text-white shadow-md backdrop-blur-md transition hover:bg-white/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
    >
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}
