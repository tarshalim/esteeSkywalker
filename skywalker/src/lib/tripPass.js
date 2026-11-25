/** Small stable hash of a string (FNV-1a), for a trip's ticket code and barcode. */
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Airline-style code for a trip, e.g. "XIA-4F2": destination letters + a hash of its id. */
export function ticketCode(trip, destination) {
  const letters = (destination || trip.title || "").replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  const suffix = hashString(trip.id).toString(36).slice(-3).toUpperCase().padStart(3, "0");
  return `${letters}-${suffix}`;
}

/** Where a trip's boarding pass leads: its detail page. */
export const tripPath = (tripId) => `/trips/${encodeURIComponent(tripId)}`;

/** Starts a new post already filed under the trip (the editor reads `?trip=`). */
export const newBlogInTripPath = (tripId) => `/blogs/new?trip=${encodeURIComponent(tripId)}`;
