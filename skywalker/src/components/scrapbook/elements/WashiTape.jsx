import ScrapbookArt from "../ScrapbookArt";
import { WASHI } from "./variants";

/** A strip of washi tape; multiplied by default so it reads as translucent paper. */
export default function WashiTape({ variant = "cream", size = "lg", rotation = -3, blend = "multiply", ...props }) {
  return <ScrapbookArt artId={WASHI[variant] ?? WASHI.cream} size={size} rotation={rotation} blend={blend} {...props} />;
}
