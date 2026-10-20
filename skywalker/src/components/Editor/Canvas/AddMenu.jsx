import { useMemo, useState } from "react";
import { ChevronLeft, Clapperboard, ImagePlus, Sparkles, Type } from "lucide-react";
import FloatingPanel from "./FloatingPanel";
import { CONTENT_BY_KIND } from "./elementRegistry";
import { SCRAPBOOK_LIBRARY } from "../../../lib/scrapbookLibrary";

const PREVIEW = 58;

function Preview({ element }) {
  const Content = CONTENT_BY_KIND[element.kind];
  const scale = Math.min(PREVIEW / element.width, PREVIEW / element.height) * 0.9;
  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-[#f6f2ea]" style={{ width: PREVIEW, height: PREVIEW }}>
      <div
        className="pointer-events-none shrink-0"
        style={{ width: element.width, height: element.height, transform: `scale(${scale}) rotate(${element.rotation}deg)` }}
        aria-hidden="true"
        inert
      >
        <Content element={element} editable={false} />
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { id: "text", label: "Text box", icon: Type },
  { id: "image", label: "Image", icon: ImagePlus },
  { id: "video", label: "Video", icon: Clapperboard },
  { id: "scrapbook", label: "Scrapbook element", icon: Sparkles },
];

/**
 * Menu that pops up wherever the empty page is clicked. `onAdd(kind)` handles
 * the quick actions; `onAddElement(element)` places a library item.
 */
export default function AddMenu({ clientPoint, onAdd, onAddElement, onClose }) {
  const [view, setView] = useState("main");
  // Build previews once per open; factories mint ids, so don't redo per render.
  const library = useMemo(
    () => SCRAPBOOK_LIBRARY.map((section) => ({ ...section, items: section.items.map((item) => ({ ...item, preview: item.create() })) })),
    []
  );

  return (
    <FloatingPanel anchor={{ point: clientPoint }} onDismiss={onClose} label="Add to page" className={view === "main" ? "w-[248px] p-2" : "w-[340px] p-2"}>
      {view === "main" ? (
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_ACTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl bg-slate-800/80 px-2 py-2.5 text-[12px] font-medium text-slate-200 transition hover:bg-blue-500/25 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
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
          <div className="max-h-[min(60vh,440px)] overflow-y-auto overscroll-contain px-1 pb-1">
            {library.map((section) => (
              <section key={section.id} className="mt-2">
                <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{section.label}</h4>
                <div className="grid grid-cols-4 gap-1.5">
                  {section.items.map((item) => (
                    // Not a <button>: previews render real element content, which contains buttons of its own.
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      title={item.label}
                      aria-label={item.label}
                      className="flex cursor-pointer flex-col items-center gap-1 rounded-xl p-1 text-[10px] leading-tight text-slate-300 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
                      onClick={() => onAddElement(item.create())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onAddElement(item.create());
                        }
                      }}
                    >
                      <Preview element={item.preview} />
                      <span className="line-clamp-2 text-center">{item.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </FloatingPanel>
  );
}
