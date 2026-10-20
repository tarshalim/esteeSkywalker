import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { findFrame } from "../../../../data/stickers";
import { fileToUrl } from "../../../../lib/files";

export default function FrameStickerElementContent({ element, editable, actions, zoom }) {
  const frame = findFrame(element.frameId);
  const inputRef = useRef(null);
  const [live, setLive] = useState(null); // transient {offsetX, offsetY} while dragging the photo inside the mask
  const clipId = `frame-clip-${element.id}`;

  const offsetX = live?.offsetX ?? element.imageOffsetX;
  const offsetY = live?.offsetY ?? element.imageOffsetY;

  const handlePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToUrl(file);
    actions.updateElement(element.id, { imageSrc: dataUrl, imageOffsetX: 0, imageOffsetY: 0 });
  };

  const startDrag = (e) => {
    if (!editable || !element.imageSrc) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const onMove = (ev) => {
      setLive({
        offsetX: element.imageOffsetX + (ev.clientX - startX) / zoom,
        offsetY: element.imageOffsetY + (ev.clientY - startY) / zoom,
      });
    };
    const onUp = () => {
      setLive((cur) => {
        if (cur) actions.updateElement(element.id, { imageOffsetX: cur.offsetX, imageOffsetY: cur.offsetY });
        return null;
      });
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const [vbW, vbH] = frame.viewBox.split(" ").slice(2).map(Number);
  const scale = element.imageScale ?? 1;

  return (
    <div className="relative w-full h-full">
      {editable && <input ref={inputRef} type="file" accept="image/*" hidden onChange={handlePick} />}
      <svg viewBox={frame.viewBox} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={frame.clipPath} />
          </clipPath>
        </defs>
        {element.imageSrc ? (
          <image
            href={element.imageSrc}
            clipPath={`url(#${clipId})`}
            x={offsetX}
            y={offsetY}
            width={vbW * scale}
            height={vbH * scale}
            preserveAspectRatio="xMidYMid slice"
            style={{ cursor: editable ? "move" : "default" }}
            onPointerDown={startDrag}
          />
        ) : (
          <g clipPath={`url(#${clipId})`}>
            <rect x="0" y="0" width={vbW} height={vbH} fill="#e2e8f0" />
          </g>
        )}
        {frame.decoration?.({})}
      </svg>
      {!element.imageSrc && (
        <button
          type="button"
          className="absolute inset-6 flex flex-col items-center justify-center gap-1 text-slate-500 text-xs"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => editable && inputRef.current?.click()}
        >
          <ImagePlus size={20} />
          {editable ? "Click to add a photo" : ""}
        </button>
      )}
    </div>
  );
}
