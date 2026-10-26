// Decorative scrapbook elements for placing over blog cards, trip tickets and
// pages. Give the parent `relative` and pass `place` to stick one on:
//   <article className="relative">
//     <WashiTape place="top-center" variant="linen" />
//     <PostageStamp place="top-right"><img src={cover} alt="" /></PostageStamp>
//   </article>
export { default as ScrapbookArt } from "./ScrapbookArt";
export { default as WashiTape } from "./elements/WashiTape";
export { default as PostageStamp } from "./elements/PostageStamp";
export { default as MapPinBadge } from "./elements/MapPinBadge";
export { default as BotanicalLeaf } from "./elements/BotanicalLeaf";
export { default as CompassRose } from "./elements/CompassRose";
export * as SCRAPBOOK_VARIANTS from "./elements/variants";
export { SIZES, PLACEMENTS, seededTilt } from "./scrapbookStyle";
