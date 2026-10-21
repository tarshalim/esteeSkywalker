import { memo, useRef } from "react";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { formatWeather } from "../../lib/weather";
import CoverPin from "./CoverPin";
import { signpostFor } from "./trailAssets";
import { SIGNPOST_BASE_PCT, blogTags } from "./trailLayout";

/**
 * One stop on the trail: floating cover pin, signpost, and its title + tags.
 * Memoised so the rider starting/stopping doesn't re-render every stop.
 * `searchMatch` is null with no navbar query, else whether this post matches:
 * matches pulse, the rest fade back. `onToggleFavorite` (editors only) adds a
 * heart button; without it a favorite just shows a filled heart.
 */
export default memo(function TrailSignpost({ blog, index, leftPct, isActive, searchMatch = null, onOpen, onToggleFavorite }) {
  const pinRef = useRef(null);
  const open = () => onOpen(blog, pinRef.current);
  const tags = blogTags(blog);
  const weather = formatWeather(blog.weather);

  return (
    <div
      className={`absolute flex -translate-x-1/2 flex-col items-center transition-[opacity,filter] duration-300 ${
        searchMatch === false ? "opacity-35 grayscale-[60%]" : ""
      }`}
      style={{ left: `${leftPct}%`, bottom: `${SIGNPOST_BASE_PCT}%` }}
    >
      <CoverPin ref={pinRef} blog={blog} index={index} isActive={isActive} glow={searchMatch === true} onClick={open} />

      <div className="relative">
        <motion.button
          type="button"
          onClick={open}
          // The pin is the keyboard target; this is a second, larger mouse/touch target.
          tabIndex={-1}
          aria-hidden
          className="block cursor-pointer origin-bottom"
          whileHover={{ rotate: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          <img
            src={signpostFor(index)}
            alt=""
            draggable={false}
            className="h-[clamp(150px,30vh,280px)] w-auto select-none drop-shadow-[0_8px_8px_rgba(0,0,0,0.25)]"
          />
        </motion.button>

        <motion.div
          animate={{ opacity: isActive ? 1 : 0.88, x: isActive ? 4 : 0 }}
          className="pointer-events-none absolute bottom-[34%] left-[calc(50%+14px)] flex w-max max-w-[min(200px,40vw)] flex-col items-start gap-1.5"
        >
          <div className="flex items-start gap-1">
            <span className="rounded-lg bg-white/95 px-2.5 py-1 text-sm font-bold leading-tight text-slate-900 shadow-md dark:bg-slate-900/90 dark:text-white">
              {blog.title}
            </span>
            {onToggleFavorite ? (
              <button
                type="button"
                aria-pressed={Boolean(blog.favorite)}
                aria-label={blog.favorite ? `Remove “${blog.title}” from favorites` : `Add “${blog.title}” to favorites`}
                title={blog.favorite ? "Remove from favorites" : "Add to favorites"}
                onClick={() => onToggleFavorite(blog)}
                className="pointer-events-auto grid size-7 shrink-0 place-items-center rounded-full bg-white/95 text-rose-500 shadow-md transition-transform hover:scale-110 dark:bg-slate-900/90"
              >
                <Heart size={14} aria-hidden="true" fill={blog.favorite ? "currentColor" : "none"} />
              </button>
            ) : (
              blog.favorite && (
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/95 text-rose-500 shadow-md dark:bg-slate-900/90">
                  <Heart size={14} fill="currentColor" aria-label="Favorite" />
                </span>
              )
            )}
          </div>
          {weather && (
            <span className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm dark:bg-slate-900/80 dark:text-slate-200">
              {weather}
            </span>
          )}
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-blue-600/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
});
