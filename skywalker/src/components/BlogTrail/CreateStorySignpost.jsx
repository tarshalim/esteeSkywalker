import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { CREATE_SIGNPOST } from "./trailAssets";
import { SIGNPOST_BASE_PCT } from "./trailLayout";

const BOARD_TEXT =
  "absolute inset-x-[10%] -translate-y-1/2 text-center font-black uppercase leading-none tracking-wide text-[#fff4dc] [text-shadow:0_1px_0_#4a2f14] text-[clamp(9px,1.5vh,14px)]";

/**
 * Blank wooden post at the trailhead: the call to action for writing a post.
 * A pulsing halo, floating tooltip and hover glow flag it as clickable.
 */
export default function CreateStorySignpost({ leftPct, isFirstStory, onCreate }) {
  return (
    <div
      data-tour="create-story"
      className="absolute flex -translate-x-1/2 flex-col items-center"
      style={{ left: `${leftPct}%`, bottom: `${SIGNPOST_BASE_PCT}%` }}
    >
      <div className="relative mb-3 animate-pin-float rounded-xl bg-white px-3 py-2 text-center text-sm font-bold text-slate-900 shadow-lg will-change-transform motion-reduce:animate-none dark:bg-slate-900 dark:text-white">
        {isFirstStory ? "Click to plant your first story!" : "Plant a new story here"}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-white dark:border-t-slate-900" />
      </div>

      <motion.button
        type="button"
        onClick={onCreate}
        aria-label={isFirstStory ? "Create your first blog post" : "Create a new blog post"}
        className="group relative cursor-pointer origin-bottom rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-yellow-300"
        whileHover={{ rotate: -2, scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[30%] size-[clamp(120px,20vh,190px)] -translate-x-1/2 -translate-y-1/2 animate-halo rounded-full bg-yellow-300/60 motion-reduce:hidden"
        />
        <img
          src={CREATE_SIGNPOST}
          alt=""
          draggable={false}
          className="relative h-[clamp(150px,30vh,280px)] w-auto select-none transition-[filter] duration-300 group-hover:drop-shadow-[0_0_18px_rgba(250,204,21,0.95)] group-focus-visible:drop-shadow-[0_0_18px_rgba(250,204,21,0.95)]"
        />
        {/* Lettering painted onto the two blank boards */}
        <span className={`${BOARD_TEXT} top-[23%]`}>New story</span>
        <span className={`${BOARD_TEXT} top-[42%] flex items-center justify-center gap-0.5`}>
          <Plus className="size-[1.1em]" strokeWidth={3.5} /> Write
        </span>
      </motion.button>
    </div>
  );
}
