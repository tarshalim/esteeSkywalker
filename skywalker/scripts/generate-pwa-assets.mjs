// Generates the iOS home-screen icon, manifest icons and apple-touch-startup-image
// splash screens from the brand logo. Re-run with `npm run pwa-assets` after changing
// the logo or colours, then paste the printed <link> tags into index.html if devices changed.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const LOGO = "public/Group 118.png";
const OUT = "public/pwa";

// Keep in sync with --bg in src/index.css (light / dark).
const THEMES = { light: "#fafaf9", dark: "#0f172a" };

// Portrait CSS-point viewport sizes + pixel ratio. iPads also get a landscape splash.
const DEVICES = [
  // iPhone
  { w: 440, h: 956, r: 3 }, // 16 Pro Max
  { w: 402, h: 874, r: 3 }, // 16 Pro
  { w: 430, h: 932, r: 3 }, // 14/15 Pro Max, 15/16 Plus
  { w: 393, h: 852, r: 3 }, // 14 Pro, 15, 15 Pro, 16
  { w: 428, h: 926, r: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 390, h: 844, r: 3 }, // 12, 13, 14
  { w: 375, h: 812, r: 3 }, // X, XS, 11 Pro, 12/13 mini
  { w: 414, h: 896, r: 3 }, // XS Max, 11 Pro Max
  { w: 414, h: 896, r: 2 }, // XR, 11
  { w: 414, h: 736, r: 3 }, // 6/7/8 Plus
  { w: 375, h: 667, r: 2 }, // 6/7/8, SE 2nd/3rd gen
  { w: 320, h: 568, r: 2 }, // SE 1st gen
  // iPad
  { w: 1032, h: 1376, r: 2, ipad: true }, // Pro 13" (M4)
  { w: 1024, h: 1366, r: 2, ipad: true }, // Pro 12.9"
  { w: 834, h: 1210, r: 2, ipad: true }, // Pro 11" (M4)
  { w: 834, h: 1194, r: 2, ipad: true }, // Pro 11"
  { w: 820, h: 1180, r: 2, ipad: true }, // Air 10.9", iPad 10th gen
  { w: 834, h: 1112, r: 2, ipad: true }, // Air 10.5"
  { w: 810, h: 1080, r: 2, ipad: true }, // iPad 10.2"
  { w: 768, h: 1024, r: 2, ipad: true }, // mini, 9.7"
  { w: 744, h: 1133, r: 2, ipad: true }, // mini 6th gen
];

await mkdir(OUT, { recursive: true });

// The logo is a yellow disc on transparency; sample the disc colour so the
// square icons can bleed it to the edges (iOS renders transparency as black).
const { data } = await sharp(LOGO).extract({ left: 436, top: 40, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
const yellow = { r: data[0], g: data[1], b: data[2], alpha: 1 };

async function icon(size, file, logoScale) {
  const inner = Math.round(size * logoScale);
  const logo = await sharp(LOGO).resize(inner, inner).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: yellow } })
    .composite([{ input: logo, gravity: "center" }])
    .flatten({ background: yellow })
    .png()
    .toFile(`${OUT}/${file}`);
}

// Full-bleed for iOS/any; maskable keeps the rider inside the 80% safe zone.
await icon(180, "apple-touch-icon.png", 1);
await icon(192, "icon-192.png", 1);
await icon(512, "icon-512.png", 1);
await icon(512, "icon-maskable-512.png", 0.8);

async function splash(width, height, bg, file) {
  const logoSize = Math.round(Math.min(width, height) * 0.36);
  const logo = await sharp(LOGO).resize(logoSize, logoSize).toBuffer();
  await sharp({ create: { width, height, channels: 3, background: bg } })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(`${OUT}/${file}`);
}

const tags = [];
for (const { w, h, r, ipad } of DEVICES) {
  const orientations = ipad ? ["portrait", "landscape"] : ["portrait"];
  for (const orientation of orientations) {
    const [pw, ph] = orientation === "portrait" ? [w * r, h * r] : [h * r, w * r];
    for (const [scheme, bg] of Object.entries(THEMES)) {
      const file = `splash-${pw}x${ph}-${scheme}.png`;
      await splash(pw, ph, bg, file);
      tags.push(
        `<link rel="apple-touch-startup-image" href="/pwa/${file}" media="(prefers-color-scheme: ${scheme}) and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: ${orientation})">`,
      );
    }
  }
}

console.log(`Wrote ${tags.length} splash screens + 4 icons to ${OUT}\n`);
console.log(tags.join("\n"));
