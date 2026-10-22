import MediaFill, { VideoSourceInput } from "./MediaFill";

export default function VideoElementContent({ element, editable, actions, onPickMedia }) {
  if (!element.url) {
    if (!editable) return null;
    return (
      <div className="w-full h-full overflow-hidden rounded-xl">
        <VideoSourceInput
          onUrl={(url) => actions.updateElement(element.id, { url })}
          onUpload={() => onPickMedia?.(element.id, "video/*", (url) => ({ url }))}
          onDismiss={() => actions.deleteElement(element.id)}
        />
      </div>
    );
  }
  return (
    <div className="w-full h-full overflow-hidden rounded-xl bg-black shadow-md">
      <MediaFill src={element.url} type="video" editable={editable} trim={element} />
    </div>
  );
}
