import ScrapbookArt from "../ScrapbookArt";
import { PIN } from "./variants";

/** A pinned-map sticker badge for marking a place on a card or ticket. */
export default function MapPinBadge({ variant = "map", size = "md", rotation = -2, shadow = "lifted", ...props }) {
  return <ScrapbookArt artId={PIN[variant] ?? PIN.map} size={size} rotation={rotation} shadow={shadow} {...props} />;
}
