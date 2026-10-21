import { formatDateRange } from "../utils/dateFilters";

// Pure helpers for the Location -> Trip -> (posts, gallery items) hierarchy.
// No store imports, so filters, pickers and search can all share them.

/** @typedef {import("../types/hierarchy").Trip} Trip */
/** @typedef {import("../types/hierarchy").TripDraft} TripDraft */
/** @typedef {import("../types/hierarchy").GalleryItem} GalleryItem */

/** TripSelect's value for "create a new trip". */
export const NEW_TRIP = "new";

const todayISO = () => new Date().toISOString().slice(0, 10);

/** @returns {TripDraft} */
export function emptyTripDraft(startDate = todayISO(), endDate = startDate) {
  return { title: "", startDate, endDate, note: "", companions: [] };
}

/** @returns {TripDraft} */
export function draftFromTrip(trip) {
  return {
    title: trip.title,
    startDate: trip.startDate,
    endDate: trip.endDate,
    note: trip.note ?? "",
    companions: (trip.companions ?? []).map((c) => ({ ...c, names: [...c.names] })),
  };
}

/** "Kyoto Food Tour · Oct 1 – Oct 9, 2026" */
export function tripLabel(trip) {
  return `${trip.title} · ${formatDateRange(trip.startDate, trip.endDate)}`;
}

/** Does [start, end] (yyyy-mm-dd, `end` optional) sit inside the trip's dates? */
export function isWithinTrip(trip, start, end = start) {
  return Boolean(start) && start >= trip.startDate && (end || start) <= trip.endDate;
}

/**
 * Why a trip (or draft) can't be saved, or null. Companion intervals must sit
 * inside the trip and name at least one person.
 * @param {TripDraft | Trip} trip
 */
export function validateTrip(trip) {
  if (!trip.title?.trim()) return "Give the trip a name";
  if (!trip.startDate) return "Pick the trip's start date";
  if (!trip.endDate) return "Pick the trip's end date";
  if (trip.endDate < trip.startDate) return "The trip can't end before it starts";
  for (const c of trip.companions ?? []) {
    const who = c.names?.filter((n) => n.trim()).join(", ") || "Companions";
    if (!c.startDate || !c.endDate) return `${who}: pick both dates`;
    if (c.endDate < c.startDate) return `${who}: the end date is before the start date`;
    if (c.startDate < trip.startDate || c.endDate > trip.endDate) return `${who}: dates must fall within the trip`;
  }
  return null;
}

/** Names of everyone with the trip at any point in [start, end] (yyyy-mm-dd, inclusive). */
export function companionsDuring(trip, start, end = start) {
  if (!trip || !start) return [];
  const names = new Set();
  for (const c of trip.companions ?? []) {
    if (c.startDate <= end && c.endDate >= start) c.names.forEach((n) => names.add(n));
  }
  return [...names];
}

/** Everyone who came on the trip at some point. */
export const allCompanions = (trip) => companionsDuring(trip, trip?.startDate, trip?.endDate);

/** Companions for a post: those overlapping its own dates within its trip. */
export function companionsForPost(blog, trip) {
  if (!trip) return [];
  const start = blog.startDate ?? blog.postDate ?? blog.date ?? trip.startDate;
  return companionsDuring(trip, start, blog.endDate || start);
}

/** Companions for a photo: those with the trip on the day it was taken. */
export function companionsForPhoto(item, trip) {
  if (!trip) return [];
  const day = (item.timestamp ?? "").slice(0, 10) || trip.startDate;
  return companionsDuring(trip, day, day);
}

/**
 * How a gallery item hangs off the hierarchy.
 * @param {GalleryItem} item
 * @returns {import("../types/hierarchy").Attachment}
 */
export function attachmentOf(item) {
  if (item.blogId) return "blog";
  return item.tripId ? "standalone" : "unfiled";
}

export const ATTACHMENT_FILTERS = [
  { id: "", label: "All photos" },
  { id: "blog", label: "Blog-attached only" },
  { id: "standalone", label: "Standalone trip photos" },
];

/** Splits "Aiko, Ben ,  " into ["Aiko", "Ben"]. */
export function parseNames(text) {
  return [...new Set(text.split(",").map((n) => n.trim()).filter(Boolean))];
}

/** Parses "street food, temples" into lower-case tags. */
export function parseTags(text) {
  return [...new Set(text.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

/**
 * The trips that `items` (posts or gallery items, already narrowed by place
 * and date) point at — the options for a cascading Trip filter.
 * @param {Trip[]} trips
 * @param {{ tripId?: ?string }[]} items
 */
export function tripsReferencedBy(trips, items) {
  const ids = new Set(items.map((i) => i.tripId).filter(Boolean));
  return trips.filter((t) => ids.has(t.id));
}

/** Sorted unique companion names across `trips`. */
export function companionOptions(trips) {
  const names = new Set();
  for (const trip of trips) allCompanions(trip).forEach((n) => names.add(n));
  return [...names].sort((a, b) => a.localeCompare(b));
}
