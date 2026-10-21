// Collage overlays: text boxes and scrapbook pieces placed on a collage are
// ordinary canvas elements carrying `attachedTo: <collage id>`. They paint
// directly above their collage, follow it when it moves, resizes or rotates,
// and go with it when it is deleted or duplicated. Dropping an element over a
// collage attaches it; dragging it off detaches it.

import { ELEMENT_KIND, makeElementId, nextZIndex } from "./canvasElements";

const ATTACH_MARGIN = 16; // px around a collage that still counts as "on" it

const center = (el) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

function rotateVec(x, y, deg) {
  const r = (deg * Math.PI) / 180;
  return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) };
}

const normalizeAngle = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;

const canHost = (el) => el.kind === ELEMENT_KIND.COLLAGE;

/** True if `point` lies inside `el`'s rotated box, grown by `margin`. */
function containsPoint(el, point, margin = 0) {
  const c = center(el);
  const local = rotateVec(point.x - c.x, point.y - c.y, -el.rotation);
  return Math.abs(local.x) <= el.width / 2 + margin && Math.abs(local.y) <= el.height / 2 + margin;
}

/** The parent id an element should have, judged by where its centre sits. */
export function attachTarget(elements, el) {
  if (canHost(el)) return null;
  const c = center(el);
  const hosts = elements.filter(
    (p) => canHost(p) && p.id !== el.id && (p.id === el.attachedTo || p.zIndex < el.zIndex) && containsPoint(p, c, ATTACH_MARGIN)
  );
  if (!hosts.length) return null;
  return hosts.reduce((top, p) => (p.zIndex > top.zIndex ? p : top)).id;
}

/** Topmost collage under a page point (drop targets). */
export function hostAt(elements, point) {
  const hosts = elements.filter((p) => canHost(p) && containsPoint(p, point));
  return hosts.length ? hosts.reduce((top, p) => (p.zIndex > top.zIndex ? p : top)) : null;
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

const GEOMETRY = ["x", "y", "width", "height", "rotation"];
const geometryChanged = (a, b) => GEOMETRY.some((k) => a[k] !== b[k]);
const isChildOf = (parentId) => (el) => el.attachedTo === parentId;

function roundGeometry(patch) {
  return { x: Math.round(patch.x), y: Math.round(patch.y), rotation: Math.round(patch.rotation * 10) / 10 };
}

/**
 * Applies `patch` (object or fn of the element) to one element. A collage
 * carries its children along; any other element re-checks which collage, if
 * any, it now sits on. Leaving a collage lifts it to the top layer so it
 * can't vanish behind it.
 */
export function updateWithGroups(doc, id, patch) {
  const prev = doc.elements.find((el) => el.id === id);
  if (!prev) return doc; // late writes (an upload finishing after a delete) are no-ops
  const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
  let elements = doc.elements.map((el) => (el.id === id ? next : el));

  if (geometryChanged(prev, next)) {
    if (canHost(next)) {
      elements = elements.map((el) => (el.attachedTo === id ? { ...el, ...roundGeometry(followParent(el, prev, next)) } : el));
    } else {
      const target = attachTarget(elements, next);
      if (target !== (next.attachedTo ?? null)) {
        const lift = target ? {} : { zIndex: nextZIndex(elements) };
        elements = elements.map((el) => (el.id === id ? { ...el, attachedTo: target, ...lift } : el));
      }
    }
  }
  return { ...doc, elements };
}

/** New element, attached to whatever collage it lands on (unless told otherwise). */
export function withAttachment(elements, element) {
  if (element.attachedTo !== undefined) return element;
  return { ...element, attachedTo: attachTarget(elements, element) };
}

/** Removes an element and, for a collage, everything attached to it. */
export function removeWithGroups(elements, id) {
  return elements.filter((el) => el.id !== id && el.attachedTo !== id);
}

/** Copies an element 24px down-right; a collage brings copies of its children. */
export function duplicateWithGroups(elements, id, newId) {
  const source = elements.find((el) => el.id === id);
  if (!source) return elements;
  let z = nextZIndex(elements);
  const shift = (el) => ({ x: el.x + 24, y: el.y + 24 });
  const copy = { ...source, id: newId, ...shift(source), zIndex: z++ };
  const children = elements
    .filter(isChildOf(id))
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((el) => ({ ...el, id: makeElementId(), attachedTo: newId, ...shift(el), zIndex: z++ }));
  return [...elements, copy, ...children];
}

/** Elements in paint order: each top-level element by zIndex, its children right above it. */
export function paintOrder(elements) {
  const ids = new Set(elements.map((el) => el.id));
  const byZ = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const isChild = (el) => el.attachedTo && el.attachedTo !== el.id && ids.has(el.attachedTo);
  return byZ.filter((el) => !isChild(el)).flatMap((top) => [top, ...byZ.filter((el) => isChild(el) && el.attachedTo === top.id)]);
}

/** Swaps an element with its neighbour among its siblings (top-level, or children of the same collage). */
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
