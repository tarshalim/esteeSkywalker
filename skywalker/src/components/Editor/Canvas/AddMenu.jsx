import { useState } from "react";
import { Camera, ChevronLeft, Clapperboard, ImagePlus, LayoutGrid, Sparkles, Type } from "lucide-react";
import FloatingPanel from "./FloatingPanel";
import LibraryGrid from "./LibraryGrid";
import { SCRAPBOOK_LIBRARY } from "../../../lib/scrapbookLibrary";

const QUICK_ACTIONS = [
  { id: "text", label: "Text box", icon: Type },
  { id: "image", label: "Image", icon: ImagePlus },
  { id: "camera", label: "Take photo live", icon: Camera },
  { id: "video", label: "Video", icon: Clapperboard },
  { id: "collage", label: "Photo collage", icon: LayoutGrid },
  { id: "scrapbook", label: "Scrapbook element", icon: Sparkles },
];

/**
 * Menu that pops up wherever the empty page is clicked. `onAdd(kind)` handles
 * the quick actions; `onAddElement(element)` places a library item.
 */
export default function AddMenu({ clientPoint, onAdd, onAddElement, onClose }) {
  const [view, setView] = useState("main");

  return (
    <FloatingPanel anchor={{ point: clientPoint }} onDismiss={onClose} label="Add to page" className={view === "main" ? "w-[248px] p-2" : "w-[340px] p-2"}>
      {view === "main" ? (
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_ACTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="flex min-h-[64px] flex-col last:odd:col-span-2 items-center justify-center gap-1.5 rounded-xl bg-slate-800/80 px-2 py-2.5 text-[12px] font-medium text-slate-200 transition hover:bg-blue-500/25 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
              onClick={() => (id === "scrapbook" ? setView("library") : onAdd(id))}
            >
              <Icon size={18} className={id === "scrapbook" ? "text-amber-300" : "text-blue-300"} />
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div>
          <div className="mb-1 flex items-center gap-1 px-1">
            <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => setView("main")} aria-label="Back">
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px] font-semibold">Scrapbook elements</span>
          </div>
          <LibraryGrid sections={SCRAPBOOK_LIBRARY} onPick={(item) => onAddElement(item.create())} />
        </div>
      )}
    </FloatingPanel>
  );
}
