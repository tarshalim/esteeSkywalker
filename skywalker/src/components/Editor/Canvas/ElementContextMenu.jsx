import { useEffect, useRef } from "react";
import { Copy, Trash2 } from "lucide-react";
import FloatingPanel from "./FloatingPanel";
import { LAYER_ACTIONS, SHORTCUT_LABELS, layerActionEnabled } from "./layerActions";

function Item({ label, shortcut, Icon, disabled, danger, onSelect }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] outline-none disabled:cursor-default disabled:opacity-35 ${
        danger ? "text-rose-300 enabled:hover:bg-rose-500/20 enabled:focus:bg-rose-500/20" : "enabled:hover:bg-slate-700 enabled:focus:bg-slate-700"
      }`}
      onClick={onSelect}
    >
      <Icon size={15} className="shrink-0" />
      <span className="flex-1">{label}</span>
      {shortcut && <kbd className="font-sans text-[11px] text-slate-400">{shortcut}</kbd>}
    </button>
  );
}

/**
 * Right-click menu for a canvas element: the four layer moves (greyed out at
 * the top or bottom of its group), then duplicate and delete. Arrow keys move
 * between items; Escape or a click elsewhere closes it.
 */
export default function ElementContextMenu({ clientPoint, element, layers, actions, onClose }) {
  const listRef = useRef(null);
  const run = (fn) => () => {
    fn();
    onClose();
  };

  useEffect(() => {
    listRef.current?.querySelector("button:not(:disabled)")?.focus();
  }, []);

  const onKeyDown = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    e.stopPropagation(); // don't nudge the element
    const items = [...listRef.current.querySelectorAll("button:not(:disabled)")];
    const at = items.indexOf(document.activeElement);
    const next = e.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <FloatingPanel anchor={{ point: clientPoint }} onDismiss={onClose} label="Element menu" className="w-[220px] p-1">
      <div ref={listRef} role="menu" aria-label="Arrange" onKeyDown={onKeyDown}>
        {LAYER_ACTIONS.map((a) => (
          <Item
            key={a.direction}
            label={a.label}
            shortcut={a.shortcut}
            Icon={a.Icon}
            disabled={!layerActionEnabled(a, layers)}
            onSelect={run(() => actions.reorderLayer(element.id, a.direction))}
          />
        ))}
        <div className="mx-1 my-1 h-px bg-slate-700" role="separator" />
        <Item label="Duplicate" shortcut={SHORTCUT_LABELS.duplicate} Icon={Copy} onSelect={run(() => actions.duplicateElement(element.id))} />
        <Item label="Delete" shortcut={SHORTCUT_LABELS.delete} Icon={Trash2} danger onSelect={run(() => actions.deleteElement(element.id))} />
      </div>
    </FloatingPanel>
  );
}
