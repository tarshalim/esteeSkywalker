import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, MousePointerClick, Palette, Redo2, Sparkles, Undo2, X } from "lucide-react";
import { useCanvas } from "./CanvasProvider";
import CanvasElement from "./CanvasElement";
import ElementToolbar from "./ElementToolbar";
import AddMenu from "./AddMenu";
import PaperPicker from "./PaperPicker";
import AudioSourceModal from "./AudioSourceModal";
import CollageTemplatePicker from "./CollageTemplatePicker";
import LibraryGrid from "./LibraryGrid";
import { CONTENT_BY_KIND } from "./elementRegistry";
import { clientToCanvasPoint, useFitZoom } from "./useFitZoom";
import {
  DEFAULT_THEME,
  canvasHeight,
  createCollageElement,
  createImageElement,
  createSectionElement,
  createTextElement,
  createVideoElement,
  dockPatch,
  fileMediaType,
  hasEditMode,
  placeOn,
} from "../../../lib/canvasElements";
import { sectionWidth } from "../../../lib/canvasSections";
import { photosUploadedPatch } from "../../../lib/collage";
import { dockTargetAt, followLive, hostAt, layerPosition, paintOrder, slotTargetAt } from "../../../lib/canvasGroups";
import ElementContextMenu from "./ElementContextMenu";
import { layerDirectionForKey } from "./layerActions";
import { DECORATION_LIBRARY, LIBRARY_DRAG_TYPE, findLibraryItem } from "../../../lib/scrapbookLibrary";
import { paperBackground } from "../../../lib/paperStyles";
import { fileToUrl } from "../../../lib/files";
import { errorMessage } from "../../../lib/errors";
import { extractPhotoMetadata, isVideoFile } from "../../../lib/exif";
import { metaFromExtraction, withMediaMeta } from "../../../lib/mediaMeta";
import MediaMetaBadge from "./MediaMetaBadge";

/** An upload's date/place/camera as element `mediaMeta` (minus `src`), or null when it isn't a photo or clip. */
async function readFileMeta(file) {
  const type = fileMediaType(file) ?? (isVideoFile(file) ? "video" : null);
  if (!type) return null;
  try {
    return metaFromExtraction(await extractPhotoMetadata(file), type);
  } catch (err) {
    console.warn("Couldn't read media metadata", err);
    return null;
  }
}

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const STAMP_JITTER = 60; // px spread so pieces tapped onto the same collage don't stack exactly

const isLibraryDrag = (e) => [...(e.dataTransfer?.types ?? [])].includes(LIBRARY_DRAG_TYPE);
const isFileDrag = (e) => [...(e.dataTransfer?.types ?? [])].includes("Files");
/** Media type of the first file being dragged in (browsers expose types, not files, until the drop). */
const draggedFileType = (e) => fileMediaType([...(e.dataTransfer?.items ?? [])].find((item) => item.kind === "file"));
const DOCK_HINT = "Drop to place inside";

/**
 * Free-form scrapbook editor surface. There is no static toolbar: clicking
 * empty paper opens an add-menu at that spot, selecting an element floats a
 * toolbar above it, and page-level controls (paper, undo/redo) live in a
 * small dock pinned to the bottom of the viewport.
 */
export default function ScrapbookCanvas({ onError, onMediaMetadata }) {
  const { doc, ui, canUndo, canRedo, actions } = useCanvas();
  const frameRef = useRef(null);
  const pageRef = useRef(null);
  const fileInputRef = useRef(null);
  const pendingPickRef = useRef(null);
  const zoom = useFitZoom(frameRef, doc.size.width);
  const [menu, setMenu] = useState(null); // { clientPoint, point } while the add-menu is open
  const [interacting, setInteracting] = useState(false);
  const [dock, setDock] = useState(null); // "paper" | "elements": the panel open above the bottom dock
  const [elementsTargetId, setElementsTargetId] = useState(null); // collage the elements drawer was opened from
  const [dropHostId, setDropHostId] = useState(null); // host under a library piece being dragged
  const [dockHint, setDockHint] = useState(null); // { id, label }: element whose empty slot a drag or file drop would fill
  const [liveDrag, setLiveDrag] = useState(null); // { id, patch } while a host with overlays is being transformed
  const [audioTargetId, setAudioTargetId] = useState(null);
  const [collagePoint, setCollagePoint] = useState(null); // canvas point a new collage goes, while its template gallery is open
  const [uploads, setUploads] = useState(0);
  const [contextMenu, setContextMenu] = useState(null); // { id, clientPoint } while an element's right-click menu is open
  // { id, panel, n }: the media badge asked the toolbar to open its metadata panel.
  const [panelRequest, setPanelRequest] = useState(null);
  // A request only applies while that element stays selected.
  useEffect(() => setPanelRequest((r) => (r && r.id !== ui.selectedId ? null : r)), [ui.selectedId]);
  const selectedExists = doc.elements.some((el) => el.id === ui.selectedId);
  useEffect(() => setContextMenu((m) => (m && (m.id !== ui.selectedId || !selectedExists) ? null : m)), [ui.selectedId, selectedExists]);
  const openMetadata = (id) => {
    actions.select(id);
    setPanelRequest((r) => ({ id, panel: "meta", n: (r?.n ?? 0) + 1 }));
  };

  const pageHeight = canvasHeight(doc);
  const paper = doc.theme?.paper ?? DEFAULT_THEME.paper;
  const sorted = paintOrder(doc.elements);
  const byId = new Map(doc.elements.map((el) => [el.id, el]));
  const parentIds = new Set(doc.elements.map((el) => el.attachedTo).filter(Boolean));
  const selected = doc.elements.find((el) => el.id === ui.selectedId) ?? null;
  const layers = selected ? layerPosition(doc.elements, selected.id) : null;
  // The menu belongs to the selected element; it goes away if that changes (undo, delete, click elsewhere).
  const menuOpen = contextMenu && contextMenu.id === selected?.id;
  const audioTarget = doc.elements.find((el) => el.id === audioTargetId) ?? null;
  const toCanvasPoint = (cx, cy) => clientToCanvasPoint(pageRef.current, zoom, cx, cy);

  // One hidden <input type=file> serves every "add/replace media" button.
  // `toPatch(url, file)` builds the update for a single pick; with `multiple`
  // it is `toPatch([{ url, file }, …])` instead. Either may be async.
  const pickMedia = (elementId, accept, toPatch, { multiple = false } = {}) => {
    pendingPickRef.current = { elementId, toPatch, multiple };
    const input = fileInputRef.current;
    input.accept = accept;
    input.multiple = multiple;
    input.value = "";
    input.click();
  };

  /**
   * Uploads files while reading their EXIF / video metadata, then applies one
   * patch with every success; whichever media slot it fills carries that
   * file's metadata (lib/mediaMeta.js). The first file that knows where or
   * when it was taken is also handed to the editor to fill the post's details.
   */
  const uploadFiles = async (elementId, files, toPatch) => {
    if (files.length === 0) return;
    setUploads((n) => n + 1);
    try {
      const [settled, metas] = await Promise.all([
        Promise.allSettled(files.map((file) => fileToUrl(file))),
        Promise.all(files.map(readFileMeta)),
      ]);
      const done = [];
      const metaByUrl = new Map();
      settled.forEach((r, i) => {
        if (r.status === "fulfilled") {
          done.push({ url: r.value, file: files[i] });
          if (metas[i]) metaByUrl.set(r.value, metas[i]);
        } else {
          console.error(r.reason);
          onError?.(`Couldn't upload ${files[i].name}: ${errorMessage(r.reason)}`);
        }
      });
      if (!done.length) return;
      actions.updateElement(elementId, withMediaMeta(await toPatch(done), metaByUrl));
      const telling = [...metaByUrl.values()].find((m) => m.lat != null || m.dateSource === "exif");
      if (telling) onMediaMetadata?.(telling);
    } catch (err) {
      console.error(err);
      onError?.(`Couldn't add ${files.length > 1 ? "those files" : files[0].name}: ${errorMessage(err)}`);
    } finally {
      setUploads((n) => n - 1);
    }
  };

  const handleFile = (e) => {
    const files = [...(e.target.files ?? [])];
    const pick = pendingPickRef.current;
    pendingPickRef.current = null;
    if (!files.length || !pick) return;
    if (pick.multiple) return uploadFiles(pick.elementId, files, pick.toPatch);
    const [file] = files;
    return uploadFiles(pick.elementId, [file], ([{ url }]) => pick.toPatch(url, file));
  };

  /** Centres a new element on the spot the add-menu was opened from. */
  const place = (element, opts, point = menu.point) => {
    element.x = Math.round(Math.min(Math.max(point.x - element.width / 2, 0), doc.size.width - element.width));
    element.y = Math.round(Math.max(point.y - element.height / 2, 0));
    setMenu(null);
    return actions.addElement(element, opts);
  };

  /** Creates a text box, image or video and hands it to `put(element, opts)`, which adds it and returns its id. */
  const addBasic = (kind, put) => {
    if (kind === "text") put(createTextElement(), { edit: true });
    else if (kind === "video") put(createVideoElement());
    else if (kind === "image") {
      // No `capture` attribute: phones then offer Take Photo / Photo Library / Browse natively.
      const id = put(createImageElement());
      pickMedia(id, "image/*", (url) => ({ src: url }));
    }
  };

  const handleQuickAdd = (kind) => {
    if (kind === "collage") {
      // Template first: the gallery places the collage once a layout is chosen.
      setCollagePoint(menu.point);
      setMenu(null);
    } else if (kind === "section") {
      // Full width across the page, its top edge at the click.
      const section = createSectionElement({ width: sectionWidth("full", doc.size.width) });
      section.x = Math.round((doc.size.width - section.width) / 2);
      section.y = Math.round(Math.max(menu.point.y - 24, 0));
      setMenu(null);
      actions.addSection(section);
    } else addBasic(kind, place);
  };

  /**
   * "Add text / photo / video" on a selected host: into a section box's flow,
   * or laid on top of any other scrapbook piece and attached to it. With `src`
   * (a gallery pick) the photo or clip comes ready-filled instead of asking for a file.
   */
  const addInside = (hostId, kind, src) => {
    const host = byId.get(hostId);
    if (!host) return;
    const put =
      host.kind === "section"
        ? (element, opts) => actions.addToSection(hostId, element, opts)
        : (element, opts) => actions.addElement(placeOn(host, element), opts);
    if (src) put(kind === "video" ? createVideoElement({ url: src }) : createImageElement({ src }));
    else addBasic(kind, put);
  };

  /**
   * Photos/clips dropped from the computer: the first fills the empty slot it
   * lands on (polaroid, frame, note…), the rest become new elements at the
   * drop point, which attach to whatever piece they land on.
   */
  const dropFiles = (files, point) => {
    const media = files.filter(fileMediaType);
    if (!media.length) {
      onError?.("Only photos and videos can be dropped onto the page.");
      return;
    }
    const host = slotTargetAt(doc.elements, point, fileMediaType(media[0]));
    if (host) {
      const [file] = media;
      // Re-checked against the latest host once the upload lands.
      uploadFiles(host.id, [file], ([{ url }]) => (cur) => dockPatch(cur, { type: fileMediaType(file), src: url }) ?? {});
    }
    media.slice(host ? 1 : 0).forEach((file, i) => {
      const video = fileMediaType(file) === "video";
      const id = place(video ? createVideoElement() : createImageElement(), undefined, { x: point.x + i * 24, y: point.y + i * 24 });
      uploadFiles(id, [file], ([{ url }]) => (video ? { url } : { src: url }));
    });
  };

  /** Page point at the middle of the part of the page that's on screen. */
  const visibleCenter = () => {
    const r = pageRef.current.getBoundingClientRect();
    const x = (Math.max(r.left, 0) + Math.min(r.right, window.innerWidth)) / 2;
    const y = (Math.max(r.top, 0) + Math.min(r.bottom, window.innerHeight)) / 2;
    return toCanvasPoint(x, y);
  };

  /** Tapped in the drawer: lands on the collage it was opened from (or mid-screen), then attaches. */
  const stampLibraryItem = (item) => {
    const host = byId.get(elementsTargetId);
    const jitter = () => (Math.random() - 0.5) * STAMP_JITTER;
    const point = host ? { x: host.x + host.width / 2 + jitter(), y: host.y + host.height / 2 + jitter() } : visibleCenter();
    place(item.create(), undefined, point);
  };

  const openElements = (collageId = null) => {
    setMenu(null);
    setElementsTargetId(collageId);
    setDock((d) => (d === "elements" && collageId === elementsTargetId ? null : "elements"));
  };

  const dropProps = {
    onDragOver: (e) => {
      if (isFileDrag(e)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        const type = draggedFileType(e);
        const host = type && slotTargetAt(doc.elements, toCanvasPoint(e.clientX, e.clientY), type);
        setDockHint(host ? { id: host.id, label: DOCK_HINT } : null);
        return;
      }
      if (!isLibraryDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDropHostId(hostAt(doc.elements, toCanvasPoint(e.clientX, e.clientY))?.id ?? null);
    },
    onDragLeave: (e) => {
      if (e.currentTarget.contains(e.relatedTarget)) return;
      setDropHostId(null);
      setDockHint(null);
    },
    onDrop: (e) => {
      if (isFileDrag(e)) {
        e.preventDefault();
        setDockHint(null);
        dropFiles([...e.dataTransfer.files], toCanvasPoint(e.clientX, e.clientY));
        return;
      }
      if (!isLibraryDrag(e)) return;
      e.preventDefault();
      setDropHostId(null);
      const item = findLibraryItem(e.dataTransfer.getData(LIBRARY_DRAG_TYPE));
      if (item) place(item.create(), undefined, toCanvasPoint(e.clientX, e.clientY));
    },
  };

  const addCollage = (templateId, { addPhotos }) => {
    const id = place(createCollageElement({}, { template: templateId }), undefined, collagePoint);
    setCollagePoint(null);
    if (addPhotos) pickMedia(id, "image/*", photosUploadedPatch, { multiple: true });
  };

  const handlePageClick = (e) => {
    if (e.target !== pageRef.current) return;
    if (ui.selectedId) {
      actions.select(null);
      return;
    }
    setDock((d) => (d === "paper" ? null : d));
    setMenu({ clientPoint: { x: e.clientX, y: e.clientY }, point: toCanvasPoint(e.clientX, e.clientY) });
  };

  /** Right-click on an element selects it and opens the arrange menu; text being typed keeps the browser's own menu. */
  const handleContextMenu = (e) => {
    const id = e.target.closest?.("[data-element-id]")?.dataset.elementId;
    if (!id || !byId.has(id) || ui.editingId === id) return;
    e.preventDefault();
    setMenu(null);
    if (ui.selectedId !== id) actions.select(id);
    setContextMenu({ id, clientPoint: { x: e.clientX, y: e.clientY } });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (menuOpen) return; // the menu handles its own keys (and Escape closes it)
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
      const layerMove = layerDirectionForKey(e);
      if (layerMove) {
        e.preventDefault(); // Cmd+[ / ] is browser back/forward on macOS
        actions.reorderLayer(el.id, layerMove);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // While rearranging a collage, a stray Backspace shouldn't wipe out the whole thing.
        if (ui.editingId === el.id) return;
        e.preventDefault();
        actions.deleteElement(el.id);
      } else if (mod && key === "d") {
        e.preventDefault();
        actions.duplicateElement(el.id);
      } else if (e.key === "Enter" && hasEditMode(el)) {
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
  }, [ui, doc, actions, menuOpen]);

  return (
    <div ref={frameRef} className="w-full">
      <div className="relative mx-auto" style={{ width: doc.size.width * zoom, height: pageHeight * zoom }}>
        <div
          ref={pageRef}
          className="absolute left-0 top-0 isolate origin-top-left rounded-[4px] shadow-[0_18px_50px_rgba(15,23,42,0.18),0_2px_6px_rgba(15,23,42,0.08)]"
          style={{ width: doc.size.width, height: pageHeight, transform: `scale(${zoom})`, cursor: "cell", ...paperBackground(paper) }}
          onClick={handlePageClick}
          onContextMenu={handleContextMenu}
          {...dropProps}
        >
          {sorted.map((element, index) => {
            const Content = CONTENT_BY_KIND[element.kind];
            if (!Content) return null;
            const editing = ui.editingId === element.id;
            return (
              <CanvasElement
                key={element.id}
                element={element}
                layer={index + 1}
                follow={followLive(element, byId, liveDrag)}
                onLive={parentIds.has(element.id) ? (patch) => setLiveDrag(patch ? { id: element.id, patch } : null) : undefined}
                dropTarget={dockHint?.id === element.id ? dockHint.label : dropHostId === element.id}
                findDock={(view) => dockTargetAt(doc.elements, view)}
                onDockHover={(id) => setDockHint(id ? { id, label: DOCK_HINT } : null)}
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
                  onUploadFiles={uploadFiles}
                  onRequestSource={setAudioTargetId}
                />
                {!editing && <MediaMetaBadge element={element} zoom={zoom} onOpen={() => openMetadata(element.id)} />}
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
              <p className="max-w-md text-xl font-medium">Click anywhere on the page to add text, photos, videos or scrapbook pieces.</p>
              <p className="text-sm opacity-80">Drag to move · corner handle to resize · top handle to rotate · tap a text twice to write · drop photos or clips from your computer</p>
            </div>
          )}
        </div>
      </div>

      {selected && !interacting && !menuOpen && (
        <ElementToolbar
          key={selected.id}
          element={selected}
          editing={ui.editingId === selected.id}
          actions={actions}
          pageWidth={doc.size.width}
          onPickMedia={pickMedia}
          onRequestSource={setAudioTargetId}
          onOpenElements={openElements}
          onAddInside={addInside}
          elementsOpen={dock === "elements" && elementsTargetId === selected.id}
          layers={layers}
          openPanel={panelRequest?.id === selected.id ? panelRequest : null}
        />
      )}

      {menuOpen && (
        <ElementContextMenu
          clientPoint={contextMenu.clientPoint}
          element={selected}
          layers={layers}
          actions={actions}
          onClose={() => setContextMenu(null)}
        />
      )}

      {menu && <AddMenu clientPoint={menu.clientPoint} onAdd={handleQuickAdd} onAddElement={(el) => place(el)} onClose={() => setMenu(null)} />}

      {collagePoint && <CollageTemplatePicker onPick={addCollage} onClose={() => setCollagePoint(null)} />}

      <input ref={fileInputRef} type="file" hidden onChange={handleFile} />

      {createPortal(
        <div className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center">
          {dock === "paper" && (
            <div className="mb-2 max-h-[min(60vh,520px)] w-[min(372px,calc(100vw-16px))] overflow-y-auto overscroll-contain rounded-2xl border border-slate-700/80 bg-slate-900/95 p-3 text-slate-100 shadow-2xl backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold">Page paper</span>
                <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => setDock(null)} aria-label="Close">
                  <X size={15} />
                </button>
              </div>
              <PaperPicker paper={paper} onChange={actions.setPaper} />
            </div>
          )}
          {dock === "elements" && (
            <div
              role="dialog"
              aria-label="Scrapbook elements"
              className="mb-2 w-[min(400px,calc(100vw-16px))] rounded-2xl border border-slate-700/80 bg-slate-900/95 p-2 text-slate-100 shadow-2xl backdrop-blur-md"
            >
              <div className="mb-1 flex items-start justify-between gap-2 px-1">
                <div>
                  <span className="text-[13px] font-semibold">Scrapbook elements</span>
                  <p className="text-[11px] text-slate-400">
                    Drag onto {byId.get(elementsTargetId)?.kind === "section" ? "your section box" : byId.has(elementsTargetId) ? "your collage" : "the page"}, or tap
                    to stamp it in the middle. Pieces on a collage or section box move with it.
                  </p>
                </div>
                <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => setDock(null)} aria-label="Close">
                  <X size={15} />
                </button>
              </div>
              <LibraryGrid sections={DECORATION_LIBRARY} onPick={stampLibraryItem} maxHeight="min(42vh,360px)" />
            </div>
          )}
          <div className="flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-900/90 p-1 text-slate-200 shadow-xl backdrop-blur-md">
            <button
              type="button"
              className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ${dock === "paper" ? "bg-blue-500/30 text-white" : "hover:bg-slate-700"}`}
              onClick={() => {
                setMenu(null);
                setDock((d) => (d === "paper" ? null : "paper"));
              }}
              aria-expanded={dock === "paper"}
              data-tour="editor-paper"
            >
              <Palette size={16} /> Paper
            </button>
            <button
              type="button"
              className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ${dock === "elements" ? "bg-blue-500/30 text-white" : "hover:bg-slate-700"}`}
              onClick={() => openElements(selected?.kind === "collage" || selected?.kind === "section" ? selected.id : null)}
              aria-expanded={dock === "elements"}
              aria-label="Scrapbook elements"
              title="Scrapbook elements: drag stickers, tape and stamps onto the page"
            >
              <Sparkles size={16} /> <span className="hidden sm:inline">Elements</span>
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
