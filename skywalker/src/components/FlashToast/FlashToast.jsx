import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck } from "lucide-react";

const VISIBLE_MS = 3200;

/**
 * App-wide success toast for messages that outlive the page that raised them
 * (e.g. "Post deleted" after the editor unmounts). Navigate with
 * `{ state: { flash: "…" } }` to show one on the destination page.
 */
export default function FlashToast() {
  const location = useLocation();
  const navigate = useNavigate();
  const [message, setMessage] = useState(null);
  const flash = location.state?.flash;

  useEffect(() => {
    if (!flash) return;
    setMessage(flash);
    // Drop it from the history entry so a reload or Back doesn't replay it.
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: { ...location.state, flash: undefined },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          className="fixed inset-x-4 bottom-[calc(2rem+env(safe-area-inset-bottom))] z-(--z-modal) mx-auto flex w-fit max-w-[min(560px,calc(100vw-2rem))] items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-xl"
          style={{ background: "var(--blue-deep)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          <CircleCheck size={16} className="shrink-0 text-emerald-300" aria-hidden="true" />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
