import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, MousePointerClick, Palette, Redo2, Undo2, X } from "lucide-react";
import { useCanvas } from "./CanvasProvider";
import CanvasElement from "./CanvasElement";
import ElementToolbar from "./ElementToolbar";
import AddMenu from "./AddMenu";
import PaperPicker from "./PaperPicker";
import AudioSourceModal from "./AudioSourceModal";
import { CONTENT_BY_KIND } from "./elementRegistry";
import { clientToCanvasPoint, useFitZoom } from "./useFitZoom";
import {
  DEFAULT_THEME,
  canvasHeight,
  createImageElement,
  createTextElement,
  createVideoElement,
  hasText,
} from "../../../lib/canvasElements";
import { paperBackground } from "../../../lib/paperStyles";
import { fileToUrl } from "../../../lib/files";

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/**
 * Free-form scrapbook editor surface. There is no static toolbar: clicking
 * empty paper opens an add-menu at that spot, selecting an element floats a
 * toolbar above it, and page-level controls (paper, undo/redo) live in a
 * small dock pinned to the bottom of the viewport.
 */
export default function ScrapbookCanvas({ onError }) {
  const { doc, ui, canUndo, canRedo, actions } = useCanvas();
  const frameRef = useRef(null);
  const pageRef = useRef(null);
  const fileInputRef = useRef(null);
  const pendingPickRef = useRef(null);
  const zoom = useFitZoom(frameRef, doc.size.width);
  const [menu, setMenu] = useState(null); // { clientPoint, point } while the add-menu is open
  const [interacting, setInteracting] = useState(false);
  const [paperOpen, setPaperOpen] = useState(false);
  const [audioTargetId, setAudioTargetId] = useState(null);
  const [uploads, setUploads] = useState(0);

  const pageHeight = canvasHeight(doc);
  const paper = doc.theme?.paper ?? DEFAULT_THEME.paper;
  const sorted = [...doc.elements].sort((a, b) => a.zIndex - b.zIndex);
  const selected = doc.elements.find((el) => el.id === ui.selectedId) ?? null;
  const audioTarget = doc.elements.find((el) => el.id === audioTargetId) ?? null;
  const toCanvasPoint = (cx, cy) => clientToCanvasPoint(pageRef.current, zoom, cx, cy);

  // One hidden <input type=file> serves every "add/replace media" button.
  const pickMedia = (elementId, accept, toPatch) => {
    pendingPickRef.current = { elementId, toPatch };
    const input = fileInputRef.current;
    input.accept = accept;
    input.value = "";
    input.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    const pick = pendingPickRef.current;
    pendingPickRef.current = null;
    if (!file || !pick) return;
    setUploads((n) => n + 1);
    try {
      const url = await fileToUrl(file);
      actions.updateElement(pick.elementId, pick.toPatch(url, file));
    } catch (err) {
      console.error(err);
      onError?.(`Couldn't upload ${file.name}: ${err.message}`);
    } finally {
      setUploads((n) => n - 1);
    }
  };

  /** Centres a new element on the spot the add-menu was opened from. */
  const place = (element, opts) => {
    const { point } = menu;
    element.x = Math.round(Math.min(Math.max(point.x - element.width / 2, 0), doc.size.width - element.width));
    element.y = Math.round(Math.max(point.y - element.height / 2, 0));
    setMenu(null);
    return actions.addElement(element, opts);
  };

  const handleQuickAdd = (kind) => {
    if (kind === "text") place(createTextElement(), { edit: true });
    else if (kind === "video") place(createVideoElement());
    else if (kind === "image") {
      const id = place(createImageElement());
      pickMedia(id, "image/*", (url) => ({ src: url }));
    }
  };

  const handlePageClick = (e) => {
    if (e.target !== pageRef.current) return;
    if (ui.selectedId) {
      actions.select(null);
      return;
    }
    setPaperOpen(false);
    setMenu({ clientPoint: { x: e.clientX, y: e.clientY }, point: toCanvasPoint(e.clientX, e.clientY) });
  };

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.key === "Escape") {
        if (ui.editingId) {
          actions.edit(null);
          document.activeElement?.blur();
        } else if (ui.selectedId) actions.select(null);
        return;
      }
      if (typing) return;
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) actions.redo();
        else actions.undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        actions.redo();
        return;
      }

      const el = doc.elements.find((x) => x.id === ui.selectedId);
      if (!el) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        actions.deleteElement(el.id);
      } else if (mod && key === "d") {
        e.preventDefault();
        actions.duplicateElement(el.id);
      } else if (e.key === "Enter" && hasText(el)) {
        e.preventDefault();
        actions.edit(el.id);
      } else if (ARROWS[e.key]) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = ARROWS[e.key];
        actions.updateElement(el.id, { x: el.x + dx * step, y: el.y + dy * step }, { coalesce: "nudge" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ui, doc, actions]);

  return (
    <div ref={frameRef} className="w-full">
      <div className="relative mx-auto" style={{ width: doc.size.width * zoom, height: pageHeight * zoom }}>
        <div
          ref={pageRef}
          className="absolute left-0 top-0 isolate origin-top-left rounded-[4px] shadow-[0_18px_50px_rgba(15,23,42,0.18),0_2px_6px_rgba(15,23,42,0.08)]"
          style={{ width: doc.size.width, height: pageHeight, transform: `scale(${zoom})`, cursor: "cell", ...paperBackground(paper) }}
          onClick={handlePageClick}
        >
          {sorted.map((element) => {
            const Content = CONTENT_BY_KIND[element.kind];
            if (!Content) return null;
            const editing = ui.editingId === element.id;
            return (
              <CanvasElement
                key={element.id}
                element={element}
                selected={ui.selectedId === element.id}
                editing={editing}
                zoom={zoom}
                pageWidth={doc.size.width}
                toCanvasPoint={toCanvasPoint}
                actions={actions}
                onInteract={setInteracting}
              >
                <Content
                  element={element}
                  editable
                  editing={editing}
                  actions={actions}
                  zoom={zoom}
                  onPickMedia={pickMedia}
                  onRequestSource={setAudioTargetId}
                />
              </CanvasElement>
            );
          })}

          {menu && (
            <span
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-blue-500/60"
              style={{ left: menu.point.x, top: menu.point.y }}
            />
          )}

          {doc.elements.length === 0 && !menu && (
            <div className="pointer-events-none absolute inset-x-0 top-40 flex flex-col items-center gap-3 px-10 text-center text-slate-500">
              <MousePointerClick size={36} strokeWidth={1.5} />
              <p className="max-w-sm text-lg font-medium">Click anywhere on the page to add text, photos, videos or scrapbook pieces.</p>
              <p className="text-sm opacity-80">Drag to move · corner handle to resize · top handle to rotate · tap a text twice to write</p>
            </div>
          )}
        </div>
      </div>

      {selected && !interacting && (
        <ElementToolbar
          key={selected.id}
          element={selected}
          editing={ui.editingId === selected.id}
          actions={actions}
          onPickMedia={pickMedia}
          onRequestSource={setAudioTargetId}
        />
      )}

      {menu && <AddMenu clientPoint={menu.clientPoint} onAdd={handleQuickAdd} onAddElement={(el) => place(el)} onClose={() => setMenu(null)} />}

      <input ref={fileInputRef} type="file" hidden onChange={handleFile} />

      {createPortal(
        <div className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center">
          {paperOpen && (
            <div className="mb-2 max-h-[min(60vh,520px)] w-[min(372px,calc(100vw-16px))] overflow-y-auto overscroll-contain rounded-2xl border border-slate-700/80 bg-slate-900/95 p-3 text-slate-100 shadow-2xl backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold">Page paper</span>
                <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => setPaperOpen(false)} aria-label="Close">
                  <X size={15} />
                </button>
              </div>
              <PaperPicker paper={paper} onChange={actions.setPaper} />
            </div>
          )}
          <div className="flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-900/90 p-1 text-slate-200 shadow-xl backdrop-blur-md">
            <button
              type="button"
              className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ${paperOpen ? "bg-blue-500/30 text-white" : "hover:bg-slate-700"}`}
              onClick={() => {
                setMenu(null);
                setPaperOpen((o) => !o);
              }}
              aria-expanded={paperOpen}
            >
              <Palette size={16} /> Paper
            </button>
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-700 disabled:opacity-35" onClick={actions.undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
              <Undo2 size={16} />
            </button>
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-700 disabled:opacity-35" onClick={actions.redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
              <Redo2 size={16} />
            </button>
            {uploads > 0 ? (
              <span className="flex items-center gap-1.5 px-3 text-[12px] text-slate-300" role="status">
                <Loader2 size={14} className="animate-spin" /> Uploading…
              </span>
            ) : (
              <span className="hidden px-3 text-[12px] text-slate-400 sm:inline">Click the page to add</span>
            )}
          </div>
        </div>,
        document.body
      )}

      {audioTarget &&
        createPortal(
          <AudioSourceModal
            element={audioTarget}
            palette={doc.theme?.palette ?? DEFAULT_THEME.palette}
            onSave={(patch) => {
              actions.updateElement(audioTarget.id, patch);
              setAudioTargetId(null);
            }}
            onClose={() => setAudioTargetId(null)}
          />,
          document.body
        )}
    </div>
  );
}
