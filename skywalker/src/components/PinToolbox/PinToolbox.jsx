import "./PinToolbox.css";

/**
 * Corner overlay: drag the pin icon onto the globe to place a custom
 * annotation pin (PhotoGlobe resolves the drop's lat/lng via toGlobeCoords),
 * or toggle "Tap to place" for non-drag input, plus the hover/always-on
 * label display mode shared by both photo pins and custom pins.
 */
export default function PinToolbox({ labelMode, onToggleLabelMode, isPlacingPin, onTogglePlacingPin }) {
  return (
    <div className="glass-panel pin-toolbox">
      <div className="pin-toolbox-section">
        <span className="pin-toolbox-label">Drag to annotate</span>
        <div
          className="pin-toolbox-drag-handle"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "copy";
            e.dataTransfer.setData("text/plain", "new-pin");
          }}
          title="Drag onto the globe to drop a pin"
        >
          📍
        </div>
        <button
          type="button"
          className={`pin-toolbox-tap-toggle ${isPlacingPin ? "is-active" : ""}`}
          onClick={onTogglePlacingPin}
        >
          {isPlacingPin ? "Tap the globe…" : "Tap to place"}
        </button>
      </div>

      <div className="pin-toolbox-section">
        <span className="pin-toolbox-label">Pin labels</span>
        <div className="pin-toolbox-segmented">
          <button
            type="button"
            className={labelMode === "hover" ? "is-active" : ""}
            onClick={() => labelMode !== "hover" && onToggleLabelMode()}
          >
            Hover
          </button>
          <button
            type="button"
            className={labelMode === "always" ? "is-active" : ""}
            onClick={() => labelMode !== "always" && onToggleLabelMode()}
          >
            Always on
          </button>
        </div>
      </div>
    </div>
  );
}
