// Curated typefaces for canvas text. The families are loaded from Google
// Fonts in index.html; elements store the short `id`, never the CSS stack, so
// the stacks can change without migrating saved posts.

export const CANVAS_FONTS = [
  { id: "hand", label: "Caveat", group: "Handwritten", family: "'Caveat', cursive" },
  { id: "marker", label: "Patrick Hand", group: "Handwritten", family: "'Patrick Hand', cursive" },
  { id: "script", label: "Dancing Script", group: "Script", family: "'Dancing Script', cursive" },
  { id: "serif", label: "Playfair Display", group: "Editorial serif", family: "'Playfair Display', Georgia, serif" },
  { id: "display", label: "Cinzel", group: "Bold title", family: "'Cinzel', 'Times New Roman', serif" },
  { id: "sans", label: "Plus Jakarta Sans", group: "Clean modern", family: "'Plus Jakarta Sans', Inter, system-ui, sans-serif" },
  { id: "mono", label: "Courier Prime", group: "Typewriter", family: "'Courier Prime', 'Courier New', monospace" },
];

export function findFont(id) {
  return CANVAS_FONTS.find((f) => f.id === id) ?? CANVAS_FONTS.find((f) => f.id === "sans");
}

/** Inline typography for any element carrying the DEFAULT_TEXT_STYLE fields. */
export function textStyle(element) {
  return {
    fontFamily: findFont(element.fontFamily).family,
    fontSize: element.fontSize,
    color: element.color,
    textAlign: element.align,
    fontWeight: element.fontWeight,
    fontStyle: element.fontStyle,
    lineHeight: 1.35,
  };
}
