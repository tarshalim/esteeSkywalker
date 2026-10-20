import { pointsToPathD, endAngleDeg } from "../../../lib/journeyLine";
import { TOOL } from "./canvasReducer";

function EndCap({ marker, point, angle, color }) {
  if (marker === "none") return null;
  if (marker === "dot") return <circle cx={point.x} cy={point.y} r={5} fill={color} />;
  if (marker === "pin") {
    return (
      <g transform={`translate(${point.x} ${point.y})`}>
        <path
          d="M0 -14c-5 0-9 4-9 9 0 6 9 15 9 15s9-9 9-15c0-5-4-9-9-9z"
          fill={color}
        />
        <circle cx="0" cy="-5" r="2.5" fill="white" />
      </g>
    );
  }
  // airplane — rotated to point along the final travel direction
  return (
    <g transform={`translate(${point.x} ${point.y}) rotate(${angle})`}>
      <path d="M-10 0l18-5-4 5 4 5z" fill={color} />
    </g>
  );
}

export default function JourneyLineLayer({ journeyLines, drawingLine, activeTool, selectedId, onSelect }) {
  const isDrawing = activeTool === TOOL.JOURNEY;

  return (
    <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ pointerEvents: "none" }}>
      {journeyLines.map((line) => {
        const d = pointsToPathD(line.points, line.curved);
        const last = line.points[line.points.length - 1];
        const angle = endAngleDeg(line.points);
        const selected = selectedId === line.id;
        return (
          <g key={line.id}>
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(16, line.strokeWidth + 12)}
              style={{ pointerEvents: isDrawing ? "none" : "stroke", cursor: "pointer" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelect(line.id);
              }}
            />
            <path
              d={d}
              fill="none"
              stroke={line.stroke}
              strokeWidth={line.strokeWidth}
              strokeDasharray={line.dashArray}
              strokeLinecap="round"
              className={line.animated ? "journey-line-animated" : ""}
              style={{ pointerEvents: "none" }}
            />
            {selected && (
              <path
                d={d}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={line.strokeWidth + 4}
                strokeOpacity={0.25}
                style={{ pointerEvents: "none" }}
              />
            )}
            <EndCap marker={line.endCap} point={last} angle={angle} color={line.stroke} />
          </g>
        );
      })}

      {isDrawing && drawingLine && drawingLine.length > 0 && (
        <g style={{ pointerEvents: "none" }}>
          <path d={pointsToPathD(drawingLine, false)} fill="none" stroke="#0f172a" strokeWidth={2} strokeDasharray="4,4" />
          {drawingLine.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4} fill="#0ea5e9" stroke="white" strokeWidth={1.5} />
          ))}
        </g>
      )}
    </svg>
  );
}
