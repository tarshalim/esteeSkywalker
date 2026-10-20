import { useRef } from "react";
import { ImagePlus } from "lucide-react";
import { fileToUrl } from "../../../../lib/files";

export default function ImageElementContent({ element, editable, actions }) {
  const inputRef = useRef(null);

  const handlePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToUrl(file);
    actions.updateElement(element.id, { src: dataUrl });
  };

  return (
    <div
      className="w-full h-full overflow-hidden"
      style={{ borderRadius: element.radius }}
      onDoubleClick={() => editable && inputRef.current?.click()}
    >
      {editable && <input ref={inputRef} type="file" accept="image/*" hidden onChange={handlePick} />}
      {element.src ? (
        <img
          src={element.src}
          alt=""
          className="w-full h-full"
          style={{ objectFit: element.fit, borderRadius: element.radius }}
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400 border-2 border-dashed border-slate-300">
          <ImagePlus size={22} />
          <span className="text-xs">{editable ? "Double-click to choose an image" : "No image"}</span>
        </div>
      )}
    </div>
  );
}
