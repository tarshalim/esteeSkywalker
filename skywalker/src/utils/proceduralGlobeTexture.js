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

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Scrapbook palette (0-1 RGB). Oceans run tropical turquoise at the equator
// to clear azure toward the poles; land grades between sun-warmed gold and
// soft meadow green depending on how green the photo was there.
const IDYLLIC = {
  oceanEquator: [0.16, 0.8, 0.86],
  oceanPolar: [0.2, 0.6, 0.92],
  landGold: [0.95, 0.83, 0.55],
  landGreen: [0.6, 0.83, 0.5],
  snow: [0.97, 0.98, 1],
};

const idyllicTextures = new Map();

/**
 * Re-grades the photographic day texture into a bright, idyllic palette
 * using the water mask (white = water) to split land from sea: oceans become
 * vibrant turquoise/azure while keeping the photo's seabed/shelf detail, and
 * land becomes pastel green/gold while keeping its terrain shading. Resolves
 * to a blob URL, cached per url pair. Rejects if either image fails to load.
 */
export function createIdyllicTexture(dayUrl, waterMaskUrl) {
  const cacheKey = `${dayUrl}|${waterMaskUrl}`;
  if (!idyllicTextures.has(cacheKey)) {
    const promise = Promise.all([loadImage(dayUrl), loadImage(waterMaskUrl)]).then(
      ([day, mask]) =>
        new Promise((resolve) => {
          const width = day.naturalWidth;
          const height = day.naturalHeight;
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });

          // Upscale the (smaller) mask to the day texture; the smoothing
          // doubles as a soft coastline blend.
          ctx.drawImage(mask, 0, 0, width, height);
          const maskData = ctx.getImageData(0, 0, width, height).data;
          ctx.drawImage(day, 0, 0);
          const image = ctx.getImageData(0, 0, width, height);
          const px = image.data;

          const { oceanEquator, oceanPolar, landGold, landGreen, snow } = IDYLLIC;
          for (let y = 0; y < height; y++) {
            const polar = smoothstep(0.1, 0.75, Math.abs(y / height - 0.5) * 2);
            const oR = oceanEquator[0] + (oceanPolar[0] - oceanEquator[0]) * polar;
            const oG = oceanEquator[1] + (oceanPolar[1] - oceanEquator[1]) * polar;
            const oB = oceanEquator[2] + (oceanPolar[2] - oceanEquator[2]) * polar;
            for (let x = 0; x < width; x++) {
              const i = (y * width + x) * 4;
              const r = px[i] / 255;
              const g = px[i + 1] / 255;
              const b = px[i + 2] / 255;
              const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
              // Grey river lines in the mask stay land; only real water flips.
              const water = smoothstep(0.4, 0.7, maskData[i] / 255);

              // Ocean: flat idyllic colour, brightened where the photo shows
              // shallows (the blue-marble ocean is ~0.1 luminance; shelves higher).
              const shallow = clamp01((lum - 0.08) * 4);
              const sea0 = clamp01(oR + shallow * 0.35);
              const sea1 = clamp01(oG + shallow * 0.2);
              const sea2 = clamp01(oB + shallow * 0.08);

              // Land: lift the photo, then pull it toward a pastel target
              // picked by its greenness, keeping relative terrain shading.
              const greenness = clamp01((g - (r + b) / 2) * 6 + 0.35);
              const iceT = smoothstep(0.62, 0.85, lum);
              const shade = 0.72 + lum * 0.7;
              let l0 = (landGold[0] + (landGreen[0] - landGold[0]) * greenness) * shade;
              let l1 = (landGold[1] + (landGreen[1] - landGold[1]) * greenness) * shade;
              let l2 = (landGold[2] + (landGreen[2] - landGold[2]) * greenness) * shade;
              l0 = clamp01((l0 * 0.7 + (r * 1.3 + 0.08) * 0.3) * (1 - iceT) + snow[0] * iceT);
              l1 = clamp01((l1 * 0.7 + (g * 1.3 + 0.08) * 0.3) * (1 - iceT) + snow[1] * iceT);
              l2 = clamp01((l2 * 0.7 + (b * 1.3 + 0.08) * 0.3) * (1 - iceT) + snow[2] * iceT);

              px[i] = (l0 + (sea0 - l0) * water) * 255;
              px[i + 1] = (l1 + (sea1 - l1) * water) * 255;
              px[i + 2] = (l2 + (sea2 - l2) * water) * 255;
            }
          }
          ctx.putImageData(image, 0, 0);
          canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : dayUrl), "image/jpeg", 0.92);
        })
    );
    // Don't cache failures, so a later mount can retry.
    promise.catch(() => idyllicTextures.delete(cacheKey));
    idyllicTextures.set(cacheKey, promise);
  }
  return idyllicTextures.get(cacheKey);
}

const enhancedTextures = new Map();

/**
 * Loads an image and re-encodes it through a CSS `filter` (e.g.
 * "saturate(1.6) brightness(1.3)") so photographic textures read vivid on
 * the globe. Resolves to a blob URL, cached per url+filter so theme toggles
 * and remounts don't redo the 4K canvas pass. Rejects if the image fails to
 * load; resolves to the original url where canvas filters are unsupported.
 */
export function enhanceTexture(url, filter) {
  const cacheKey = `${url}|${filter}`;
  if (!enhancedTextures.has(cacheKey)) {
    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!("filter" in ctx)) return resolve(url);
        ctx.filter = filter;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : url), "image/jpeg", 0.92);
      };
      img.onerror = reject;
      img.src = url;
    });
    // Don't cache failures, so a later mount can retry.
    promise.catch(() => enhancedTextures.delete(cacheKey));
    enhancedTextures.set(cacheKey, promise);
  }
  return enhancedTextures.get(cacheKey);
}
