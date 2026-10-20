import { useRef } from "react";
import { useMotionValueEvent } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STEPS = 1000;
const NUDGE = 0.01;

// Small visually, but the ::after pad keeps a ~40px touch target.
const ARROW =
  "relative flex size-7 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-slate-900 transition after:absolute after:-inset-1.5 hover:bg-yellow-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200";

/**
 * Bottom HUD: ← / → jump between stops, the slider scrubs the ride, the label shows % travelled.
 * The slider and label are written straight to the DOM from the motion value, so following
 * the ride costs no React renders.
 */
export default function TrailControls({ progress, scrollProgress, stops, onSeek }) {
  const rangeRef = useRef(null);
  const labelRef = useRef(null);
  const scrubbing = useRef(false);

  useMotionValueEvent(progress, "change", (p) => {
    if (labelRef.current) labelRef.current.textContent = `${Math.round(p * 100)}%`;
    if (rangeRef.current && !scrubbing.current) rangeRef.current.value = String(Math.round(p * STEPS));
  });

  const step = (dir) => {
    const current = scrollProgress.get();
    const target =
      dir > 0
        ? stops.find((s) => s.progress > current + NUDGE)?.progress ?? 1
        : stops.findLast((s) => s.progress < current - NUDGE)?.progress ?? 0;
    onSeek(target, true);
  };

  return (
    <div data-tour="journey-controls" className="absolute inset-x-4 bottom-2 z-40 mx-auto flex max-w-xs items-center gap-1.5 rounded-full bg-slate-900/75 p-1 sm:bottom-3">
      <button type="button" className={ARROW} onClick={() => step(-1)} aria-label="Previous stop">
        <ChevronLeft className="size-4" strokeWidth={3} />
      </button>

      <div className="relative flex h-6 min-w-0 flex-1 items-center">
        {/* Stop ticks under the slider track */}
        <div aria-hidden className="pointer-events-none absolute inset-x-1.5 top-1/2 -translate-y-1/2">
          {stops.map((s) => (
            <span
              key={s.id}
              className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70"
              style={{ left: `${s.progress * 100}%` }}
            />
          ))}
        </div>
        <input
          ref={rangeRef}
          type="range"
          min={0}
          max={STEPS}
          defaultValue={0}
          aria-label="Ride progress"
          className="relative h-6 w-full cursor-pointer accent-yellow-400"
          onPointerDown={() => (scrubbing.current = true)}
          onPointerUp={() => (scrubbing.current = false)}
          onPointerCancel={() => (scrubbing.current = false)}
          onInput={(e) => onSeek(Number(e.currentTarget.value) / STEPS, false)}
        />
      </div>

      <span ref={labelRef} className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums text-white" aria-hidden>
        0%
      </span>

      <button type="button" className={ARROW} onClick={() => step(1)} aria-label="Next stop">
        <ChevronRight className="size-4" strokeWidth={3} />
      </button>
    </div>
  );
}
