// Paper / background styles for the scrapbook canvas. Every texture is built
// from CSS gradients and an inline SVG noise tile, so there are no image
// assets to host and every style can be re-tinted with any base color.

function noise(opacity, frequency = 0.85, octaves = 3) {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='${octaves}' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 ${opacity} 0'/></filter>` +
    `<rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Each layer: [backgroundImage, backgroundSize]
const LAYERS = {
  clean: [],
  colored: [],
  canvas: [
    [noise(0.28, 0.75), "220px 220px"],
    ["repeating-linear-gradient(0deg, rgba(60,45,25,0.05) 0 1px, transparent 1px 3px)", "auto"],
    ["repeating-linear-gradient(90deg, rgba(60,45,25,0.05) 0 1px, transparent 1px 3px)", "auto"],
  ],
  linen: [
    ["repeating-linear-gradient(0deg, rgba(120,100,70,0.07) 0 1px, transparent 1px 4px)", "auto"],
    ["repeating-linear-gradient(90deg, rgba(120,100,70,0.06) 0 1px, transparent 1px 5px)", "auto"],
    [noise(0.14, 1.1, 2), "220px 220px"],
  ],
  recycled: [
    ["radial-gradient(circle, rgba(80,60,40,0.35) 0 1px, transparent 1.6px)", "37px 41px"],
    ["radial-gradient(circle, rgba(80,60,40,0.22) 0 1.4px, transparent 2px)", "83px 71px"],
    [noise(0.32, 0.6), "220px 220px"],
  ],
  lined: [
    ["linear-gradient(90deg, transparent 70px, rgba(239,68,68,0.5) 70px 72px, transparent 72px)", "auto"],
    ["repeating-linear-gradient(180deg, transparent 0 31px, rgba(59,130,246,0.3) 31px 32px)", "100% 32px"],
  ],
  dotted: [["radial-gradient(circle, rgba(15,23,42,0.28) 0 1.3px, transparent 1.8px)", "24px 24px"]],
  graph: [
    ["linear-gradient(rgba(59,130,246,0.28) 1px, transparent 1px)", "80px 80px"],
    ["linear-gradient(90deg, rgba(59,130,246,0.28) 1px, transparent 1px)", "80px 80px"],
    ["linear-gradient(rgba(59,130,246,0.13) 1px, transparent 1px)", "16px 16px"],
    ["linear-gradient(90deg, rgba(59,130,246,0.13) 1px, transparent 1px)", "16px 16px"],
  ],
  kraft: [
    [noise(0.45, 0.7), "220px 220px"],
    ["repeating-linear-gradient(35deg, rgba(90,60,30,0.05) 0 2px, transparent 2px 9px)", "auto"],
    ["radial-gradient(ellipse at center, transparent 60%, rgba(70,45,20,0.18) 100%)", "100% 100%"],
  ],
  parchment: [
    ["radial-gradient(ellipse at center, transparent 50%, rgba(130,85,30,0.3) 100%)", "100% 100%"],
    [noise(0.3, 0.55, 4), "220px 220px"],
  ],
};

export const PAPER_GROUPS = [
  { id: "clean", label: "Clean", styles: [{ id: "clean", label: "White", color: "#ffffff" }] },
  { id: "colored", label: "Colored", styles: [{ id: "colored", label: "Pastel", color: "#fde2e4" }] },
  {
    id: "textured",
    label: "Textured",
    styles: [
      { id: "canvas", label: "Canvas", color: "#f4f1ea" },
      { id: "linen", label: "Linen", color: "#f3efe6" },
      { id: "recycled", label: "Recycled", color: "#e7e2d4" },
    ],
  },
  {
    id: "exercise",
    label: "Exercise book",
    styles: [
      { id: "lined", label: "Lined", color: "#fffef8" },
      { id: "dotted", label: "Dot grid", color: "#fffefb" },
      { id: "graph", label: "Graph", color: "#f8fbff" },
    ],
  },
  {
    id: "scrapbook",
    label: "Scrapbook",
    styles: [
      { id: "kraft", label: "Kraft", color: "#c9a87c" },
      { id: "parchment", label: "Parchment", color: "#f1e3c3" },
    ],
  },
];

export const PAPER_SWATCHES = ["#ffffff", "#fde2e4", "#fef3c7", "#dcfce7", "#dbeafe", "#ede9fe", "#f4f1ea", "#c9a87c"];

export function findPaperStyle(styleId) {
  for (const group of PAPER_GROUPS) {
    const style = group.styles.find((s) => s.id === styleId);
    if (style) return style;
  }
  return PAPER_GROUPS[0].styles[0];
}

/** Inline style object for a paper `{ style, color }`. */
export function paperBackground(paper) {
  const style = paper?.style ?? "clean";
  const layers = LAYERS[style] ?? [];
  return {
    backgroundColor: paper?.color ?? findPaperStyle(style).color,
    backgroundImage: layers.length ? layers.map(([img]) => img).join(", ") : "none",
    backgroundSize: layers.length ? layers.map(([, size]) => size).join(", ") : undefined,
  };
}
