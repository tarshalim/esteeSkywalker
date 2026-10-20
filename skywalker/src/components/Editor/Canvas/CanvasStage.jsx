import { useRef } from "react";
import { ELEMENT_KIND, DEFAULT_SIZES } from "../../../lib/canvasElements";
import { clientToCanvasPoint, useSpawnAtCursor } from "./useSpawnAtCursor";
import { TOOL } from "./canvasReducer";
import CanvasElement from "./CanvasElement";
import JourneyLineLayer from "./JourneyLineLayer";
import TextElementContent from "./elements/TextElementContent";
import ImageElementContent from "./elements/ImageElementContent";
import VideoElementContent from "./elements/VideoElementContent";
import StickerElementContent from "./elements/StickerElementContent";
import FrameStickerElementContent from "./elements/FrameStickerElementContent";
import AudioPlayerElementContent from "./elements/AudioPlayerElementContent";

const CONTENT_BY_KIND = {
  [ELEMENT_KIND.TEXT]: TextElementContent,
  [ELEMENT_KIND.IMAGE]: ImageElementContent,
  [ELEMENT_KIND.VIDEO]: VideoElementContent,
  [ELEMENT_KIND.STICKER]: StickerElementContent,
  [ELEMENT_KIND.FRAME_STICKER]: FrameStickerElementContent,
  [ELEMENT_KIND.AUDIO]: AudioPlayerElementContent,
};

function spawnGhostSize(tool, pendingSticker) {
  if (tool === TOOL.STICKER) {
    return pendingSticker?.category === "frame" ? DEFAULT_SIZES[ELEMENT_KIND.FRAME_STICKER] : DEFAULT_SIZES[ELEMENT_KIND.STICKER];
  }
  return DEFAULT_SIZES[tool] || { width: 120, height: 80 };
}

export default function CanvasStage({ doc, ui, actions, stageRef, onRequestAudioSource, onCanvasResizeStart }) {
  const paperRef = useRef(null);
  const combinedRef = (node) => {
    paperRef.current = node;
    if (stageRef) stageRef.current = node;
  };

  const spawnActive = ui.activeTool !== TOOL.SELECT && ui.activeTool !== TOOL.JOURNEY;
  const ghostPoint = useSpawnAtCursor(paperRef, ui.zoom, spawnActive);

  const handleStagePointerDown = (e) => {
    if (e.target !== paperRef.current) return;
    const point = clientToCanvasPoint(paperRef.current, ui.zoom, e.clientX, e.clientY);
    if (ui.activeTool === TOOL.JOURNEY) {
      actions.addJourneyPoint(point);
      return;
    }
    if (spawnActive) {
      actions.placeElementAt(ui.activeTool, ui.pendingSticker, point);
      return;
    }
    actions.select(null);
  };

  const handleStageDoubleClick = () => {
    if (ui.activeTool === TOOL.JOURNEY) actions.finishJourneyLine();
  };

  const sortedElements = [...doc.elements].sort((a, b) => a.zIndex - b.zIndex);
  const ghostSize = spawnActive ? spawnGhostSize(ui.activeTool, ui.pendingSticker) : null;

  return (
    <div className="w-full h-full flex items-center justify-center overflow-auto p-16" style={{ background: doc.theme.pageBg }}>
      <div
        ref={combinedRef}
        className="relative shadow-[0_30px_80px_rgba(0,0,0,0.5)] shrink-0"
        style={{
          width: doc.size.width,
          height: doc.size.height,
          background: doc.theme.canvasBg,
          transform: `scale(${ui.zoom})`,
          transformOrigin: "center",
          cursor: ui.activeTool === TOOL.JOURNEY ? "crosshair" : spawnActive ? "none" : "default",
        }}
        onPointerDown={handleStagePointerDown}
        onDoubleClick={handleStageDoubleClick}
      >
        {doc.theme.showGrid && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(to right, ${doc.theme.gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${doc.theme.gridColor} 1px, transparent 1px)`,
              backgroundSize: `${doc.theme.gridSize}px ${doc.theme.gridSize}px`,
            }}
          />
        )}

        {sortedElements.map((element) => {
          const Content = CONTENT_BY_KIND[element.kind];
          if (!Content) return null;
          return (
            <CanvasElement
              key={element.id}
              element={element}
              selected={ui.selectedId === element.id}
              toCanvasPoint={(cx, cy) => clientToCanvasPoint(paperRef.current, ui.zoom, cx, cy)}
              onSelect={actions.select}
              actions={actions}
            >
              <Content
                element={element}
                editable
                actions={actions}
                zoom={ui.zoom}
                onSelect={actions.select}
                onRequestSource={onRequestAudioSource}
              />
            </CanvasElement>
          );
        })}

        <JourneyLineLayer
          journeyLines={doc.journeyLines}
          drawingLine={ui.drawingLine}
          activeTool={ui.activeTool}
          selectedId={ui.selectedId}
          onSelect={actions.select}
        />

        {ghostPoint && ghostSize && (
          <div
            className="absolute rounded-lg border-2 border-dashed border-blue-400/70 bg-blue-400/10 pointer-events-none"
            style={{
              left: ghostPoint.x - ghostSize.width / 2,
              top: ghostPoint.y - ghostSize.height / 2,
              width: ghostSize.width,
              height: ghostSize.height,
            }}
          />
        )}

        {/* Canvas size drag handles */}
        <div
          className="absolute left-0 right-0 -bottom-1.5 h-3 cursor-ns-resize"
          onPointerDown={(e) => onCanvasResizeStart(e, ["bottom"])}
        />
        <div
          className="absolute top-0 bottom-0 -right-1.5 w-3 cursor-ew-resize"
          onPointerDown={(e) => onCanvasResizeStart(e, ["right"])}
        />
        <div
          className="absolute -right-2 -bottom-2 h-4 w-4 rounded-full bg-blue-400 border-2 border-white cursor-nwse-resize shadow"
          onPointerDown={(e) => onCanvasResizeStart(e, ["right", "bottom"])}
        />
      </div>
    </div>
  );
}
