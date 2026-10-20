import { useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  ChevronDown,
  Copy,
  Droplet,
  ImagePlus,
  Italic,
  Maximize2,
  Minus,
  Music2,
  Plus,
  RefreshCw,
  Scissors,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import FloatingPanel from "./FloatingPanel";
import { ACCENT_COLORS, ELEMENT_KIND, INK_COLORS, PASTELS, hasText, mediaPatch } from "../../../lib/canvasElements";
import { CANVAS_FONTS, findFont } from "../../../lib/canvasFonts";

const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight };
const NEXT_ALIGN = { left: "center", center: "right", right: "left" };

function Btn({ label, onClick, active, danger, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`sb-tool flex shrink-0 items-center justify-center rounded-lg transition ${
        danger ? "text-rose-300 hover:bg-rose-500/20" : active ? "bg-blue-500/30 text-white" : "text-slate-300 hover:bg-slate-700 hover:text-white"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-slate-700" aria-hidden="true" />;

function Swatches({ colors, value, onPick }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Color ${c}`}
          className={`h-7 w-7 rounded-full border-2 ${value === c ? "border-white" : "border-slate-600"}`}
          style={{ background: c }}
          onClick={() => onPick(c)}
        />
      ))}
      <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-slate-500" title="Custom color">
        <span className="absolute inset-0 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] opacity-80" />
        <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={value?.length === 7 ? value : "#ffffff"} onChange={(e) => onPick(e.target.value)} />
      </label>
    </div>
  );
}

/** execCommand on the current text selection, if it lies inside this element. */
function applyToSelection(elementId, command) {
  const node = document.querySelector(`[data-element-id="${elementId}"] .sb-editable`);
  const sel = window.getSelection();
  if (!node || !sel || sel.isCollapsed || !node.contains(sel.anchorNode)) return false;
  document.execCommand(command);
  return true;
}

/**
 * Compact toolbar floating above the selected element. Text controls appear
 * for anything with writeable text; the middle group adapts to the kind.
 */
export default function ElementToolbar({ element, editing, actions, onPickMedia, onRequestSource }) {
  const [panel, setPanel] = useState(null);
  const update = (patch, coalesce) => actions.updateElement(element.id, patch, { coalesce });
  const toggle = (name) => setPanel((p) => (p === name ? null : name));
  const AlignIcon = ALIGN_ICONS[element.align] ?? AlignLeft;
  const bold = element.fontWeight >= 600;
  const italic = element.fontStyle === "italic";
  const { kind } = element;

  const kindControls = [];
  if (kind === ELEMENT_KIND.NOTE) {
    kindControls.push(
      <Btn key="paper" label="Note color" active={panel === "paper"} onClick={() => toggle("paper")}>
        <Droplet size={16} fill={element.paperColor} />
      </Btn>,
      <Btn key="media" label={element.mediaSrc ? "Replace photo/video" : "Add photo/video inside"} onClick={() => onPickMedia(element.id, "image/*,video/*", mediaPatch)}>
        <ImagePlus size={16} />
      </Btn>
    );
    if (element.mediaSrc) {
      kindControls.push(
        <Btn key="unmedia" label="Remove photo/video" onClick={() => update({ mediaSrc: "", mediaType: "" })}>
          <X size={16} />
        </Btn>
      );
    }
    if (element.variant === "sticky") {
      kindControls.push(
        <Btn key="tape" label="Washi tape" active={element.tape} onClick={() => update({ tape: !element.tape })}>
          <Scissors size={16} />
        </Btn>
      );
    }
  }
  if (kind === ELEMENT_KIND.POLAROID && element.mediaSrc) {
    kindControls.push(
      <Btn key="media" label="Replace photo/video" onClick={() => onPickMedia(element.id, "image/*,video/*", mediaPatch)}>
        <ImagePlus size={16} />
      </Btn>
    );
  }
  if (kind === ELEMENT_KIND.IMAGE) {
    kindControls.push(
      <Btn key="replace" label="Replace image" onClick={() => onPickMedia(element.id, "image/*", (url) => ({ src: url }))}>
        <RefreshCw size={16} />
      </Btn>,
      <Btn key="fit" label="Show whole image" active={element.fit === "contain"} onClick={() => update({ fit: element.fit === "contain" ? "cover" : "contain" })}>
        <Maximize2 size={16} />
      </Btn>
    );
  }
  if (kind === ELEMENT_KIND.FRAME_STICKER) {
    kindControls.push(
      <Btn key="replace" label="Replace photo" onClick={() => onPickMedia(element.id, "image/*", (url) => ({ imageSrc: url, imageOffsetX: 0, imageOffsetY: 0 }))}>
        <ImagePlus size={16} />
      </Btn>
    );
  }
  if ((kind === ELEMENT_KIND.VIDEO || kind === ELEMENT_KIND.VIEWFINDER) && element.url) {
    kindControls.push(
      <Btn key="replace" label="Change video" onClick={() => update({ url: "" })}>
        <RefreshCw size={16} />
      </Btn>
    );
  }
  if (kind === ELEMENT_KIND.AUDIO) {
    kindControls.push(
      <Btn key="track" label="Edit track" onClick={() => onRequestSource(element.id)}>
        <Music2 size={16} />
      </Btn>
    );
  }
  if (kind === ELEMENT_KIND.DECOR) {
    kindControls.push(
      <Btn key="tint" label="Color" active={panel === "tint"} onClick={() => toggle("tint")}>
        <Droplet size={16} fill={element.tint} />
      </Btn>
    );
  }
  if (kind === ELEMENT_KIND.STICKER) {
    kindControls.push(
      <Btn key="shadow" label="Drop shadow" active={element.dropShadow} onClick={() => update({ dropShadow: !element.dropShadow })}>
        <Sun size={16} />
      </Btn>
    );
  }

  return (
    <FloatingPanel anchor={{ elementId: element.id }} label="Element tools" className="p-1">
      <div className="flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
        {hasText(element) && (
          <>
            <button
              type="button"
              className={`sb-tool flex !w-auto max-w-[128px] shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] ${panel === "font" ? "bg-blue-500/30" : "hover:bg-slate-700"}`}
              style={{ fontFamily: findFont(element.fontFamily).family }}
              onClick={() => toggle("font")}
              aria-label="Font"
              aria-expanded={panel === "font"}
            >
              <span className="truncate">{findFont(element.fontFamily).label}</span>
              <ChevronDown size={13} className="shrink-0 opacity-60" />
            </button>
            <Btn label="Smaller text" onClick={() => update({ fontSize: Math.max(8, element.fontSize - 2) }, "size")}>
              <Minus size={15} />
            </Btn>
            <span className="w-7 shrink-0 text-center text-[12px] tabular-nums text-slate-300">{element.fontSize}</span>
            <Btn label="Larger text" onClick={() => update({ fontSize: Math.min(120, element.fontSize + 2) }, "size")}>
              <Plus size={15} />
            </Btn>
            <Btn label="Bold" active={bold} onClick={() => (editing && applyToSelection(element.id, "bold")) || update({ fontWeight: bold ? 400 : 700 })}>
              <Bold size={16} />
            </Btn>
            <Btn label="Italic" active={italic} onClick={() => (editing && applyToSelection(element.id, "italic")) || update({ fontStyle: italic ? "normal" : "italic" })}>
              <Italic size={16} />
            </Btn>
            <Btn label={`Align ${element.align}`} onClick={() => update({ align: NEXT_ALIGN[element.align] ?? "left" })}>
              <AlignIcon size={16} />
            </Btn>
            <Btn label="Text color" active={panel === "ink"} onClick={() => toggle("ink")}>
              <span className="h-4 w-4 rounded-full border border-white/40" style={{ background: element.color }} />
            </Btn>
          </>
        )}
        {kindControls.length > 0 && (
          <>
            {hasText(element) && <Divider />}
            {kindControls}
          </>
        )}
        <Divider />
        <Btn label="Bring forward" onClick={() => actions.reorderLayer(element.id, "up")}>
          <ArrowUp size={16} />
        </Btn>
        <Btn label="Send backward" onClick={() => actions.reorderLayer(element.id, "down")}>
          <ArrowDown size={16} />
        </Btn>
        <Btn label="Duplicate" onClick={() => actions.duplicateElement(element.id)}>
          <Copy size={15} />
        </Btn>
        <Btn label="Delete" danger onClick={() => actions.deleteElement(element.id)}>
          <Trash2 size={16} />
        </Btn>
      </div>

      {panel && (
        <div className="mt-1 border-t border-slate-700 px-1.5 pb-1 pt-2">
          {panel === "font" && (
            <div className="grid max-h-[40vh] grid-cols-1 gap-0.5 overflow-y-auto sm:grid-cols-2">
              {CANVAS_FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`flex flex-col items-start rounded-lg px-2.5 py-1.5 text-left ${element.fontFamily === f.id ? "bg-blue-500/30" : "hover:bg-slate-800"}`}
                  onClick={() => update({ fontFamily: f.id })}
                >
                  <span className="text-[17px] leading-tight" style={{ fontFamily: f.family }}>
                    {f.label}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">{f.group}</span>
                </button>
              ))}
            </div>
          )}
          {panel === "ink" && <Swatches colors={INK_COLORS} value={element.color} onPick={(c) => update({ color: c }, "ink")} />}
          {panel === "paper" && <Swatches colors={PASTELS} value={element.paperColor} onPick={(c) => update({ paperColor: c }, "paper")} />}
          {panel === "tint" && <Swatches colors={[...ACCENT_COLORS, ...PASTELS.slice(0, 4)]} value={element.tint} onPick={(c) => update({ tint: c }, "tint")} />}
        </div>
      )}
    </FloatingPanel>
  );
}
