// Path-building helpers for the Journey Line ("dotted travel route") tool.

let counter = 0;
export function makeLineId() {
  counter += 1;
  return `jl_${Date.now().toString(36)}_${counter}`;
}

export function createJourneyLine(points, overrides = {}) {
  return {
    id: makeLineId(),
    points,
    curved: false,
    stroke: "#0f172a",
    strokeWidth: 3,
    dashArray: "6,6",
    endCap: "dot",
    animated: false,
    ...overrides,
  };
}

/** Straight polyline "d" attribute. */
function straightPathD(points) {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
}

/** Smooth curve through all points via Catmull-Rom → cubic Bezier conversion. */
function curvedPathD(points) {
  if (points.length < 3) return straightPathD(points);
  const d = [`M${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`);
  }
  return d.join(" ");
}

export function pointsToPathD(points, curved) {
  if (points.length < 2) return "";
  return curved ? curvedPathD(points) : straightPathD(points);
}

/** Angle (degrees) of the final segment, for orienting an end-cap marker like an airplane. */
export function endAngleDeg(points) {
  if (points.length < 2) return 0;
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

export function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i += 1) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}
