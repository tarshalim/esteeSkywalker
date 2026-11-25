import { useMemo } from "react";
import { hashString } from "../../lib/tripPass";

/** Decorative barcode whose bars come from the trip id, so each pass looks different. */
export default function Barcode({ seed, className = "trip-pass-barcode" }) {
  const bars = useMemo(() => {
    let h = hashString(seed);
    return Array.from({ length: 34 }, () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
      return { width: 1 + (h % 3), gap: 1 + ((h >>> 4) % 2) };
    });
  }, [seed]);
  return (
    <div className={className} aria-hidden="true">
      {bars.map((bar, i) => (
        <span key={i} style={{ width: bar.width, marginRight: bar.gap }} />
      ))}
    </div>
  );
}
