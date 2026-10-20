import { createContext, useContext, useMemo, useReducer } from "react";
import { canvasReducer, createInitialState, TOOL } from "./canvasReducer";
import { canUndo as computeCanUndo, canRedo as computeCanRedo } from "../../../lib/canvasHistory";
import {
  createTextElement,
  createImageElement,
  createVideoElement,
  createStickerElement,
  createFrameStickerElement,
  createAudioElement,
  nextZIndex,
} from "../../../lib/canvasElements";
import { createJourneyLine } from "../../../lib/journeyLine";

const CanvasContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useCanvas() {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error("useCanvas must be used inside a CanvasProvider");
  return ctx;
}

export function CanvasProvider({ initialDoc, children }) {
  const [state, dispatch] = useReducer(canvasReducer, initialDoc, createInitialState);
  const doc = state.history.present;
  const { ui } = state;

  const commit = (nextDoc) => dispatch({ type: "COMMIT", doc: nextDoc });

  const actions = useMemo(
    () => ({
      loadDoc: (nextDoc) => dispatch({ type: "LOAD_DOC", doc: nextDoc }),
      undo: () => dispatch({ type: "UNDO" }),
      redo: () => dispatch({ type: "REDO" }),
      select: (id) => dispatch({ type: "SELECT", id }),
      setTool: (tool) => dispatch({ type: "SET_TOOL", tool }),
      armSticker: (sticker) => dispatch({ type: "ARM_STICKER", sticker }),
      cancelTool: () => dispatch({ type: "CANCEL_TOOL" }),
      setZoom: (zoom) => dispatch({ type: "SET_ZOOM", zoom }),
      setPan: (pan) => dispatch({ type: "SET_PAN", pan }),
      toggleDrawer: (open) => dispatch({ type: "TOGGLE_DRAWER", open }),
      setDrawerTab: (tab) => dispatch({ type: "SET_DRAWER_TAB", tab }),
      toggleThemePanel: (open) => dispatch({ type: "TOGGLE_THEME_PANEL", open }),
      toggleSizePanel: (open) => dispatch({ type: "TOGGLE_SIZE_PANEL", open }),

      addElement(element) {
        const withZ = { ...element, zIndex: nextZIndex(doc.elements) };
        commit({ ...doc, elements: [...doc.elements, withZ] });
        dispatch({ type: "SELECT", id: withZ.id });
        dispatch({ type: "SET_TOOL", tool: TOOL.SELECT });
        return withZ.id;
      },

      updateElement(id, patch) {
        commit({
          ...doc,
          elements: doc.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
        });
      },

      deleteElement(id) {
        commit({ ...doc, elements: doc.elements.filter((el) => el.id !== id) });
        if (ui.selectedId === id) dispatch({ type: "SELECT", id: null });
      },

      reorderLayer(id, direction) {
        const sorted = [...doc.elements].sort((a, b) => a.zIndex - b.zIndex);
        const idx = sorted.findIndex((el) => el.id === id);
        const swapIdx = direction === "up" ? idx + 1 : idx - 1;
        if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;
        const a = sorted[idx];
        const b = sorted[swapIdx];
        const aZ = a.zIndex;
        commit({
          ...doc,
          elements: doc.elements.map((el) => {
            if (el.id === a.id) return { ...el, zIndex: b.zIndex };
            if (el.id === b.id) return { ...el, zIndex: aZ };
            return el;
          }),
        });
      },

      setCanvasSize(size) {
        commit({ ...doc, size });
      },

      setTheme(patch) {
        commit({ ...doc, theme: { ...doc.theme, ...patch } });
      },

      /** Spawn-at-cursor placement: creates the right element kind for the active tool/pending sticker. */
      placeElementAt(tool, pendingSticker, point) {
        let element = null;
        if (tool === TOOL.TEXT) element = createTextElement();
        else if (tool === TOOL.IMAGE) element = createImageElement();
        else if (tool === TOOL.VIDEO) element = createVideoElement();
        else if (tool === TOOL.AUDIO) element = createAudioElement();
        else if (tool === TOOL.STICKER && pendingSticker) {
          element =
            pendingSticker.category === "frame"
              ? createFrameStickerElement(pendingSticker.stickerId)
              : createStickerElement(pendingSticker.stickerId, pendingSticker.category, {
                  char: pendingSticker.char,
                });
        }
        if (!element) return null;
        // Center the spawned element under the cursor, matching the ghost preview.
        element.x = Math.round(point.x - element.width / 2);
        element.y = Math.round(point.y - element.height / 2);
        return actions.addElement(element);
      },

      // --- Journey line draw mode (vertex-by-vertex, ui-only until finished) ---
      addJourneyPoint(point) {
        dispatch({ type: "SET_DRAWING_LINE", points: [...(ui.drawingLine || []), point] });
      },
      cancelJourneyLine() {
        dispatch({ type: "SET_DRAWING_LINE", points: null });
        dispatch({ type: "SET_TOOL", tool: TOOL.SELECT });
      },
      finishJourneyLine() {
        const points = ui.drawingLine;
        dispatch({ type: "SET_DRAWING_LINE", points: null });
        dispatch({ type: "SET_TOOL", tool: TOOL.SELECT });
        if (!points || points.length < 2) return;
        const line = createJourneyLine(points);
        commit({ ...doc, journeyLines: [...doc.journeyLines, line] });
        dispatch({ type: "SELECT", id: line.id });
      },
      updateJourneyLine(id, patch) {
        commit({
          ...doc,
          journeyLines: doc.journeyLines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        });
      },
      deleteJourneyLine(id) {
        commit({ ...doc, journeyLines: doc.journeyLines.filter((l) => l.id !== id) });
        if (ui.selectedId === id) dispatch({ type: "SELECT", id: null });
      },
    }),
    // doc/ui are read via closure each render; recreating this object per
    // render is intentional so every action always sees the latest state.
    [doc, ui]
  );

  const value = useMemo(
    () => ({
      doc,
      ui,
      canUndo: computeCanUndo(state.history),
      canRedo: computeCanRedo(state.history),
      dispatch,
      actions,
    }),
    [doc, ui, state.history, actions]
  );

  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}

export { TOOL };
