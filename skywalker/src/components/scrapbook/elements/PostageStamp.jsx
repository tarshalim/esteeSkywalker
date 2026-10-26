import ScrapbookArt from "../ScrapbookArt";
import { STAMP } from "./variants";

// Inner window of each frame, as insets of its box, for framed content.
const WINDOWS = {
  perforated: "14% 16%",
  starburst: "20%",
  seal: "18%",
};

/**
 * A blank postage stamp or seal. Children (a photo, a date, a place name) sit
 * inside the frame's window, e.g. `<PostageStamp><img src={cover} /></PostageStamp>`.
 */
export default function PostageStamp({ variant = "perforated", size = "md", rotation = 2, children, ...props }) {
  const key = STAMP[variant] ? variant : "perforated";
  return (
    <ScrapbookArt artId={STAMP[key]} size={size} rotation={rotation} {...props}>
      {children && (
        <span
          className="absolute flex items-center justify-center overflow-hidden text-center [&>img]:h-full [&>img]:w-full [&>img]:object-cover"
          style={{ inset: WINDOWS[key] }}
        >
          {children}
        </span>
      )}
    </ScrapbookArt>
  );
}
