import { createHistory, pushHistory, undo, redo } from "../../../lib/canvasHistory";

export const TOOL = {
  SELECT: "select",
  TEXT: "text",
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  STICKER: "sticker",
  JOURNEY: "journey",
};

export function createInitialState(doc) {
  return {
    history: createHistory(doc),
    ui: {
      selectedId: null,
      activeTool: TOOL.SELECT,
      pendingSticker: null, // { stickerId, category, char? } while armed for spawn
      drawingLine: null, // [{x,y}, ...] while the journey tool is mid-draw
      zoom: 1,
      pan: { x: 0, y: 0 },
      drawerOpen: false,
      drawerTab: "nature",
      themePanelOpen: false,
      sizePanelOpen: false,
    },
  };
}

export function canvasReducer(state, action) {
  switch (action.type) {
    case "LOAD_DOC":
      return createInitialState(action.doc);

    case "COMMIT":
      return { ...state, history: pushHistory(state.history, action.doc) };

    case "UNDO":
      return { ...state, history: undo(state.history) };

    case "REDO":
      return { ...state, history: redo(state.history) };

    case "SELECT":
      return { ...state, ui: { ...state.ui, selectedId: action.id } };

    case "SET_TOOL":
      return {
        ...state,
        ui: { ...state.ui, activeTool: action.tool, pendingSticker: null, drawingLine: null, selectedId: null },
      };

    case "ARM_STICKER":
      return {
        ...state,
        ui: { ...state.ui, activeTool: TOOL.STICKER, pendingSticker: action.sticker, selectedId: null },
      };

    case "CANCEL_TOOL":
      return {
        ...state,
        ui: { ...state.ui, activeTool: TOOL.SELECT, pendingSticker: null, drawingLine: null },
      };

    case "SET_DRAWING_LINE":
      return { ...state, ui: { ...state.ui, drawingLine: action.points } };

    case "SET_ZOOM":
      return { ...state, ui: { ...state.ui, zoom: action.zoom } };

    case "SET_PAN":
      return { ...state, ui: { ...state.ui, pan: action.pan } };

    case "TOGGLE_DRAWER":
      return { ...state, ui: { ...state.ui, drawerOpen: action.open ?? !state.ui.drawerOpen } };

    case "SET_DRAWER_TAB":
      return { ...state, ui: { ...state.ui, drawerTab: action.tab } };

    case "TOGGLE_THEME_PANEL":
      return { ...state, ui: { ...state.ui, themePanelOpen: action.open ?? !state.ui.themePanelOpen, sizePanelOpen: false } };

    case "TOGGLE_SIZE_PANEL":
      return { ...state, ui: { ...state.ui, sizePanelOpen: action.open ?? !state.ui.sizePanelOpen, themePanelOpen: false } };

    default:
      return state;
  }
}
