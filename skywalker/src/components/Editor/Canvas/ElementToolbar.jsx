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
  GripVertical,
  Highlighter,
  ImagePlus,
  Italic,
  LayoutGrid,
  Maximize2,
  Minus,
  Music2,
  PaintBucket,
  Palette,
  Plus,
  RefreshCw,
  Scissors,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  Type,
  X,
} from "lucide-react";
import FloatingPanel from "./FloatingPanel";
import CollageLayoutPanel from "./CollageLayoutPanel";
import CollageBackgroundPanel from "./CollageBackgroundPanel";
import {
  ACCENT_COLORS,
  ELEMENT_KIND,
  FONT_WEIGHTS,
  HIGHLIGHT_COLORS,
  INK_COLORS,
  PASTELS,
  createCollageTextElement,
  hasText,
  mediaPatch,
} from "../../../lib/canvasElements";
import { DEFAULT_BACKGROUND, backgroundCss, photosUploadedPatch } from "../../../lib/collage";
import { CANVAS_FONTS, findFont } from "../../../lib/canvasFonts";
import { canTrimVideo } from "../../../lib/media";
import TrimFields from "../TrimFields";
import { ART_TONES, artFilter, findArt } from "../../../data/scrapbookArt";

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

/** Tone presets (each previewed on the art itself) plus a hue slider for art stickers. */
function ArtRecolorPanel({ element, update }) {
  const art = findArt(element.stickerId);
  if (!art) return null;
  const hue = element.hue ?? 0;
  return (
    <div className="flex w-[264px] flex-col gap-2">
      <div className="grid grid-cols-6 gap-1">
        {ART_TONES.map((t) => {
          const active = (element.tone ?? "original") === t.id;
          return (
            <button
              key={t.id}
              type="button"
              title={t.label}
              aria-label={`${t.label} tone`}
              aria-pressed={active}
              className={`flex flex-col items-center gap-0.5 rounded-lg p-0.5 text-[9px] ${active ? "bg-blue-500/30 text-white" : "text-slate-400 hover:bg-slate-800"}`}
              onClick={() => update({ tone: t.id })}
            >
              <img src={art.src} alt="" className="h-8 w-8 object-contain" style={{ filter: artFilter({ tone: t.id, hue }) }} />
              {t.label}
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-[11px] text-slate-300">
        Hue
        <input
          type="range"
          min={0}
          max={359}
          value={hue}
          onChange={(e) => update({ hue: Number(e.target.value) }, "hue")}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[linear-gradient(90deg,red,yellow,lime,cyan,blue,magenta,red)]"
          aria-label="Hue shift"
        />
        <button type="button" className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => update({ hue: 0, tone: "original" })}>
          Reset
        </button>
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
export default function ElementToolbar({ element, editing, actions, onPickMedia, onRequestSource, onOpenElements, elementsOpen }) {
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
      <Btn key="replace" label="Change video" onClick={() => update({ url: "", startSec: null, endSec: null })}>
        <RefreshCw size={16} />
      </Btn>
    );
    if (canTrimVideo(element.url)) {
      kindControls.push(
        <Btn key="trim" label="Start & end time" active={panel === "trim"} onClick={() => toggle("trim")}>
          <Timer size={16} />
        </Btn>
      );
    }
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
  if (kind === ELEMENT_KIND.COLLAGE) {
    kindControls.push(
      <button
        key="photos"
        type="button"
        title="Add photos (fills open slots first, then adds rows)"
        className="sb-tool flex !w-auto shrink-0 items-center gap-1 rounded-lg bg-blue-500/25 px-2 text-[13px] font-medium text-white hover:bg-blue-500/45"
        onClick={() => onPickMedia(element.id, "image/*", photosUploadedPatch, { multiple: true })}
      >
        <Plus size={15} /> Add photos
      </button>,
      <Btn key="layout" label="Layout & templates" active={panel === "layout"} onClick={() => toggle("layout")}>
        <LayoutGrid size={16} />
      </Btn>,
      <Btn key="arrange" label={editing ? "Done arranging" : "Arrange photos (drag to reorder, add captions)"} active={editing} onClick={() => actions.edit(editing ? null : element.id)}>
        <GripVertical size={16} />
      </Btn>,
      <Divider key="d-overlay" />,
      <Btn key="text" label="Add text" onClick={() => actions.addElement(createCollageTextElement(element), { edit: true })}>
        <Type size={16} />
      </Btn>,
      <Btn key="background" label="Background color" active={panel === "background"} onClick={() => toggle("background")}>
        <PaintBucket size={16} />
        <span
          className="-ml-1 mt-3 h-2 w-2 shrink-0 rounded-full border border-white/50"
          style={{ background: backgroundCss(element.collage?.background ?? DEFAULT_BACKGROUND) }}
          aria-hidden="true"
        />
      </Btn>,
      <Btn key="elements" label="Scrapbook elements (drag onto the collage)" active={elementsOpen} onClick={() => onOpenElements?.(element.id)}>
        <Sparkles size={16} />
      </Btn>
    );
  }
  if (kind === ELEMENT_KIND.STICKER && element.category === "art") {
    kindControls.push(
      <Btn key="recolor" label="Recolor" active={panel === "recolor"} onClick={() => toggle("recolor")}>
        <Palette size={16} />
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
            {kind === ELEMENT_KIND.TEXT && (
              <Btn label="Highlight pill" active={panel === "highlight" || Boolean(element.highlight)} onClick={() => toggle("highlight")}>
                <Highlighter size={16} />
              </Btn>
            )}
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
            <div className="mb-2 flex flex-wrap gap-1" role="radiogroup" aria-label="Font weight">
              {FONT_WEIGHTS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  role="radio"
                  aria-checked={(element.fontWeight ?? 400) === w.value}
                  className={`rounded-md px-2 py-1 text-[12px] ${(element.fontWeight ?? 400) === w.value ? "bg-blue-500/40 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                  style={{ fontFamily: findFont(element.fontFamily).family, fontWeight: w.value }}
                  onClick={() => update({ fontWeight: w.value })}
                >
                  {w.label}
                </button>
              ))}
            </div>
          )}
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
          {panel === "highlight" && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={`h-7 shrink-0 rounded-full border-2 px-2 text-[11px] ${element.highlight ? "border-slate-600 text-slate-300 hover:bg-slate-800" : "border-white text-white"}`}
                onClick={() => update({ highlight: null })}
              >
                None
              </button>
              <Swatches colors={HIGHLIGHT_COLORS} value={element.highlight} onPick={(c) => update({ highlight: c }, "highlight")} />
            </div>
          )}
          {panel === "layout" && <CollageLayoutPanel element={element} actions={actions} />}
          {panel === "background" && <CollageBackgroundPanel element={element} actions={actions} />}
          {panel === "recolor" && <ArtRecolorPanel element={element} update={update} />}
          {panel === "trim" && (
            <div className="w-[264px]">
              <TrimFields
                key={`${element.id}:${element.url}`}
                dark
                value={{ startSec: element.startSec ?? null, endSec: element.endSec ?? null, loop: element.loop ?? true }}
                onChange={(trim) => update(trim, "trim")}
                hint="Optional: play only part of the clip, e.g. 0:45 to 2:15."
              />
            </div>
          )}
        </div>
      )}
    </FloatingPanel>
  );
}
