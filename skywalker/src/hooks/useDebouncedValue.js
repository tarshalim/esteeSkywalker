import { useEffect, useState } from "react";

/** `value`, but only once it has held still for `delay` ms (e.g. while typing). */
export function useDebouncedValue(value, delay = 350) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
