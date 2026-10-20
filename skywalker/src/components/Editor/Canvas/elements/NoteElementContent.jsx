import EditableText from "./EditableText";
import MediaFill from "./MediaFill";

// Deterministic jagged edge (top + bottom) for the torn lined strip, in % so
// it scales with the element.
const TORN_CLIP = (() => {
  const teeth = 30;
  const jitter = (i, salt) => ((i * 37 + salt) % 11) / 11;
  const top = [];
  const bottom = [];
  for (let i = 0; i <= teeth; i += 1) {
    const x = ((i / teeth) * 100).toFixed(2);
    top.push(`${x}% ${(jitter(i, 3) * 6).toFixed(2)}%`);
    bottom.unshift(`${x}% ${(100 - jitter(i, 7) * 6).toFixed(2)}%`);
  }
  return `polygon(${[...top, ...bottom].join(", ")})`;
})();

const STAR_POINTS = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 50 : 23;
  const a = (Math.PI / 5) * i - Math.PI / 2;
  return `${(50 + r * Math.cos(a)).toFixed(2)},${(53 + r * Math.sin(a)).toFixed(2)}`;
}).join(" ");

const HEART_PATH = "M50 88C20 66 0 46 0 26 0 10 12 0 26 0 38 0 46 8 50 16 54 8 62 0 74 0 88 0 100 10 100 26 100 46 80 66 50 88Z";

// Where the writeable/media area sits inside each paper shape.
const CONTENT_INSET = {
  sticky: { top: "16%", left: "11%", right: "11%", bottom: "10%" },
  heart: { top: "18%", left: "21%", right: "21%", bottom: "32%" },
  star: { top: "37%", left: "31%", right: "31%", bottom: "27%" },
  lined: { top: "13%", left: "15%", right: "6%", bottom: "12%" },
  spiral: { top: "44px", left: "10%", right: "8%", bottom: "7%" },
};

function Paper({ element }) {
  const fill = element.paperColor;
  const shadow = "drop-shadow(0 6px 8px rgba(15,23,42,0.18))";
  switch (element.variant) {
    case "heart":
      return (
        <svg viewBox="0 0 100 90" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ filter: shadow }}>
          <path d={HEART_PATH} fill={fill} />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ filter: shadow }}>
          <polygon points={STAR_POINTS} fill={fill} strokeLinejoin="round" />
        </svg>
      );
    case "lined":
      return (
        <div className="absolute inset-0" style={{ filter: shadow }}>
          <div className="sb-lined absolute inset-0" style={{ backgroundColor: fill, clipPath: TORN_CLIP }} />
        </div>
      );
    case "spiral":
      return (
        <div className="absolute inset-0" style={{ filter: shadow }}>
          <div className="sb-lined sb-lined--nomargin absolute inset-0 top-[14px] rounded-b-sm" style={{ backgroundColor: fill }} />
          <div className="sb-spiral absolute inset-x-[4%] top-0 h-[30px]" />
        </div>
      );
    default:
      return <div className="sb-sticky absolute inset-0" style={{ backgroundColor: fill, filter: shadow }} />;
  }
}

/** Sticky notes & memos: writeable paper containers that can also hold a small photo or clip. */
export default function NoteElementContent({ element, editable, editing, actions }) {
  return (
    <div className="relative w-full h-full">
      <Paper element={element} />
      {element.tape && <div className="sb-washi sb-washi--stripe absolute left-1/2 -top-3 h-7 w-[46%] -translate-x-1/2 -rotate-3" style={{ "--tint": element.tapeColor }} />}
      <div className="absolute flex flex-col gap-1.5" style={CONTENT_INSET[element.variant] ?? CONTENT_INSET.sticky}>
        {element.mediaSrc && (
          <div className="relative min-h-0 overflow-hidden rounded-sm bg-black/5 shadow-sm" style={{ flex: "0 0 55%" }}>
            <MediaFill src={element.mediaSrc} type={element.mediaType} editable={editable} />
          </div>
        )}
        <EditableText element={element} editing={editing} actions={actions} placeholder="Jot a note…" className="min-h-0 flex-1 overflow-hidden" />
      </div>
    </div>
  );
}
