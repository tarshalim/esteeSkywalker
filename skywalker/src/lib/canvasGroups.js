// Overlays: text boxes, media and scrapbook pieces placed on a collage or on a
// scrapbook base (polaroid, frame, note, badge, art sticker…) are ordinary
// canvas elements carrying `attachedTo: <host id>`. They paint directly above
// their host, follow it when it moves, resizes or rotates, and go with it when
// it is deleted or duplicated. Hosts nest (a polaroid on a collage can carry
// its own caption). Dropping an element over a host attaches it; dragging it
// off detaches it.

import { ELEMENT_KIND, dockPatch, dockPayload, makeElementId, nextZIndex } from "./canvasElements";

const ATTACH_MARGIN = 16; // px around a collage that still counts as "on" it
const TINY_DECOR = new Set(["paperclip", "pushpin"]);

const center = (el) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

function rotateVec(x, y, deg) {
  const r = (deg * Math.PI) / 180;
  return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) };
}

const normalizeAngle = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;

/** Elements other pieces can be laid on. */
export function canHost(el) {
  switch (el.kind) {
    case ELEMENT_KIND.COLLAGE:
    case ELEMENT_KIND.SECTION:
    case ELEMENT_KIND.POLAROID:
    case ELEMENT_KIND.FRAME_STICKER:
    case ELEMENT_KIND.NOTE:
    case ELEMENT_KIND.VIEWFINDER:
      return true;
    case ELEMENT_KIND.DECOR:
      return !TINY_DECOR.has(el.decorId);
    case ELEMENT_KIND.STICKER:
      return el.category === "art";
    default:
      return false;
  }
}

/**
 * A collage takes anything but another collage. Other bases only take
 * something smaller than themselves, so setting a big note down on a small
 * sticker doesn't make the sticker carry it around.
 */
function canAttach(host, child) {
  if (host.id === child.id || child.kind === ELEMENT_KIND.COLLAGE || !canHost(host)) return false;
  return host.kind === ELEMENT_KIND.COLLAGE || child.width * child.height < host.width * host.height;
}

/** True if `point` lies inside `el`'s rotated box, grown by `margin`. */
function containsPoint(el, point, margin = 0) {
  const c = center(el);
  const local = rotateVec(point.x - c.x, point.y - c.y, -el.rotation);
  return Math.abs(local.x) <= el.width / 2 + margin && Math.abs(local.y) <= el.height / 2 + margin;
}

/** `id` plus every element attached to it, however deep. */
function subtreeIds(elements, id) {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const el of elements) {
      if (el.attachedTo && ids.has(el.attachedTo) && !ids.has(el.id)) {
        ids.add(el.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** The parent id an element should have, judged by where its centre sits. */
export function attachTarget(elements, el) {
  if (el.kind === ELEMENT_KIND.COLLAGE) return null;
  const c = center(el);
  const own = subtreeIds(elements, el.id); // never attach to yourself or something you carry
  const hosts = paintOrder(elements).filter(
    (p) =>
      !own.has(p.id) &&
      (p.id === el.attachedTo || p.zIndex < el.zIndex) &&
      canAttach(p, el) &&
      containsPoint(p, c, p.kind === ELEMENT_KIND.COLLAGE ? ATTACH_MARGIN : 0)
  );
  return hosts.at(-1)?.id ?? null;
}

/** Topmost host under a page point (drop targets for library pieces). */
export function hostAt(elements, point) {
  return paintOrder(elements).filter((p) => canHost(p) && containsPoint(p, point)).at(-1) ?? null;
}

/** Topmost element whose empty slot or blank caption `el` (being dragged) would fill if dropped now. */
export function dockTargetAt(elements, el) {
  const payload = dockPayload(el);
  if (!payload) return null;
  const c = center(el);
  return paintOrder(elements).filter((p) => p.id !== el.id && containsPoint(p, c) && dockPatch(p, payload)).at(-1)?.id ?? null;
}

/** Topmost element under a page point whose empty slot takes `type` media (file drops). */
export function slotTargetAt(elements, point, type) {
  const payload = { type, src: "x" };
  return paintOrder(elements).filter((p) => containsPoint(p, point) && dockPatch(p, payload)).at(-1) ?? null;
}

/**
 * Where a child goes when its parent changes from `from` to `to`: it keeps
 * its relative spot (scaled with the parent's box) and turns with it. Its own
 * size is left alone, so stickers and text don't stretch.
 */
export function followParent(child, from, to) {
  const c0 = center(from);
  const c1 = center(to);
  const cc = center(child);
  const local = rotateVec(cc.x - c0.x, cc.y - c0.y, -from.rotation);
  const sx = from.width ? to.width / from.width : 1;
  const sy = from.height ? to.height / from.height : 1;
  const moved = rotateVec(local.x * sx, local.y * sy, to.rotation);
  return {
    x: c1.x + moved.x - child.width / 2,
    y: c1.y + moved.y - child.height / 2,
    rotation: normalizeAngle(child.rotation + to.rotation - from.rotation),
  };
}

/**
 * Where `el` is while one of its ancestors (`live.id`) is mid-transform to
 * `live.patch`, following it down the chain; undefined if `live` isn't above it.
 */
export function followLive(el, byId, live) {
  if (!live || !el.attachedTo) return undefined;
  const chain = []; // ancestors, outermost first
  for (let p = byId.get(el.attachedTo); p && chain.length < byId.size; p = byId.get(p.attachedTo)) {
    chain.unshift(p);
    if (p.id === live.id) break;
  }
  if (chain[0]?.id !== live.id) return undefined;
  let from = chain[0];
  let to = { ...from, ...live.patch };
  for (const node of [...chain.slice(1), el]) {
    const next = { ...node, ...followParent(node, from, to) };
    from = node;
    to = next;
  }
  return { x: to.x, y: to.y, rotation: to.rotation };
}

const GEOMETRY = ["x", "y", "width", "height", "rotation"];
const geometryChanged = (a, b) => GEOMETRY.some((k) => a[k] !== b[k]);
const isChildOf = (parentId) => (el) => el.attachedTo === parentId;

function roundGeometry(patch) {
  return { x: Math.round(patch.x), y: Math.round(patch.y), rotation: Math.round(patch.rotation * 10) / 10 };
}

/** Moves everything attached to a host that went from `prev` to `next`, grandchildren included. */
function carryChildren(elements, prev, next) {
  let out = elements;
  for (const child of elements.filter(isChildOf(prev.id))) {
    const moved = { ...child, ...roundGeometry(followParent(child, prev, next)) };
    out = carryChildren(
      out.map((el) => (el.id === child.id ? moved : el)),
      child,
      moved
    );
  }
  return out;
}

/**
 * Applies `patch` (object or fn of the element) to one element. A host
 * carries its children along; anything but a collage then re-checks which
 * host, if any, it now sits on. Leaving a host lifts it to the top layer so
 * it can't vanish behind it.
 */
export function updateWithGroups(doc, id, patch) {
  const prev = doc.elements.find((el) => el.id === id);
  if (!prev) return doc; // late writes (an upload finishing after a delete) are no-ops
  const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
  let elements = doc.elements.map((el) => (el.id === id ? next : el));

  if (geometryChanged(prev, next)) {
    elements = carryChildren(elements, prev, next);
    const target = attachTarget(elements, next);
    if (next.kind !== ELEMENT_KIND.COLLAGE && target !== (next.attachedTo ?? null)) {
      const lift = target ? {} : { zIndex: nextZIndex(elements) };
      elements = elements.map((el) => (el.id === id ? { ...el, attachedTo: target, ...lift } : el));
    }
  }
  return { ...doc, elements };
}

/** New element, attached to whatever host it lands on (unless told otherwise). */
export function withAttachment(elements, element) {
  if (element.attachedTo !== undefined) return element;
  return { ...element, attachedTo: attachTarget(elements, element) };
}

/**
 * Adds `host` beneath everything on the page and attaches the top-level pieces
 * whose centres it covers, so a backdrop laid over existing content gathers it up.
 */
export function addBeneath(elements, host) {
  const placed = { ...host, attachedTo: null, zIndex: elements.reduce((min, el) => Math.min(min, el.zIndex), 1) - 1 };
  const ids = new Set(elements.map((el) => el.id));
  const adopts = (el) => !(el.attachedTo && ids.has(el.attachedTo)) && canAttach(placed, el) && containsPoint(placed, center(el));
  return [...elements.map((el) => (adopts(el) ? { ...el, attachedTo: placed.id } : el)), placed];
}

/** Removes an element and everything attached to it. */
export function removeWithGroups(elements, id) {
  const gone = subtreeIds(elements, id);
  return elements.filter((el) => !gone.has(el.id));
}

/** Copies an element 24px down-right, with copies of everything attached to it. */
export function duplicateWithGroups(elements, id, newId) {
  const source = elements.find((el) => el.id === id);
  if (!source) return elements;
  let z = nextZIndex(elements);
  const copies = [];
  const copy = (el, copyId, attachedTo) => {
    copies.push({ ...el, id: copyId, attachedTo, x: el.x + 24, y: el.y + 24, zIndex: z++ });
    elements
      .filter(isChildOf(el.id))
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach((child) => copy(child, makeElementId(), copyId));
  };
  copy(source, newId, source.attachedTo);
  return [...elements, ...copies];
}

/** Elements in paint order: each top-level element by zIndex, its subtree (by zIndex) right above it. */
export function paintOrder(elements) {
  const ids = new Set(elements.map((el) => el.id));
  const byZ = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const kids = new Map();
  for (const el of byZ) {
    const parent = el.attachedTo && el.attachedTo !== el.id && ids.has(el.attachedTo) ? el.attachedTo : null;
    if (!kids.has(parent)) kids.set(parent, []);
    kids.get(parent).push(el);
  }
  const out = [];
  const seen = new Set();
  const visit = (el) => {
    if (seen.has(el.id)) return;
    seen.add(el.id);
    out.push(el);
    (kids.get(el.id) ?? []).forEach(visit);
  };
  (kids.get(null) ?? []).forEach(visit);
  byZ.forEach(visit); // a corrupt attachment loop still paints, on top, rather than vanishing
  return out;
}

/** Swaps an element with its neighbour among its siblings (top-level, or children of the same host). */
export function reorderWithinGroup(elements, id, direction) {
  const target = elements.find((el) => el.id === id);
  if (!target) return elements;
  const ids = new Set(elements.map((el) => el.id));
  const scope = (el) => (el.attachedTo && ids.has(el.attachedTo) ? el.attachedTo : null);
  const siblings = elements.filter((el) => scope(el) === scope(target)).sort((a, b) => a.zIndex - b.zIndex);
  const idx = siblings.findIndex((el) => el.id === id);
  const other = siblings[direction === "up" ? idx + 1 : idx - 1];
  if (!other) return elements;
  return elements.map((el) => {
    if (el.id === target.id) return { ...el, zIndex: other.zIndex };
    if (el.id === other.id) return { ...el, zIndex: target.zIndex };
    return el;
  });
}
