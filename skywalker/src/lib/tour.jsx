import { createContext, useCallback, useContext, useState } from "react";
import { readTourStatus, shouldOfferTour, writeTourStatus } from "./tourStatus";

const TourContext = createContext(null);

// Reading `window.localStorage` itself throws when storage is blocked.
function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const readStatus = () => readTourStatus(getStorage());
const writeStatus = (status) => writeTourStatus(getStorage(), status);

/**
 * First-run guided tour state. Each step names its own page, so the Tour
 * overlay does the routing (starting on the Blog Journey) and waits for each
 * step's target to mount.
 */
export function TourProvider({ children }) {
  const [status, setStatus] = useState(readStatus);
  const [isActive, setIsActive] = useState(false);
  // UI the current step asks a page to show (a step's `preview`), held here
  // rather than sent as an event so a page that mounts after the step starts
  // (route change + page transition) still sees it.
  const [preview, setPreview] = useState(null);

  const settle = useCallback((next) => {
    writeStatus(next);
    setStatus(next);
    setIsActive(false);
    setPreview(null);
  }, []);

  const start = useCallback(() => setIsActive(true), []);

  const value = {
    isActive,
    shouldOffer: shouldOfferTour(status, isActive),
    start,
    preview,
    setPreview,
    finish: useCallback(() => settle("completed"), [settle]),
    skip: useCallback(() => settle("skipped"), [settle]),
    dismissOffer: useCallback(() => settle("dismissed"), [settle]),
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within a TourProvider");
  return ctx;
}
