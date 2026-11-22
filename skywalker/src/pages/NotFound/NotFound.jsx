import { Link } from "react-router-dom";
import "./NotFound.css";

// Catch-all route: without it an unknown URL rendered the navbar over nothing.
export default function NotFound() {
  return (
    <div className="not-found">
      <h1>Off the map</h1>
      <p>There’s nothing at this address.</p>
      <Link to="/" className="not-found-home-link">
        ← Back home
      </Link>
    </div>
  );
}
