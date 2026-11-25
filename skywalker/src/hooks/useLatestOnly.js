import { useCallback, useEffect, useRef } from "react";

/**
 * Last-request-wins guard for refetches. Each call to `begin()` starts a new
 * request and returns `isCurrent()`, which stays true only until the next
 * `begin()` or until the component unmounts. Apply a response only while
 * `isCurrent()` holds, so two overlapping live-sync refreshes can't land out of
 * order (an older, slower response overwriting a newer one) and a fetch that
 * finishes after unmount is dropped.
 *
 *   const begin = useLatestOnly();
 *   const load = useCallback(() => {
 *     const isCurrent = begin();
 *     getTrips().then((list) => isCurrent() && setTrips(list));
 *   }, [begin]);
 */
export function useLatestOnly() {
  const seqRef = useRef(0);
  useEffect(
    () => () => {
      seqRef.current += 1;
    },
    []
  );
  return useCallback(() => {
    const seq = ++seqRef.current;
    return () => seq === seqRef.current;
  }, []);
}
