import { describe, expect, it } from "vitest";
import { blogPreview, htmlToText, truncateText } from "./blogPreview";
import { createDecorElement, createImageElement, createTextElement } from "./canvasElements";

describe("htmlToText", () => {
  it("separates lines without splitting styled words", () => {
    expect(htmlToText("Short Hike 🏔️<div>Main <b>att</b>ractions</div><div><br></div><div>→ Pearl Lake</div>")).toBe(
      "Short Hike 🏔️ Main attractions → Pearl Lake"
    );
  });

  it("decodes entities once and leaves unknown ones alone", () => {
    expect(htmlToText("Tea&nbsp;&amp;&#32;cake &#x1F370; &amp;lt; &bogus;")).toBe("Tea & cake 🍰 &lt; &bogus;");
  });

  it("drops script, style and comments", () => {
    expect(htmlToText("<style>p{color:red}</style>Hi<!-- note --><script>alert(1)</script> there")).toBe("Hi there");
  });

  it("keeps a bare < in prose, and handles nothing", () => {
    expect(htmlToText("5 < 6 and 7 > 2")).toBe("5 < 6 and 7 > 2");
    expect(htmlToText(undefined)).toBe("");
  });
});

describe("truncateText", () => {
  it("leaves short text alone", () => {
    expect(truncateText("short", 10)).toBe("short");
  });

  it("cuts at a word and tidies trailing punctuation", () => {
    expect(truncateText("We hiked to the lake, and then we slept", 24)).toBe("We hiked to the lake…");
  });

  it("cuts unspaced text without halving an emoji", () => {
    expect(truncateText("aaaaaaaa🍂🍂🍂", 10)).toBe("aaaaaaaa…");
  });
});

describe("blogPreview", () => {
  const text = (html, y) => createTextElement({ html, y });

  it("reads the canvas top to bottom, skipping decorations and a heading that repeats the title", () => {
    const blog = {
      title: "Pearl Lake",
      excerpt: "A summary",
      canvas: {
        elements: [
          text("<div>The lake was calm.</div>", 300),
          text("Pearl Lake", 10),
          createDecorElement("stamp-postage", { y: 20, html: "Par avion" }),
          text("…", 30),
          text("We arrived early.", 200),
        ],
      },
    };
    expect(blogPreview(blog)).toEqual({ text: "We arrived early. The lake was calm.", isFallback: false, thumb: "" });
  });

  it("reads legacy block posts", () => {
    const blog = { blocks: [{ kind: "text", html: "<p>Hello</p>" }, { kind: "image", src: "a.jpg" }] };
    expect(blogPreview(blog)).toEqual({ text: "Hello", isFallback: false, thumb: "a.jpg" });
  });

  it("falls back to the summary when nothing is written yet", () => {
    expect(blogPreview({ excerpt: " City by city ", blocks: [] })).toMatchObject({ text: "City by city", isFallback: false });
  });

  it("describes a photo-only post by its place", () => {
    const blog = { location: { name: "Bipenggou" }, canvas: { elements: [createImageElement({ src: "p.jpg" })] } };
    expect(blogPreview(blog)).toEqual({ text: "Photo & canvas journal entry from Bipenggou", isFallback: true, thumb: "p.jpg" });
    expect(blogPreview({ ...blog, location: undefined }).text).toBe("Photo & canvas journal entry");
  });

  it("doesn't promise photos an empty post doesn't have", () => {
    expect(blogPreview({})).toEqual({ text: "Canvas journal entry", isFallback: true, thumb: "" });
  });

  it("prefers the cover, ignores the legacy stock one, and takes a video's poster", () => {
    const blocks = [{ kind: "video", url: "https://youtu.be/dQw4w9WgXcQ" }, { kind: "image", src: "a.jpg" }];
    expect(blogPreview({ coverImage: "c.jpg", blocks }).thumb).toBe("c.jpg");
    expect(blogPreview({ coverImage: "https://picsum.photos/seed/new-post/1600/900", blocks }).thumb).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    );
  });
});
