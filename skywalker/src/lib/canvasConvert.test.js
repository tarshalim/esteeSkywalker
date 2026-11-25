import { describe, expect, it } from "vitest";
import { BLOCK_KIND } from "./blocks";
import { blocksToCanvas, canvasToBlocks, cloneCanvasDoc } from "./canvasConvert";
import { ELEMENT_KIND } from "./canvasElements";
import { importCanvasLayout } from "./canvasLayout";

const COLUMN = 794 - 64 * 2; // A4 width minus both margins

const text = (html, variant = "paragraph") => ({ id: "t", kind: BLOCK_KIND.TEXT, variant, html });
const image = (extra = {}) => ({ id: "i", kind: BLOCK_KIND.IMAGE, src: "https://x/a.jpg", caption: "", width: 100, ...extra });
const video = (extra = {}) => ({ id: "v", kind: BLOCK_KIND.VIDEO, url: "https://youtu.be/dQw4w9WgXcQ", width: 100, ...extra });

/** True when no two elements' vertical extents overlap. */
function stackedWithoutOverlap(elements) {
  const sorted = [...elements].sort((a, b) => a.y - b.y);
  return sorted.every((el, i) => i === 0 || sorted[i - 1].y + sorted[i - 1].height <= el.y);
}

describe("blocksToCanvas", () => {
  it("returns an empty doc for no blocks, null or undefined", () => {
    expect(blocksToCanvas([]).elements).toEqual([]);
    expect(blocksToCanvas().elements).toEqual([]);
    expect(blocksToCanvas(null).elements).toEqual([]);
  });

  it("converts text, image and video blocks in order, stacked without overlap", () => {
    const doc = blocksToCanvas([text("<p>Hello</p>"), image(), video()]);
    expect(doc.elements.map((el) => el.kind)).toEqual([ELEMENT_KIND.TEXT, ELEMENT_KIND.IMAGE, ELEMENT_KIND.VIDEO]);
    expect(doc.elements.map((el) => el.zIndex)).toEqual([1, 2, 3]);
    expect(doc.elements.every((el) => el.x === 64)).toBe(true);
    expect(stackedWithoutOverlap(doc.elements)).toBe(true);
    expect(doc.elements[1].src).toBe("https://x/a.jpg");
    expect(doc.elements[2].url).toBe("https://youtu.be/dQw4w9WgXcQ");
  });

  it("maps text variants to their type styles, unknown variants to paragraph", () => {
    const [h1, quote, other] = blocksToCanvas([text("A", "h1"), text("B", "quote"), text("C", "weird")]).elements;
    expect(h1).toMatchObject({ fontSize: 36, fontWeight: 700, fontFamily: "serif" });
    expect(quote).toMatchObject({ fontStyle: "italic" });
    expect(other).toMatchObject({ fontSize: 18, fontFamily: "sans" });
  });

  it("skips empty blocks: blank text, image with no src, video with no url", () => {
    const doc = blocksToCanvas([text("<p><br></p>"), text("<p>&nbsp;</p>"), image({ src: "" }), video({ url: "" }), null]);
    expect(doc.elements).toEqual([]);
  });

  it("converts textbox blocks as text, keeping their width share", () => {
    const [el] = blocksToCanvas([{ id: "b", kind: BLOCK_KIND.TEXTBOX, html: "Hi", columns: 1, width: 50 }]).elements;
    expect(el.kind).toBe(ELEMENT_KIND.TEXT);
    expect(el.width).toBe(Math.round(COLUMN / 2));
  });

  it("keeps an image's or video's width share, clamped to 25–100 %", () => {
    const [half, tiny, vid] = blocksToCanvas([image({ width: 50 }), image({ width: 5 }), video({ width: 60 })]).elements;
    expect(half.width).toBe(Math.round(COLUMN / 2));
    expect(tiny.width).toBe(Math.round(COLUMN / 4));
    expect(vid.width).toBe(Math.round(COLUMN * 0.6));
    expect(vid.height).toBe(Math.round((vid.width * 9) / 16));
  });

  it("keeps an image caption as an escaped text element right under the image", () => {
    const doc = blocksToCanvas([image({ caption: "  Sunset <at> Ubud & co  " }), text("After")]);
    const [img, caption, after] = doc.elements;
    expect(caption.kind).toBe(ELEMENT_KIND.TEXT);
    expect(caption.html).toBe("Sunset &#60;at&#62; Ubud &#38; co");
    expect(caption.width).toBe(img.width);
    expect(caption.y).toBeGreaterThan(img.y + img.height - 1);
    expect(caption.y - (img.y + img.height)).toBeLessThan(after.y - (caption.y + caption.height));
    expect(stackedWithoutOverlap(doc.elements)).toBe(true);
  });

  it("gives multi-paragraph text more height than the same characters on one line", () => {
    const words = "word ".repeat(6).trim();
    const oneLine = blocksToCanvas([text(`<p>${words}</p>`)]).elements[0];
    const sixParas = blocksToCanvas([text(words.split(" ").map((w) => `<p>${w}</p>`).join(""))]).elements[0];
    const withBreaks = blocksToCanvas([text(words.split(" ").join("<br>"))]).elements[0];
    expect(sixParas.height).toBeGreaterThan(oneLine.height * 3);
    expect(withBreaks.height).toBe(sixParas.height);
  });

  it("produces a doc the layout importer accepts unchanged", () => {
    const doc = blocksToCanvas([text("<p>Hi</p>"), image({ caption: "Cap" }), video()]);
    const imported = importCanvasLayout(JSON.parse(JSON.stringify(doc)));
    expect(imported.elements.map(({ id, x, y, width, height, zIndex }) => ({ id, x, y, width, height, zIndex }))).toEqual(
      doc.elements.map(({ id, x, y, width, height, zIndex }) => ({ id, x, y, width, height, zIndex })),
    );
  });
});

describe("canvasToBlocks", () => {
  it("round-trips a legacy post's content, the caption kept as a paragraph", () => {
    const blocks = canvasToBlocks(blocksToCanvas([text("<p>Intro</p>", "h1"), image({ caption: "Cap" }), video()]));
    expect(blocks.map((b) => b.kind)).toEqual([BLOCK_KIND.TEXT, BLOCK_KIND.IMAGE, BLOCK_KIND.TEXT, BLOCK_KIND.VIDEO]);
    expect(blocks[0].html).toBe("<p>Intro</p>");
    expect(blocks[1].src).toBe("https://x/a.jpg");
    expect(blocks[2].html).toBe("Cap");
    expect(blocks[3].url).toBe("https://youtu.be/dQw4w9WgXcQ");
  });

  it("orders by position (top, then left) and expands collages", () => {
    const doc = {
      elements: [
        { id: "b", kind: ELEMENT_KIND.IMAGE, x: 0, y: 200, src: "b.jpg" },
        { id: "a", kind: ELEMENT_KIND.IMAGE, x: 300, y: 10, src: "a2.jpg" },
        { id: "c", kind: ELEMENT_KIND.COLLAGE, x: 0, y: 10, collage: { items: [{ id: "1", src: "c1.jpg" }, { id: "2", src: "" }] } },
      ],
    };
    expect(canvasToBlocks(doc).map((b) => b.src)).toEqual(["c1.jpg", "a2.jpg", "b.jpg"]);
  });

  it("handles a missing doc", () => {
    expect(canvasToBlocks(null)).toEqual([]);
  });
});

describe("cloneCanvasDoc", () => {
  it("gives fresh ids, remaps attachments and doesn't share nested objects", () => {
    const src = blocksToCanvas([image(), text("Hi")]);
    src.elements[1].attachedTo = src.elements[0].id;
    const copy = cloneCanvasDoc(src);
    expect(copy.elements[0].id).not.toBe(src.elements[0].id);
    expect(copy.elements[1].attachedTo).toBe(copy.elements[0].id);
    copy.theme.paper.color = "#000";
    copy.elements[0].src = "changed";
    expect(src.theme.paper.color).not.toBe("#000");
    expect(src.elements[0].src).toBe("https://x/a.jpg");
  });
});
