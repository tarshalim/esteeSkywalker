// Stand-in "photos" for collage template previews: tiny generated landscapes,
// so the gallery shows what a filled collage looks like without shipping images.

// [sky top, sky bottom, sun, far hills, near hills]
const SCENES = [
  ["#fdba74", "#fde68a", "#fff7ed", "#ea580c", "#9a3412"], // sunset
  ["#7dd3fc", "#e0f2fe", "#fef9c3", "#86efac", "#16a34a"], // meadow
  ["#a5b4fc", "#fbcfe8", "#ffffff", "#818cf8", "#4338ca"], // dusk
  ["#5eead4", "#ccfbf1", "#fef08a", "#2dd4bf", "#0f766e"], // lagoon
  ["#fda4af", "#ffe4e6", "#fff1f2", "#fb7185", "#be123c"], // blossom
  ["#cbd5e1", "#f8fafc", "#fde047", "#94a3b8", "#475569"], // peaks
];

// Varied width / height ratios so masonry previews read as masonry.
export const PLACEHOLDER_ASPECTS = [1.5, 0.75, 1.2, 0.8, 1.4, 1];

const cache = new Map();

export function placeholderPhoto(i) {
  const key = i % (SCENES.length * 3);
  if (!cache.has(key)) {
    const [top, bottom, sun, far, near] = SCENES[key % SCENES.length];
    const sunX = 28 + ((key * 23) % 64);
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120' preserveAspectRatio='xMidYMid slice'>` +
      `<defs><linearGradient id='s' x2='0' y2='1'><stop offset='0' stop-color='${top}'/><stop offset='1' stop-color='${bottom}'/></linearGradient></defs>` +
      `<rect width='120' height='120' fill='url(#s)'/>` +
      `<circle cx='${sunX}' cy='40' r='12' fill='${sun}'/>` +
      `<path d='M0 84 L30 56 L58 78 L86 48 L120 80 V120 H0Z' fill='${far}' opacity='.6'/>` +
      `<path d='M0 100 Q30 82 60 96 T120 90 V120 H0Z' fill='${near}'/>` +
      `</svg>`;
    cache.set(key, `data:image/svg+xml,${encodeURIComponent(svg)}`);
  }
  return cache.get(key);
}
