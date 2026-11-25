import { Link } from "react-router-dom";
// Reuses the 404 page's centred status layout so both "something's wrong"
// screens look the same. Imported statically, so it's in the entry chunk and
// still renders when a lazy page chunk is the thing that failed to load.
import "../../pages/NotFound/NotFound.css";

// Route-level ErrorBoundary fallback. The usual causes are a render bug or a
// page chunk that failed to load (offline, or a deploy replaced the old hashed
// files). A full reload fixes the second, so it's offered first.
export default function RouteError() {
  return (
    <div className="not-found" role="alert">
      <h1>Something went wrong</h1>
      <p>This page couldn’t be shown. Reloading usually fixes it.</p>
      <button type="button" className="not-found-home-link" onClick={() => window.location.reload()}>
        Reload page
      </button>
      <Link to="/" className="not-found-home-link">
        ← Back home
      </Link>
    </div>
  );
}
