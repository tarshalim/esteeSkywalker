// One place that turns a thrown error into text a reader can act on. Supabase
// infrastructure errors (network, expired session, RLS, Storage limits) get a
// plain-English message; everything else — our own `throw new Error("…")`s and
// the messages our triggers raise (check_violation, P0001, 22023) — is already
// written for people, so it passes through unchanged.

const OFFLINE = "Can’t reach the server. Check your connection and try again.";
const SESSION_EXPIRED = "Your session has expired. Please sign in again.";
const FORBIDDEN = "You don’t have permission to do that.";
const TOO_LARGE = "That file is too large.";
const BAD_TYPE = "That file type isn’t supported.";
const DUPLICATE = "That already exists.";

// fetch() rejects with a TypeError whose text differs per browser; PostgREST
// re-wraps it as "TypeError: Failed to fetch" / "FetchError: …" with no code.
const NETWORK_RE = /failed to fetch|networkerror|network request failed|load failed|fetcherror/i;

/**
 * The reader-facing text for a known infrastructure failure.
 * @param {unknown} err
 * @returns {?string} null when the error isn't one of the known kinds
 */
export function infraErrorMessage(err) {
  if (!err || typeof err !== "object") return null;
  const { message = "", code = "", statusCode = "", status = "" } = /** @type {any} */ (err);
  const http = String(statusCode || status || "");

  if (NETWORK_RE.test(message) || (typeof navigator !== "undefined" && navigator.onLine === false)) return OFFLINE;
  if (code === "PGRST301" || code === "PGRST303" || /jwt expired/i.test(message)) return SESSION_EXPIRED;
  if (code === "42501" || http === "403" || /row-level security/i.test(message)) return FORBIDDEN;
  if (http === "413" || /exceeded the maximum allowed size|payload too large/i.test(message)) return TOO_LARGE;
  if (http === "415" || /mime type .* is not supported|invalid_mime_type/i.test(message)) return BAD_TYPE;
  if (code === "23505") return DUPLICATE;
  return null;
}

/**
 * @param {unknown} err anything a `catch` can receive
 * @param {string} [fallback] shown when the error carries no message at all
 * @returns {string}
 */
export function errorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (typeof err === "string") return err || fallback;
  return infraErrorMessage(err) ?? (/** @type {any} */ (err)?.message || fallback);
}
