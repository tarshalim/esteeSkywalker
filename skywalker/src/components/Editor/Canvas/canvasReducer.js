import { createHistory, pushHistory, undo, redo } from "../../../lib/canvasHistory";

export function createInitialState(doc) {
  return {
    history: createHistory(doc),
    // Consecutive commits sharing a coalesce key (e.g. keystrokes in one text
    // box) replace the present snapshot instead of each taking an undo slot.
    lastCoalesce: null,
    ui: {
      selectedId: null,
      editingId: null, // element whose text is being typed into
    },
  };
}

export function canvasReducer(state, action) {
  switch (action.type) {
    case "LOAD_DOC":
      return createInitialState(action.doc);

    case "COMMIT": {
      const present = state.history.present;
      // Commits are functions of the latest doc, so async callers (uploads)
      // can never write back a stale snapshot.
      const next = action.fn(present);
      if (next === present) return state;
      if (action.coalesce && action.coalesce === state.lastCoalesce) {
        return { ...state, history: { ...state.history, present: next, future: [] } };
      }
      return { ...state, history: pushHistory(state.history, next), lastCoalesce: action.coalesce ?? null };
    }

    case "UNDO":
      return { ...state, history: undo(state.history), lastCoalesce: null, ui: { ...state.ui, editingId: null } };

    case "REDO":
      return { ...state, history: redo(state.history), lastCoalesce: null, ui: { ...state.ui, editingId: null } };

    case "SELECT":
      return {
        ...state,
        lastCoalesce: null,
        ui: { selectedId: action.id, editingId: action.id && action.id === state.ui.editingId ? action.id : null },
      };

    case "EDIT":
      return { ...state, lastCoalesce: null, ui: { selectedId: action.id ?? state.ui.selectedId, editingId: action.id } };

    case "FORGET":
      // An element went away (deleted): drop any selection pointing at it.
      return state.ui.selectedId === action.id ? { ...state, ui: { selectedId: null, editingId: null } } : state;

    default:
      return state;
  }
}
