import { useState } from "react";
import "./PinNamePopover.css";

/**
 * Shown right after a pin is dropped/tapped onto the globe (GlobeExplorer's
 * `pendingPinCoords`). Positioned near the toolbox rather than pixel-exact at
 * the drop point — exact screen-projection via getScreenCoords is a
 * documented future enhancement, not required for v1.
 */
export default function PinNamePopover({ onConfirm, onCancel }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onConfirm({ title: title.trim(), note: note.trim() });
  };

  return (
    <div className="pin-name-popover-backdrop" onClick={onCancel}>
      <form
        className="glass-panel pin-name-popover"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>Name this pin</h3>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Best pho of the trip"
          autoFocus
          required
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note…"
          rows={3}
        />
        <div className="pin-name-popover-actions">
          <button type="button" className="pin-name-popover-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="pin-name-popover-save">
            Save pin
          </button>
        </div>
      </form>
    </div>
  );
}
