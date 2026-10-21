// Minimal EXIF *writer* for JPEGs we encode ourselves (live camera captures).
// Canvas-encoded JPEGs carry no metadata, so we build a small APP1 segment with
// the capture time and GPS fix and splice it in. The result reads back through
// the normal exifr pipeline (src/lib/exif.js) like any phone photo would.
//
// Only what the app reads is written: Software, DateTimeOriginal/CreateDate
// (camera wall-clock, no timezone — same convention as real cameras) and
// GPSLatitude/Longitude with their N/S/E/W refs.

const TYPE = { BYTE: 1, ASCII: 2, SHORT: 3, LONG: 4, RATIONAL: 5 };
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 };

const pad = (n) => String(n).padStart(2, "0");

/** "2026:10:21 14:32:05" — EXIF's local wall-clock format. */
function exifDateTime(date) {
  return (
    `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

const ascii = (text) => ({ type: TYPE.ASCII, values: [...`${text}\0`].map((c) => c.charCodeAt(0) & 0xff) });

/** Decimal degrees -> [deg, min, sec] rationals (sec to 1/1000"). */
function dmsRationals(decimal) {
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60 * 1000);
  return { type: TYPE.RATIONAL, values: [[deg, 1], [min, 1], [sec, 1000]] };
}

function byteLength({ type, values }) {
  return TYPE_SIZE[type] * values.length;
}

/** Bytes an IFD occupies: count + entries + next-IFD pointer + out-of-line values (word aligned). */
function ifdSize(entries) {
  const overflow = entries.reduce((sum, e) => {
    const len = byteLength(e);
    return len > 4 ? sum + len + (len % 2) : sum;
  }, 0);
  return 2 + entries.length * 12 + 4 + overflow;
}

function writeValues(view, offset, { type, values }) {
  values.forEach((v, i) => {
    const at = offset + i * TYPE_SIZE[type];
    if (type === TYPE.BYTE || type === TYPE.ASCII) view.setUint8(at, v);
    else if (type === TYPE.SHORT) view.setUint16(at, v, true);
    else if (type === TYPE.LONG) view.setUint32(at, v, true);
    else if (type === TYPE.RATIONAL) {
      view.setUint32(at, v[0], true);
      view.setUint32(at + 4, v[1], true);
    }
  });
}

/** Writes one IFD at `start` (TIFF-relative) and returns nothing; entries must be sorted by tag. */
function writeIfd(view, start, entries) {
  view.setUint16(start, entries.length, true);
  let dataAt = start + 2 + entries.length * 12 + 4;
  entries.forEach((entry, i) => {
    const at = start + 2 + i * 12;
    view.setUint16(at, entry.tag, true);
    view.setUint16(at + 2, entry.type, true);
    view.setUint32(at + 4, entry.values.length, true);
    const len = byteLength(entry);
    if (len <= 4) writeValues(view, at + 8, entry);
    else {
      view.setUint32(at + 8, dataAt, true);
      writeValues(view, dataAt, entry);
      dataAt += len + (len % 2);
    }
  });
  view.setUint32(start + 2 + entries.length * 12, 0, true); // no next IFD
}

/** Little-endian TIFF block holding IFD0 -> Exif IFD (+ GPS IFD when `coords`). */
function buildTiff({ date, coords, software }) {
  const exifIfd = [
    { tag: 0x9003, ...ascii(exifDateTime(date)) }, // DateTimeOriginal
    { tag: 0x9004, ...ascii(exifDateTime(date)) }, // CreateDate
  ];
  const gpsIfd = coords
    ? [
        { tag: 0x0000, type: TYPE.BYTE, values: [2, 3, 0, 0] }, // GPSVersionID
        { tag: 0x0001, ...ascii(coords.lat >= 0 ? "N" : "S") },
        { tag: 0x0002, ...dmsRationals(coords.lat) },
        { tag: 0x0003, ...ascii(coords.lng >= 0 ? "E" : "W") },
        { tag: 0x0004, ...dmsRationals(coords.lng) },
      ]
    : null;

  // Pointer entries are fixed-size LONGs, so IFD0's size is known before their values are.
  const ifd0 = [
    { tag: 0x0131, ...ascii(software) }, // Software
    { tag: 0x8769, type: TYPE.LONG, values: [0] }, // ExifIFDPointer
    ...(gpsIfd ? [{ tag: 0x8825, type: TYPE.LONG, values: [0] }] : []), // GPSInfoIFDPointer
  ];
  const ifd0At = 8;
  const exifAt = ifd0At + ifdSize(ifd0);
  const gpsAt = exifAt + ifdSize(exifIfd);
  ifd0[1].values = [exifAt];
  if (gpsIfd) ifd0[2].values = [gpsAt];

  const total = gpsAt + (gpsIfd ? ifdSize(gpsIfd) : 0);
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  view.setUint16(0, 0x4949); // "II" little-endian
  view.setUint16(2, 42, true);
  view.setUint32(4, ifd0At, true);
  writeIfd(view, ifd0At, ifd0);
  writeIfd(view, exifAt, exifIfd);
  if (gpsIfd) writeIfd(view, gpsAt, gpsIfd);
  return new Uint8Array(buffer);
}

/**
 * Returns a copy of `jpeg` (a JPEG Blob without its own EXIF, e.g. from
 * canvas.toBlob) with an EXIF APP1 segment recording `date` and `coords`.
 * Inserted right after SOI/JFIF APP0, where readers expect it.
 *
 * @param {Blob} jpeg
 * @param {{ date: Date, coords?: ?{lat:number,lng:number}, software?: string }} meta
 * @returns {Promise<Blob>}
 */
export async function writeJpegExif(jpeg, { date, coords = null, software = "Skywalker" }) {
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Not a JPEG");

  const tiff = buildTiff({ date, coords, software });
  const segmentLength = 2 + 6 + tiff.length; // length field + "Exif\0\0" + TIFF
  if (segmentLength > 0xffff) throw new Error("EXIF segment too large");
  const app1 = new Uint8Array(2 + segmentLength);
  app1.set([0xff, 0xe1, segmentLength >> 8, segmentLength & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0]);
  app1.set(tiff, 10);

  let insertAt = 2;
  if (bytes[2] === 0xff && bytes[3] === 0xe0) insertAt = 4 + ((bytes[4] << 8) | bytes[5]); // keep JFIF first
  return new Blob([bytes.subarray(0, insertAt), app1, bytes.subarray(insertAt)], { type: "image/jpeg" });
}
