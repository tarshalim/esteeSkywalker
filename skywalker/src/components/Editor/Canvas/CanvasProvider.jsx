import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { canvasReducer, createInitialState } from "./canvasReducer";
import { canUndo as computeCanUndo, canRedo as computeCanRedo } from "../../../lib/canvasHistory";
import { DEFAULT_THEME, makeElementId, nextZIndex } from "../../../lib/canvasElements";

const CanvasContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useCanvas() {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error("useCanvas must be used inside a CanvasProvider");
  return ctx;
}

function mapElement(doc, id, fn) {
  // Late writes (e.g. an upload finishing after its element was deleted) are no-ops.
  if (!doc.elements.some((el) => el.id === id)) return doc;
  return { ...doc, elements: doc.elements.map((el) => (el.id === id ? fn(el) : el)) };
}

export function CanvasProvider({ initialDoc, onDocChange, children }) {
  const [state, dispatch] = useReducer(canvasReducer, initialDoc, createInitialState);
  const doc = state.history.present;

  useEffect(() => {
    onDocChange?.(doc);
  }, [doc, onDocChange]);

  // Every action is a pure transform of the latest doc (see COMMIT), so the
  // object is stable for the provider's lifetime.
  const actions = useMemo(() => {
    const mutate = (fn, coalesce) => dispatch({ type: "COMMIT", fn, coalesce });

    return {
      loadDoc: (nextDoc) => dispatch({ type: "LOAD_DOC", doc: nextDoc }),
      undo: () => dispatch({ type: "UNDO" }),
      redo: () => dispatch({ type: "REDO" }),
      select: (id) => dispatch({ type: "SELECT", id }),
      edit: (id) => dispatch({ type: "EDIT", id }),

      addElement(element, { edit = false } = {}) {
        mutate((d) => ({ ...d, elements: [...d.elements, { ...element, zIndex: nextZIndex(d.elements) }] }));
        dispatch({ type: edit ? "EDIT" : "SELECT", id: element.id });
        return element.id;
      },

      /** `coalesce` groups rapid edits (typing, nudging) into one undo step. */
      updateElement(id, patch, { coalesce } = {}) {
        mutate((d) => mapElement(d, id, (el) => ({ ...el, ...patch })), coalesce ? `${id}:${coalesce}` : undefined);
      },

      deleteElement(id) {
        mutate((d) => ({ ...d, elements: d.elements.filter((el) => el.id !== id) }));
        dispatch({ type: "FORGET", id });
      },

      duplicateElement(id) {
        const newId = makeElementId();
        mutate((d) => {
          const source = d.elements.find((el) => el.id === id);
          if (!source) return d;
          const copy = { ...source, id: newId, x: source.x + 24, y: source.y + 24, zIndex: nextZIndex(d.elements) };
          return { ...d, elements: [...d.elements, copy] };
        });
        dispatch({ type: "SELECT", id: newId });
      },

      reorderLayer(id, direction) {
        mutate((d) => {
          const sorted = [...d.elements].sort((a, b) => a.zIndex - b.zIndex);
          const idx = sorted.findIndex((el) => el.id === id);
          const swapIdx = direction === "up" ? idx + 1 : idx - 1;
          if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return d;
          const a = sorted[idx];
          const b = sorted[swapIdx];
          return {
            ...d,
            elements: d.elements.map((el) => {
              if (el.id === a.id) return { ...el, zIndex: b.zIndex };
              if (el.id === b.id) return { ...el, zIndex: a.zIndex };
              return el;
            }),
          };
        });
      },

      setPaper(patch) {
        mutate((d) => ({ ...d, theme: { ...d.theme, paper: { ...(d.theme?.paper ?? DEFAULT_THEME.paper), ...patch } } }));
      },
    };
  }, []);

  const value = useMemo(
    () => ({
      doc,
      ui: state.ui,
      canUndo: computeCanUndo(state.history),
      canRedo: computeCanRedo(state.history),
      actions,
    }),
    [doc, state.ui, state.history, actions]
  );

  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}
