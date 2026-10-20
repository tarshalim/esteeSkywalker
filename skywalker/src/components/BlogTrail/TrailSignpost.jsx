import { memo, useRef } from "react";
import { motion } from "framer-motion";
import CoverPin from "./CoverPin";
import { signpostFor } from "./trailAssets";
import { SIGNPOST_BASE_PCT, blogTags } from "./trailLayout";

/**
 * One stop on the trail: floating cover pin, signpost, and its title + tags.
 * Memoised so the rider starting/stopping doesn't re-render every stop.
 */
export default memo(function TrailSignpost({ blog, index, leftPct, isActive, onOpen }) {
  const pinRef = useRef(null);
  const open = () => onOpen(blog, pinRef.current);
  const tags = blogTags(blog);

  return (
    <div
      className="absolute flex -translate-x-1/2 flex-col items-center"
      style={{ left: `${leftPct}%`, bottom: `${SIGNPOST_BASE_PCT}%` }}
    >
      <CoverPin ref={pinRef} blog={blog} index={index} isActive={isActive} onClick={open} />

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
          <span className="rounded-lg bg-white/95 px-2.5 py-1 text-sm font-bold leading-tight text-slate-900 shadow-md dark:bg-slate-900/90 dark:text-white">
            {blog.title}
          </span>
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
