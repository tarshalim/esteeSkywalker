import { useRef } from "react";
import { CONTENT_BY_KIND } from "./elementRegistry";
import { useFitZoom } from "./useFitZoom";
import { DEFAULT_THEME, canvasHeight } from "../../../lib/canvasElements";
import { paperBackground } from "../../../lib/paperStyles";
import { paintOrder } from "../../../lib/canvasGroups";

/** Published rendering of a canvas doc: same renderers as the editor, no chrome, scaled to fit. */
export default function CanvasReadOnlyView({ doc }) {
  const frameRef = useRef(null);
  const zoom = useFitZoom(frameRef, doc.size.width);
  const height = canvasHeight(doc);
  const sorted = paintOrder(doc.elements);

  return (
    <div ref={frameRef} className="w-full">
      <div className="relative mx-auto" style={{ width: doc.size.width * zoom, height: height * zoom }}>
        <div
          className="absolute left-0 top-0 isolate origin-top-left overflow-hidden rounded-[4px] shadow-[0_18px_50px_rgba(15,23,42,0.18)]"
          style={{ width: doc.size.width, height, transform: `scale(${zoom})`, ...paperBackground(doc.theme?.paper ?? DEFAULT_THEME.paper) }}
        >
          {sorted.map((el, index) => {
            const Content = CONTENT_BY_KIND[el.kind];
            if (!Content) return null;
            return (
              <div
                key={el.id}
                className="absolute"
                style={{ left: el.x, top: el.y, width: el.width, height: el.height, transform: `rotate(${el.rotation}deg)`, zIndex: index + 1 }}
              >
                <Content element={el} editable={false} zoom={zoom} autoplayOnVisible />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
