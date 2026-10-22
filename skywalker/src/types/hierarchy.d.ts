/**
 * The travel data hierarchy: Location -> Trip -> (BlogPost, GalleryItem).
 *
 * The app is plain JS; these interfaces document the shapes the stores read
 * and write and are referenced from JSDoc, e.g.
 *   @param {import("../types/hierarchy").Trip} trip
 *
 * Supabase tables (supabase/migrations/20261021030000_location_trip_hierarchy.sql):
 *   locations        Location          (the globe pin; formerly `pins`)
 *   trips            Trip              trips.location_id -> locations.id
 *   trip_companions  TripCompanionInterval  -> trips.id
 *   blogs            BlogPost          blogs.trip_id -> trips.id, blogs.location_id -> locations.id
 *   gallery_items    GalleryItem       gallery_items.trip_id -> trips.id, .blog_id -> blogs.id
 */

/** yyyy-mm-dd */
export type ISODate = string;
/** Full ISO 8601 timestamp */
export type ISODateTime = string;

/** A place on the globe. Rendered as a pin; holds any number of trips. */
export interface Location {
  id: string;
  lat: number;
  lng: number;
  /** "Kyoto, Japan" or a name the user chose. */
  title: string;
  /** Resolved place label; older locations don't have one. */
  placeName: string | null;
  note: string;
  countryCode?: string;
  countryName?: string;
  city?: string;
  createdAt: ISODateTime;
}

/**
 * Who came along for part of a trip. A trip can have several phases with
 * different people; intervals may overlap and must sit inside the trip dates.
 */
export interface TripCompanionInterval {
  id: string;
  startDate: ISODate;
  endDate: ISODate;
  names: string[];
}

/** One journey at a location, e.g. "Summer Kyoto Food Tour 2026". */
export interface Trip {
  id: string;
  locationId: Location["id"];
  title: string;
  startDate: ISODate;
  endDate: ISODate;
  note?: string;
  companions: TripCompanionInterval[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Fields of a post this hierarchy relies on (blogStore owns the rest). */
export interface BlogPost {
  id: string;
  title: string;
  status: "draft" | "published";
  /** The Location this post is filed under (column `blogs.location_id`). Derived from the trip when there is one. */
  pinId: Location["id"] | null;
  tripId: Trip["id"] | null;
  location: { name: string; lat?: number; lng?: number };
  countryCode: string;
  countryName: string;
  continent?: string;
  city?: string;
  /** Must fall inside the trip's dates when the post has a trip. */
  startDate: ISODate;
  endDate: ISODate | null;
  tags?: string[];
  vibes?: string[];
  coverImage: string;
  favorite?: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * A photo or video. Standalone in a trip's gallery (`blogId` null), attached
 * to one of its posts, or unfiled (no trip) — every kind shows in the Gallery.
 */
export interface GalleryItem {
  id: string;
  type: "image" | "video";
  url: string;
  thumbUrl: string | null;
  /** Derived from the trip (or the attached post) — column `gallery_items.location_id`. */
  pinId: Location["id"] | null;
  tripId: Trip["id"] | null;
  blogId: BlogPost["id"] | null;
  caption?: string;
  tags?: string[];
  lat: number | null;
  lng: number | null;
  countryCode: string;
  countryName: string;
  continent: string;
  locationName: string;
  timestamp: ISODateTime;
  year: number;
  /** "HH:MM" wall-clock time taken (from EXIF or typed); older items don't have one. */
  timeTaken?: string | null;
  /** "FUJIFILM X100V", from EXIF Make/Model. */
  camera?: string | null;
  /** Whether lat/lng came from the photo's EXIF GPS or were entered by hand. */
  locationSource?: "exif" | "manual";
  /** Pixel size as displayed (orientation applied), measured on upload; older items don't have one. */
  width?: number | null;
  height?: number | null;
  /** Original file size in bytes, measured on upload. */
  fileSize?: number | null;
}

/** How a gallery item hangs off the hierarchy (Gallery's photo-type filter). */
export type Attachment = "blog" | "standalone" | "unfiled";

/** A trip with its content joined on (the globe's quick card). */
export interface TripNode extends Trip {
  posts: BlogPost[];
  photos: GalleryItem[];
}

/** A location with everything under it joined on — what a globe pin renders. */
export interface LocationNode extends Location {
  trips: TripNode[];
  /** Every post at this location, in a trip or not (newest trip first). */
  posts: BlogPost[];
  /** Every gallery item at this location. */
  photos: GalleryItem[];
  /** Stand-in for a post that predates locations (no pinId). */
  virtual?: boolean;
  blogId?: string;
}

/** Draft state of the trip form while creating/editing. */
export interface TripDraft {
  title: string;
  startDate: ISODate;
  endDate: ISODate;
  note: string;
  companions: TripCompanionInterval[];
}
