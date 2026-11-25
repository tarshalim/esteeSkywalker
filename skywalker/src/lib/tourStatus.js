// Tour answer persistence for src/lib/tour.jsx. Kept free of React so it can
// be unit-tested.

export const TOUR_STORAGE_KEY = "skywalker-tour";

/**
 * "completed" | "skipped" | "dismissed" once the user has answered, else null.
 * Any stored value stops the homepage from offering the tour again. Never
 * throws (storage may be blocked).
 */
export function readTourStatus(storage) {
  try {
    return storage?.getItem(TOUR_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Saves the answer. Returns false when storage refuses it (the offer then reappears next visit). */
export function writeTourStatus(storage, status) {
  try {
    storage.setItem(TOUR_STORAGE_KEY, status);
    return true;
  } catch {
    return false;
  }
}

/** The banner is offered until the user has answered, and never over a running tour. */
export const shouldOfferTour = (status, isActive) => status === null && !isActive;
