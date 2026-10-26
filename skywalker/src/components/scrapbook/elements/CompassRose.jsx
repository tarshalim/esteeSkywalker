import ScrapbookArt from "../ScrapbookArt";
import { COMPASS } from "./variants";

/** A compass sticker, for trip headers and route cards. */
export default function CompassRose({ variant = "dial", size = "md", rotation = 3, ...props }) {
  return <ScrapbookArt artId={COMPASS[variant] ?? COMPASS.dial} size={size} rotation={rotation} {...props} />;
}
