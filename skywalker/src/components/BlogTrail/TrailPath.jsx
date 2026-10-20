import { TRAIL } from "./trailLayout";

/** Grass verge plus the dirt trail the rider follows; spans the full world width. */
export default function TrailPath() {
  return (
    <>
      <div
        className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-[#8cc152] to-[#5f9a35] shadow-[0_-6px_18px_rgba(0,0,0,0.12)]"
        style={{ height: `${TRAIL.bottomPct + TRAIL.heightPct + 3}%` }}
      />
      <div
        className="absolute inset-x-0 overflow-hidden border-y-4 border-[#a8834d]/60 bg-gradient-to-b from-[#e6c890] to-[#c9a165]"
        style={{ bottom: `${TRAIL.bottomPct}%`, height: `${TRAIL.heightPct}%` }}
      >
        {/* Worn tyre tracks */}
        <div className="absolute inset-x-0 top-[38%] border-t-[3px] border-dashed border-[#9c7642]/45" />
        <div className="absolute inset-x-0 top-[66%] border-t-[3px] border-dashed border-[#9c7642]/30" />
      </div>
    </>
  );
}
