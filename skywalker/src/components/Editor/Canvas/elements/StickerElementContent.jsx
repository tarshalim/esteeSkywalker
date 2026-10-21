import { findSticker, findEmoji } from "../../../../data/stickers";
import { artFilter, findArt } from "../../../../data/scrapbookArt";

export default function StickerElementContent({ element }) {
  const shadow = element.dropShadow ? "drop-shadow(0 6px 10px rgba(0,0,0,0.35))" : "none";

  if (element.category === "art") {
    const art = findArt(element.stickerId);
    if (!art) return null;
    return (
      <img
        src={art.src}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        className="h-full w-full select-none object-contain"
        style={{ filter: artFilter(element, element.dropShadow ? shadow : "") }}
      />
    );
  }

  if (element.category === "emoji") {
    const emoji = findEmoji(element.stickerId);
    return (
      <div
        className="w-full h-full flex items-center justify-center select-none"
        style={{ fontSize: "min(100cqw, 100cqh)", filter: shadow, lineHeight: 1 }}
      >
        <span style={{ fontSize: Math.min(element.width, element.height) * 0.75 }}>{emoji?.char || element.char}</span>
      </div>
    );
  }

  const sticker = findSticker(element.stickerId);
  if (!sticker) return null;
  return (
    <div className="w-full h-full text-slate-800" style={{ filter: shadow }}>
      {sticker.render({ className: "w-full h-full" })}
    </div>
  );
}
