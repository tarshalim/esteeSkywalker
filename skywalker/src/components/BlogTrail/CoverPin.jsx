import { motion } from "framer-motion";

/**
 * Teardrop map pin that frames a post's cover image and bobs gently in place.
 * The bob is a CSS keyframe on `translate` (compositor-only); Framer handles hover/tap scale.
 * `ref` targets the pin head so the transition can zoom from its exact centre.
 */
export default function CoverPin({ ref, blog, index, isActive, onClick }) {
  const phase = { animationDelay: `${(index % 4) * 0.45}s` };

  return (
    <div className="relative flex flex-col items-center">
      <motion.button
        type="button"
        onClick={onClick}
        aria-label={`Open blog: ${blog.title}`}
        style={phase}
        className="group relative animate-pin-float cursor-pointer rounded-full outline-none will-change-transform focus-visible:ring-4 focus-visible:ring-yellow-300 motion-reduce:animate-none"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
      >
        <motion.div
          ref={ref}
          animate={{ scale: isActive ? 1.1 : 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          // Square with one sharp corner, rotated so the point aims at the signpost.
          className="relative size-[clamp(78px,11vh,112px)] -rotate-45 rounded-[50%_50%_50%_0] border-[5px] border-white bg-yellow-400 shadow-[0_10px_24px_rgba(15,23,42,0.35)]"
        >
          <img
            src={blog.coverImage}
            alt=""
            draggable={false}
            decoding="async"
            className="absolute inset-[3px] h-[calc(100%-6px)] w-[calc(100%-6px)] rotate-45 select-none rounded-full object-cover"
          />
        </motion.div>
        {blog.status === "draft" && (
          <span className="absolute -right-3 -top-2 rounded-full bg-slate-900/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-300">
            Draft
          </span>
        )}
      </motion.button>

      {/* Ground shadow shrinks as the pin rises, selling the hover. */}
      <div
        aria-hidden
        style={phase}
        className="mt-3 h-2.5 w-12 animate-pin-shadow rounded-[50%] bg-slate-900/30 motion-reduce:animate-none"
      />
    </div>
  );
}
