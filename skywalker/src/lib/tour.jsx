import { createContext, useCallback, useContext, useState } from "react";

const TourContext = createContext(null);
const STORAGE_KEY = "skywalker-tour";

// "completed" | "skipped" | "dismissed" once the user has answered; any value
// stops the homepage from offering the tour again automatically.
function readStatus() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStatus(status) {
  try {
    window.localStorage.setItem(STORAGE_KEY, status);
  } catch {
    // Storage blocked — the offer will just reappear next visit.
  }
}

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
    shouldOffer: status === null && !isActive,
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
