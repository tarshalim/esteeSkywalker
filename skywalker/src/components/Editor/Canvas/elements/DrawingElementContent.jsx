export default function DrawingElementContent({ element }) {
  if (!element.src) return null;
  return (
    <img
      src={element.src}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      className="h-full w-full select-none object-contain"
      style={{ filter: element.dropShadow ? "drop-shadow(0 6px 10px rgba(0,0,0,0.35))" : undefined }}
    />
  );
}
