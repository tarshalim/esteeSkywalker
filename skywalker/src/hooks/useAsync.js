import { useCallback, useEffect, useRef, useState } from "react";
import { useLatestOnly } from "./useLatestOnly";

/**
 * Runs an async loader and tracks { data, error, loading }. Only the latest
 * request's result is applied: one that lands after unmount, after `deps`
 * change (so a slow response for an old route param can't overwrite the
 * current one) or after a newer `reload()` is ignored.
 *
 * `reload()` re-runs the loader in place for live-sync refreshes: no loading
 * state, and a failed refresh keeps the data already on screen (it's logged).
 * `setData` allows local updates after a mutation, e.g. appending a freshly
 * uploaded photo.
 */
export function useAsync(load, deps, initialData = null) {
  const [state, setState] = useState({ data: initialData, error: null, loading: true });
  const begin = useLatestOnly();
  // reload() always runs the loader from the latest render. Declared before the
  // load effect so it's up to date when that effect runs in the same commit.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const run = useCallback(() => {
    const isCurrent = begin();
    Promise.resolve()
      .then(() => loadRef.current())
      .then(
        (data) => isCurrent() && setState({ data, error: null, loading: false }),
        (error) => {
          if (!isCurrent()) return;
          console.error(error);
          // Only surface the error when nothing is shown yet; a failed refresh
          // leaves the current data (and any earlier error) as they are.
          setState((prev) => (prev.loading ? { ...prev, error, loading: false } : prev));
        }
      );
  }, [begin]);

  useEffect(() => {
    setState((prev) => ({ ...prev, error: null, loading: true }));
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback(
    (updater) =>
      setState((prev) => ({ ...prev, data: typeof updater === "function" ? updater(prev.data) : updater })),
    []
  );

  return { ...state, setData, reload: run };
}
