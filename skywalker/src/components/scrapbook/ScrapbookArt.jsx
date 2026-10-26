import { artFilter, findArt } from "../../data/scrapbookArt";
import { SHADOWS, placement, seededTilt, sizePx } from "./scrapbookStyle";

/**
 * One illustrated scrapbook piece (cut from art/sheets by `npm run scrapbook-art`)
 * as a decoration. The themed wrappers in ./elements pick the piece; this
 * handles size, tilt, shadow, blending and placement.
 *
 * @param {object} props
 * @param {string} props.artId piece id from src/data/scrapbookArt.js
 * @param {number | "xs" | "sm" | "md" | "lg" | "xl"} [props.size] long side in px or a preset
 * @param {number | "random"} [props.rotation] degrees; "random" is a stable per-piece tilt
 * @param {boolean | "soft" | "lifted"} [props.shadow]
 * @param {"normal" | "multiply"} [props.blend] multiply lets craft paper show through
 * @param {string | object} [props.place] absolute placement preset or `{ top, left, … }`
 * @param {string} [props.tone] colour preset from ART_TONES
 * @param {number} [props.hue] hue shift in degrees
 * @param {string} [props.label] accessible name; omit for purely decorative pieces
 */
export default function ScrapbookArt({
  artId,
  size = "md",
  rotation = 0,
  shadow = "soft",
  blend = "normal",
  place,
  tone,
  hue,
  label,
  className = "",
  style,
  children,
}) {
  const art = findArt(artId);
  if (!art) return null;

  const long = sizePx(size);
  const wide = art.width >= art.height;
  const width = wide ? long : (long * art.width) / art.height;
  const height = wide ? (long * art.height) / art.width : long;

  const angle = rotation === "random" ? seededTilt(artId) : rotation;
  const { style: placeStyle, shift } = placement(place);
  const transform = [shift && `translate(${shift})`, angle && `rotate(${angle}deg)`].filter(Boolean).join(" ");
  const shadowFilter = shadow ? SHADOWS[shadow === true ? "soft" : shadow] : "";

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`pointer-events-none inline-block shrink-0 select-none ${placeStyle ? "" : "relative"} ${
        blend === "multiply" ? "mix-blend-multiply" : ""
      } ${className}`}
      style={{ width, height, transform: transform || undefined, ...placeStyle, ...style }}
    >
      <img
        src={art.src}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        className="block h-full w-full object-contain"
        style={{ filter: artFilter({ tone, hue }, shadowFilter) }}
      />
      {children}
    </span>
  );
}
