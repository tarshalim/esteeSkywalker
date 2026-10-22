import { useEffect, useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { setBlogVisibility } from "../../lib/blogStore";
import "./VisibilityToggle.css";

const ERROR_MS = 5000;

/**
 * Owner-only Public/Private switch for a post. The flip shows at once via
 * `onChange`; a failed save flips it back and says why. Clicks are ignored
 * while a save is in flight, so it never sends overlapping requests.
 */
export default function VisibilityToggle({ blog, onChange }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const isPublic = blog.status === "published";

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), ERROR_MS);
    return () => clearTimeout(timer);
  }, [error]);

  const toggle = async () => {
    if (pending) return;
    const previous = blog;
    const makePublic = !isPublic;
    setError(null);
    setPending(true);
    onChange({ ...blog, status: makePublic ? "published" : "draft" });
    try {
      onChange(await setBlogVisibility(blog.id, makePublic));
    } catch (err) {
      console.error(err);
      onChange(previous);
      setError(`Couldn't make this post ${makePublic ? "public" : "private"}. ${err.message}`);
    } finally {
      setPending(false);
    }
  };

  const Icon = pending ? LoaderCircle : isPublic ? Eye : EyeOff;

  return (
    <div className="visibility-toggle-wrap">
      <button
        type="button"
        className={`visibility-toggle ${isPublic ? "is-public" : "is-private"}`}
        onClick={toggle}
        disabled={pending}
        aria-busy={pending}
        aria-label={isPublic ? "Make post private" : "Make post public"}
        title={
          isPublic
            ? "Public: anyone can see this post. Click to hide it."
            : "Private: only you can see this post. Click to publish it."
        }
      >
        <Icon size={15} className={pending ? "visibility-toggle-spin" : undefined} aria-hidden="true" />
        <span>{isPublic ? "Public" : "Private"}</span>
      </button>
      {error && (
        <p className="visibility-toggle-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
