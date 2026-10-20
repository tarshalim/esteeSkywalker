// Landscapes ship as pre-rasterised WebP (2400px wide): the source SVGs alongside them are
// 65–400 KB of gradients that the browser would otherwise re-rasterise while panning/fading.
import landscape01 from "../../assets/journey/landscapes/landscape_01.webp";
import landscape02 from "../../assets/journey/landscapes/landscape_02.webp";
import landscape03 from "../../assets/journey/landscapes/landscape_03.webp";
import landscape04 from "../../assets/journey/landscapes/landscape_04.webp";
import woodenSignpost from "../../assets/journey/signposts/normal_signpost.svg";
import signpost01 from "../../assets/journey/signposts/signpost_01.svg";
import signpost02 from "../../assets/journey/signposts/signpost_02.svg";
import signpost03 from "../../assets/journey/signposts/signpost_03.svg";
import signpost04 from "../../assets/journey/signposts/signpost_04.svg";

/** Scenery the rider passes through, in order, as scroll progress goes 0 → 1. */
export const LANDSCAPES = [landscape01, landscape02, landscape03, landscape04];

// The signpost SVGs share one cropped viewBox (520×900) with the pole centred
// and its foot at the bottom edge, so they line up on the trail interchangeably.
const POST_SIGNPOSTS = [signpost02, signpost03, signpost01, signpost04];

/** The blank wooden post is reserved for the "plant a new story" stop at the trailhead. */
export const CREATE_SIGNPOST = woodenSignpost;

export const signpostFor = (index) => POST_SIGNPOSTS[index % POST_SIGNPOSTS.length];
