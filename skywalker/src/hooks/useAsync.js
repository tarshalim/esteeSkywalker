import { useEffect, useState } from "react";

/**
 * Runs an async loader and tracks { data, error, loading }, ignoring results
 * that land after unmount or after `deps` change (so a slow response for an
 * old route param can't overwrite the current one). `setData` allows local
 * updates after a mutation, e.g. appending a freshly uploaded photo.
 */
export function useAsync(load, deps, initialData = null) {
  const [state, setState] = useState({ data: initialData, error: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, error: null, loading: true }));
    Promise.resolve()
      .then(load)
      .then(
        (data) => !cancelled && setState({ data, error: null, loading: false }),
        (error) => {
          if (cancelled) return;
          console.error(error);
          setState((prev) => ({ ...prev, error, loading: false }));
        }
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = (updater) =>
    setState((prev) => ({ ...prev, data: typeof updater === "function" ? updater(prev.data) : updater }));

  return { ...state, setData };
}
