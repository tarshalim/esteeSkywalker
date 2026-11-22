import { ArrowDown, ArrowUp, BringToFront, SendToBack } from "lucide-react";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD = IS_MAC ? "⌘" : "Ctrl+";
const SHIFT = IS_MAC ? "⇧" : "Shift+";

/**
 * Canva-style layer ordering, shared by the element toolbar, the right-click
 * menu and the keyboard shortcuts. `direction` is what CanvasProvider's
 * reorderLayer takes; `raises` says which end of the stack disables it.
 */
export const LAYER_ACTIONS = [
  { direction: "front", label: "Bring to front", shortcut: `${MOD}${SHIFT}]`, Icon: BringToFront, raises: true },
  { direction: "up", label: "Bring forward", shortcut: `${MOD}]`, Icon: ArrowUp, raises: true },
  { direction: "down", label: "Send backward", shortcut: `${MOD}[`, Icon: ArrowDown, raises: false },
  { direction: "back", label: "Send to back", shortcut: `${MOD}${SHIFT}[`, Icon: SendToBack, raises: false },
];

export const SHORTCUT_LABELS = { duplicate: `${MOD}D`, delete: "Del" };

/** Whether a layer action can do anything, given lib/canvasGroups.js layerPosition(). */
export const layerActionEnabled = (action, layers) => (action.raises ? layers.canRaise : layers.canLower);

/**
 * The layer move a keydown asks for, or null. Uses `code` so Shift (which
 * turns "]" into "}" on most layouts) and non-US keyboards still match.
 */
export function layerDirectionForKey(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  if (e.code === "BracketRight") return e.shiftKey ? "front" : "up";
  if (e.code === "BracketLeft") return e.shiftKey ? "back" : "down";
  return null;
}
