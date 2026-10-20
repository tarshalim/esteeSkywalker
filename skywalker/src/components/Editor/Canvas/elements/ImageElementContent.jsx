import MediaFill, { MediaPlaceholder } from "./MediaFill";

export default function ImageElementContent({ element, editable, onPickMedia }) {
  return (
    <div className="w-full h-full overflow-hidden shadow-md" style={{ borderRadius: element.radius }}>
      {element.src ? (
        <MediaFill src={element.src} type="image" fit={element.fit} editable={editable} />
      ) : (
        <MediaPlaceholder
          label="Choose an image"
          onPick={editable ? () => onPickMedia?.(element.id, "image/*", (url) => ({ src: url })) : undefined}
        />
      )}
    </div>
  );
}
