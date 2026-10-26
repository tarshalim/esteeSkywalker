import ScrapbookArt from "../ScrapbookArt";
import { LEAF } from "./variants";

/** A pressed leaf or frond; tilts at a stable random angle so scattered leaves don't line up. */
export default function BotanicalLeaf({ variant = "fern", size = "md", rotation = "random", ...props }) {
  return <ScrapbookArt artId={LEAF[variant] ?? LEAF.fern} size={size} rotation={rotation} {...props} />;
}
