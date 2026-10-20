import { useEffect, useState } from "react";

/**
 * Measures TopNav's real rendered height instead of hardcoding a guess: the
 * fixed navbar's height varies with breakpoint (collapsed vs. expanded), so a
 * guessed padding-top either leaves a gap above the content or lets the
 * navbar clip its top edge.
 * @param {number} fallback - used before TopNav has mounted/measured.
 */
export function useNavbarHeight(fallback = 56) {
  const [navbarHeight, setNavbarHeight] = useState(fallback);

  useEffect(() => {
    const navEl = document.getElementById("top-nav");
    if (!navEl) return;
    const observer = new ResizeObserver(([entry]) => setNavbarHeight(entry.contentRect.height));
    observer.observe(navEl);
    return () => observer.disconnect();
  }, []);

  return navbarHeight;
}
