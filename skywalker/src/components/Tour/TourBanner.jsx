import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useTour } from "../../lib/tour";
import "./Tour.css";

/**
 * Opt-in prompt for first-time visitors. Answering either way records the
 * choice (see lib/tour.jsx), so returning users aren't asked again; the nav's
 * ? button restarts the tour on demand.
 */
export default function TourBanner() {
  const { shouldOffer, start, dismissOffer } = useTour();

  return (
    <AnimatePresence>
      {shouldOffer && (
        <motion.aside
          className="tour-banner glass-panel"
          aria-label="Guided tour"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.8 }}
        >
          <span className="tour-banner-icon" aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <div className="tour-banner-text">
            <strong>New here?</strong>
            <span>Take a one-minute tour of your blog journey, the scrapbook editor and the globe.</span>
          </div>
          <div className="tour-banner-actions">
            <button type="button" className="tour-btn tour-btn--primary" onClick={start}>
              Show me around
            </button>
            <button type="button" className="tour-btn tour-btn--ghost" onClick={dismissOffer}>
              Not now
            </button>
          </div>
          <button type="button" className="tour-close tour-banner-close" onClick={dismissOffer} aria-label="Dismiss">
            <X size={16} />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
