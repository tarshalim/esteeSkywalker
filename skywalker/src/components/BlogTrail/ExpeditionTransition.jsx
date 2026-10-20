import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

const TOTAL_MS = 2300;
const IRIS_EASE = [0.65, 0, 0.35, 1];

// Faint graticule so the reveal reads as an explorer's map rather than a photo.
const MAP_GRID =
  "repeating-linear-gradient(0deg, rgba(120,84,40,0.18) 0 1px, transparent 1px 56px), repeating-linear-gradient(90deg, rgba(120,84,40,0.18) 0 1px, transparent 1px 56px)";

/**
 * "Adventure map" hand-off into a post: an iris opens from the clicked pin onto the
 * cover image, a route draws itself to the centre, a pin drops in with a "next stop"
 * stamp, then `onComplete` fires (navigate). The trail behind is zoomed by the parent.
 */
export default function ExpeditionTransition({ trip, onComplete }) {
  const { blog, x, y } = trip;
  const destination = blog.location?.name || blog.countryName || "Adventure";
  // Route runs from the clicked pin to where the destination pin lands (just above centre).
  const w = window.innerWidth;
  const h = window.innerHeight;
  const endY = h / 2 - 30;
  const route = `M ${x} ${y} Q ${(x + w / 2) / 2} ${Math.max(y, endY) + h * 0.25}, ${w / 2} ${endY}`;

  useEffect(() => {
    const t = setTimeout(onComplete, TOTAL_MS);
    return () => clearTimeout(t);
  }, [onComplete]);

  // Portaled to <body> so the full-screen reveal covers TopNav too.
  return createPortal(
    <motion.div className="fixed inset-0 z-(--z-overlay)" role="status" aria-live="polite" exit={{ opacity: 0 }}>
      <span className="sr-only">Opening {blog.title}</span>

      <motion.div
        className="absolute inset-0 overflow-hidden bg-[#f3e2b8]"
        initial={{ clipPath: `circle(0px at ${x}px ${y}px)` }}
        animate={{ clipPath: `circle(150vmax at ${x}px ${y}px)` }}
        transition={{ delay: 0.45, duration: 0.8, ease: IRIS_EASE }}
      >
        <motion.img
          src={blog.coverImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover sepia-[0.35]"
          initial={{ scale: 1.5 }}
          animate={{ scale: 1.05 }}
          transition={{ delay: 0.45, duration: 1.8, ease: "easeOut" }}
        />
        <div className="absolute inset-0 bg-[#f3e2b8]/35 mix-blend-multiply" style={{ backgroundImage: MAP_GRID }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(60,35,10,0.6)_100%)]" />

        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${w} ${h}`} aria-hidden>
          <defs>
            {/* pathLength drives stroke-dasharray, so reveal the dashed route through an animated solid mask. */}
            <mask id="expedition-route-reveal" maskUnits="userSpaceOnUse">
              <motion.path
                d={route}
                fill="none"
                stroke="white"
                strokeWidth="24"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.95, duration: 0.6, ease: "easeInOut" }}
              />
            </mask>
          </defs>
          <g mask="url(#expedition-route-reveal)" fill="none" strokeLinecap="round">
            <path d={route} stroke="#3b2507" strokeWidth="10" strokeDasharray="2 22" />
            <path d={route} stroke="#facc15" strokeWidth="6" strokeDasharray="2 22" />
          </g>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ y: "-60vh", rotate: -20 }}
            animate={{ y: 0, rotate: 0 }}
            transition={{ delay: 1.35, type: "spring", stiffness: 420, damping: 16 }}
          >
            <MapPin className="size-20 fill-red-500 text-white drop-shadow-[0_8px_10px_rgba(0,0,0,0.45)]" strokeWidth={1.5} />
          </motion.div>

          <motion.div
            className="mt-4 rotate-[-3deg] rounded-xl border-4 border-[#3b2507] bg-[#fff6dc] px-6 py-3 shadow-[6px_6px_0_#3b2507]"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.6, type: "spring", stiffness: 380, damping: 14 }}
          >
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#9a5b12]">Next stop</p>
            <p className="text-2xl font-black text-[#3b2507] sm:text-3xl">{destination}!</p>
            <p className="mt-1 max-w-xs text-sm font-semibold text-[#3b2507]/80">{blog.title}</p>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
