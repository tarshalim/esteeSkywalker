// Capture date, GPS and camera from an MP4 / MOV / M4V clip's container
// metadata, read client-side without decoding (or loading) the whole file.
//
// Where phones put it:
//   moov/mvhd                       creation time, UTC seconds since 1904
//   moov/udta/©xyz, ©mak, ©mod      ISO 6709 location + make/model (Android, older iOS)
//   moov/meta/keys + ilst           com.apple.quicktime.location.ISO6709 / .creationdate
//                                   / .make / .model (iPhone)
// exifr only reads image formats, so videos come through here instead.

const MP4_EPOCH_MS = Date.UTC(1904, 0, 1);
const MAX_MOOV_BYTES = 32 * 1024 * 1024; // moov is metadata + sample tables: a few MB even for long clips

const pad = (n) => String(n).padStart(2, "0");
const localDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const fourcc = (view, at) =>
  String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));

const utf8 = new TextDecoder("utf-8");
const text = (view, start, end) =>
  end > start ? utf8.decode(new Uint8Array(view.buffer, view.byteOffset + start, end - start)).replace(/\0+$/, "").trim() : "";

/** The boxes laid end to end in `view` between `start` and `end`, as { type, index, start, end } of their payloads. */
function* boxes(view, start, end) {
  let off = start;
  while (off + 8 <= end) {
    let size = view.getUint32(off);
    let header = 8;
    if (size === 1) {
      if (off + 16 > end) return;
      size = Number(view.getBigUint64(off + 8));
      header = 16;
    } else if (size === 0) size = end - off;
    if (size < header || off + size > end) return;
    // ilst children are numbered by their 1-based key index instead of a fourcc.
    yield { type: fourcc(view, off + 4), index: view.getUint32(off + 4), start: off + header, end: off + size };
    off += size;
  }
}

const child = (view, box, type) => {
  for (const b of boxes(view, box.start, box.end)) if (b.type === type) return b;
  return null;
};

/**
 * Signed decimal degrees from an ISO 6709 string ("+35.6895+139.6917+040.1/").
 * Also takes the degrees-minutes(-seconds) forms ("+3541.37+13941.50/").
 * @returns {{lat:number,lng:number}|null}
 */
export function parseIso6709(value) {
  const m = /^([+-])(\d+)(\.\d+)?([+-])(\d+)(\.\d+)?/.exec((value ?? "").trim());
  if (!m) return null;
  const toDegrees = (sign, int, frac, degDigits) => {
    const n = int.length;
    let deg;
    if (n <= degDigits) deg = Number(int + (frac ?? ""));
    else if (n === degDigits + 2) deg = Number(int.slice(0, degDigits)) + Number(int.slice(degDigits) + (frac ?? "")) / 60;
    else if (n === degDigits + 4)
      deg =
        Number(int.slice(0, degDigits)) +
        Number(int.slice(degDigits, degDigits + 2)) / 60 +
        Number(int.slice(degDigits + 2) + (frac ?? "")) / 3600;
    else return NaN;
    return sign === "-" ? -deg : deg;
  };
  const lat = toDegrees(m[1], m[2], m[3], 2);
  const lng = toDegrees(m[4], m[5], m[6], 3);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  // Some phones write 0,0 when they had no fix.
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/**
 * yyyy-mm-dd + HH:MM from a container date string. A string with an offset
 * ("2023-06-12T14:03:22+0900", Apple's creationdate) keeps its own wall-clock
 * time, like EXIF; a UTC one ("…Z") is shown in the viewer's local time.
 */
export function parseVideoDate(value) {
  const s = (value ?? "").trim();
  const wall = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?([+-]\d{2}:?\d{2})$/.exec(s);
  if (wall) return { dateTaken: wall[1], timeTaken: wall[2] };
  const d = new Date(s);
  if (!/^\d{4}-\d{2}-\d{2}/.test(s) || Number.isNaN(d.getTime())) return null;
  return /T\d{2}:\d{2}/.test(s) ? { dateTaken: localDay(d), timeTaken: localTime(d) } : { dateTaken: s.slice(0, 10), timeTaken: null };
}

/** mvhd's creation time, or null when unset (0) or implausible. */
function mvhdDate(view, box) {
  const version = view.getUint8(box.start);
  const secs = version === 1 ? Number(view.getBigUint64(box.start + 4)) : view.getUint32(box.start + 4);
  if (!secs) return null;
  const d = new Date(MP4_EPOCH_MS + secs * 1000);
  const year = d.getUTCFullYear();
  return year >= 1990 && d.getTime() <= Date.now() + 366 * 86400000 ? d : null;
}

/** QuickTime user-data string atom (©xyz, ©mak…): u16 length, u16 language, then the text. */
function udtaString(view, box) {
  if (box.end - box.start < 4) return "";
  const len = view.getUint16(box.start);
  return text(view, box.start + 4, Math.min(box.end, box.start + 4 + len));
}

/** key → string value from a QuickTime / iTunes `meta` box (keys + ilst). */
function metaValues(view, meta) {
  // moov/meta is a plain box; udta/meta is a "full box" with 4 bytes of version/flags first.
  if (meta.end - meta.start < 8) return {};
  const start = view.getUint32(meta.start) === 0 ? meta.start + 4 : meta.start;
  const body = { start, end: meta.end };
  const keys = [];
  const keysBox = child(view, body, "keys");
  if (keysBox) {
    let off = keysBox.start + 8; // version/flags + entry count
    while (off + 8 <= keysBox.end) {
      const size = view.getUint32(off);
      if (size < 8 || off + size > keysBox.end) break;
      keys.push(text(view, off + 8, off + size));
      off += size;
    }
  }
  const values = {};
  const ilst = child(view, body, "ilst");
  if (!ilst) return values;
  for (const item of boxes(view, ilst.start, ilst.end)) {
    const key = keys[item.index - 1] ?? item.type;
    const data = child(view, item, "data");
    // data: u32 type (1 = UTF-8) + u32 locale, then the value.
    if (data && data.end - data.start > 8 && view.getUint32(data.start) === 1) values[key] = text(view, data.start + 8, data.end);
  }
  return values;
}

function cameraLabel(make, model) {
  const mk = (make ?? "").trim();
  const md = (model ?? "").trim();
  if (!md) return mk || null;
  return mk && !md.toLowerCase().startsWith(mk.toLowerCase().split(" ")[0]) ? `${mk} ${md}` : md;
}

/** Metadata from an in-memory moov box payload. */
function readMoov(view) {
  const moov = { start: 0, end: view.byteLength };
  const found = { location: null, date: null, make: null, model: null, created: null };

  const mvhd = child(view, moov, "mvhd");
  if (mvhd) found.created = mvhdDate(view, mvhd);

  const fromMeta = (meta) => {
    const v = metaValues(view, meta);
    found.location ??= v["com.apple.quicktime.location.ISO6709"] || v["©xyz"] || null;
    found.date ??= v["com.apple.quicktime.creationdate"] || v["©day"] || null;
    found.make ??= v["com.apple.quicktime.make"] || v["©mak"] || null;
    found.model ??= v["com.apple.quicktime.model"] || v["©mod"] || null;
  };
  const meta = child(view, moov, "meta");
  if (meta) fromMeta(meta);

  const udta = child(view, moov, "udta");
  if (udta) {
    for (const b of boxes(view, udta.start, udta.end)) {
      if (b.type === "©xyz") found.location ??= udtaString(view, b);
      else if (b.type === "©day") found.date ??= udtaString(view, b);
      else if (b.type === "©mak") found.make ??= udtaString(view, b);
      else if (b.type === "©mod") found.model ??= udtaString(view, b);
      else if (b.type === "meta") fromMeta(b);
    }
  }

  const point = parseIso6709(found.location);
  const when =
    parseVideoDate(found.date) ?? (found.created ? { dateTaken: localDay(found.created), timeTaken: localTime(found.created) } : null);
  return {
    dateTaken: when?.dateTaken ?? null,
    timeTaken: when?.timeTaken ?? null,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    camera: cameraLabel(found.make, found.model),
  };
}

const EMPTY = { dateTaken: null, timeTaken: null, lat: null, lng: null, camera: null };

/**
 * Walks the top-level boxes via `read(offset, length) → Promise<DataView>`
 * (only headers are read until moov turns up — it's often at the very end).
 */
export async function parseVideoContainer(read, size) {
  let off = 0;
  while (off + 8 <= size) {
    const head = await read(off, 16);
    if (head.byteLength < 8) break;
    let boxSize = head.getUint32(0);
    let header = 8;
    if (boxSize === 1) {
      if (head.byteLength < 16) break;
      boxSize = Number(head.getBigUint64(8));
      header = 16;
    } else if (boxSize === 0) boxSize = size - off;
    if (boxSize < header) break;
    if (fourcc(head, 4) === "moov") {
      const length = Math.min(boxSize - header, MAX_MOOV_BYTES, size - off - header);
      return readMoov(await read(off + header, length));
    }
    off += boxSize;
  }
  return { ...EMPTY };
}

/** Container metadata of a video File/Blob; all-null when it has none or isn't MP4/MOV. */
export async function extractVideoMetadata(file) {
  try {
    return await parseVideoContainer(
      async (offset, length) => new DataView(await file.slice(offset, offset + length).arrayBuffer()),
      file.size
    );
  } catch {
    return { ...EMPTY };
  }
}
