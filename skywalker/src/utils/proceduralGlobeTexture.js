// Deterministic, dependency-free equirectangular texture in the app's
// yellow/blue identity. Used both as the decorative hero globe's actual
// surface and as an unconditional fallback if a photo-realistic texture
// ever fails to load, so the globe can never render black.
const LANDMASSES = [
  { x: 0.16, y: 0.3, rx: 0.08, ry: 0.13 },
  { x: 0.22, y: 0.54, rx: 0.055, ry: 0.15 },
  { x: 0.47, y: 0.26, rx: 0.065, ry: 0.09 },
  { x: 0.52, y: 0.48, rx: 0.06, ry: 0.13 },
  { x: 0.57, y: 0.66, rx: 0.045, ry: 0.07 },
  { x: 0.71, y: 0.28, rx: 0.09, ry: 0.11 },
  { x: 0.79, y: 0.6, rx: 0.055, ry: 0.065 },
  { x: 0.91, y: 0.73, rx: 0.045, ry: 0.055 },
  { x: 0.05, y: 0.68, rx: 0.04, ry: 0.05 },
];

export function createYellowBlueGlobeCanvas({
  width = 1024,
  height = 512,
  oceanTop = "#60a5fa",
  oceanMid = "#3b82f6",
  oceanBottom = "#1e40af",
  land = "#fde047",
  landAlt = "#facc15",
} = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const oceanGradient = ctx.createLinearGradient(0, 0, 0, height);
  oceanGradient.addColorStop(0, oceanTop);
  oceanGradient.addColorStop(0.5, oceanMid);
  oceanGradient.addColorStop(1, oceanBottom);
  ctx.fillStyle = oceanGradient;
  ctx.fillRect(0, 0, width, height);

  LANDMASSES.forEach((blob, i) => {
    ctx.fillStyle = i % 2 === 0 ? land : landAlt;
    // draw at true position plus both seam-wrapped copies so the texture
    // tiles seamlessly at the antimeridian
    [-width, 0, width].forEach((offsetX) => {
      ctx.beginPath();
      ctx.ellipse(blob.x * width + offsetX, blob.y * height, blob.rx * width, blob.ry * height, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  return canvas;
}

// Land-free ocean surface for the light-mode cartographic globe: the country
// polygon layer draws every landmass on top, so the texture only needs water.
export function createCartographicOceanDataUrl({ width = 1024, height = 512 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#7dd3fc");
  gradient.addColorStop(0.5, "#38bdf8");
  gradient.addColorStop(1, "#7dd3fc");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // faint lat/lng grid, like a printed atlas
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 12; i++) {
    const x = (i / 12) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let i = 1; i < 6; i++) {
    const y = (i / 6) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  return canvas.toDataURL("image/png");
}

export function createYellowBlueGlobeDataUrl(options) {
  return createYellowBlueGlobeCanvas(options).toDataURL("image/png");
}
