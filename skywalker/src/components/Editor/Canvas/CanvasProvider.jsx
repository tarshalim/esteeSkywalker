import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { canvasReducer, createInitialState } from "./canvasReducer";
import { canUndo as computeCanUndo, canRedo as computeCanRedo } from "../../../lib/canvasHistory";
import { DEFAULT_THEME, dockPatch, dockPayload, makeElementId, nextZIndex } from "../../../lib/canvasElements";
import { duplicateWithGroups, removeWithGroups, reorderWithinGroup, updateWithGroups, withAttachment } from "../../../lib/canvasGroups";

const CanvasContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useCanvas() {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error("useCanvas must be used inside a CanvasProvider");
  return ctx;
}

// No-op edits keep the same doc object so they never take an undo slot.
const withElements = (d, elements) => (elements === d.elements ? d : { ...d, elements });

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
        mutate((d) => ({ ...d, elements: [...d.elements, withAttachment(d.elements, { ...element, zIndex: nextZIndex(d.elements) })] }));
        dispatch({ type: edit ? "EDIT" : "SELECT", id: element.id });
        return element.id;
      },

      /**
       * `patch` is an object, or a function of the latest element returning
       * one. `coalesce` groups rapid edits (typing, nudging) into one undo step.
       * Moving a host carries its attached overlays (lib/canvasGroups.js).
       */
      updateElement(id, patch, { coalesce } = {}) {
        mutate((d) => updateWithGroups(d, id, patch), coalesce ? `${id}:${coalesce}` : undefined);
      },

      deleteElement(id) {
        mutate((d) => ({ ...d, elements: removeWithGroups(d.elements, id) }));
        dispatch({ type: "FORGET", id });
      },

      /**
       * Drops `sourceId`'s photo, clip or words into `hostId`'s empty slot
       * (lib/canvasElements.js dockPatch) and removes the source, as one undo
       * step. A host that no longer fits leaves the doc alone.
       */
      dockInto(sourceId, hostId) {
        mutate((d) => {
          const source = d.elements.find((el) => el.id === sourceId);
          const host = d.elements.find((el) => el.id === hostId);
          const patch = source && host && dockPatch(host, dockPayload(source));
          if (!patch) return d;
          return { ...d, elements: removeWithGroups(updateWithGroups(d, hostId, patch).elements, sourceId) };
        });
        dispatch({ type: "SELECT", id: hostId });
      },

      duplicateElement(id) {
        const newId = makeElementId();
        mutate((d) => withElements(d, duplicateWithGroups(d.elements, id, newId)));
        dispatch({ type: "SELECT", id: newId });
      },

      reorderLayer(id, direction) {
        mutate((d) => withElements(d, reorderWithinGroup(d.elements, id, direction)));
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
