// Makes the small EPUBs the EPUB picture and chapter cases read (intake.test.ts):
// - files/plates.epub: a cover page whose picture the book doesn't hold, a chapter with a figure the book names
//   but doesn't hold, a plate page after it (img/discovery.png, a name with "cover" inside a word), a second
//   chapter, and a last plate page whose picture is missing.
// - files/chapters.epub, chapters-reordered.epub, chapters-renamed.epub: one two-chapter book as first made, with
//   its chapters swapped, and with its first chapter's heading reworded.
// - files/front-matter.epub: a trade publisher's book (F-new-front-matter): a title page, an unmarked page of links
//   with "Thank you for buying" and two newsletter buttons, an unmarked copyright notice, a dedication, then a
//   prologue the publisher marks "frontmatter", a part page and a chapter. Its cover is a real picture (400×600).
// - files/front-matter-plain.epub: an older book with no marks at all, only a contents file (NCX): a title page, a
//   copyright page, a contents page, a short note to the reader, a chapter, and a copyright page again at the back.
// The text is written for Ore and is AGPL like the rest of the repo. Run: bun make-study-epubs.ts
import { strToU8, zipSync, zlibSync } from "fflate";
import { crc32 } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// A 1×1 PNG, the smallest valid image.
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

/** A plain PNG of one colour, the size of a book's cover: big enough to open larger from the Reader's thumbnail. */
function cover(w: number, h: number, [r, g, b]: [number, number, number]) {
  const row = new Uint8Array(1 + w * 3);
  for (let x = 0; x < w; x++) row.set([r, g, b], 1 + x * 3);
  const raw = new Uint8Array(row.length * h);
  for (let y = 0; y < h; y++) raw.set(row, y * row.length);
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(strToU8(type), 4);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const head = new Uint8Array(13);
  new DataView(head.buffer).setUint32(0, w);
  new DataView(head.buffer).setUint32(4, h);
  head.set([8, 2, 0, 0, 0], 8);
  const parts = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", zlibSync(raw, { level: 9 })), chunk("IEND", new Uint8Array(0))];
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((at, p) => (png.set(p, at), at + p.length), 0);
  return png;
}

const page = (title: string, body: string) => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${title}</title></head>
<body>
${body}
</body>
</html>`;

type Page = { id: string; title: string; body: string; type?: string };

/** An EPUB 3 of these pages in spine order; `images` are the pictures the manifest names, `held` the ones it holds. */
function book(name: string, title: string, pages: Page[], images: { id: string; href: string; properties?: string }[] = [], held: Record<string, Uint8Array> = {}, ncx?: [label: string, id: string][]) {
  const files: Record<string, Uint8Array> = {
    mimetype: strToU8("application/epub+zip"),
    "META-INF/container.xml": strToU8(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`),
    "OEBPS/content.opf": strToU8(`<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:5b0c1d3e-0000-4000-8000-0000000000f${name.length}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator>Ada Learner</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
${pages.map((p) => `    <item id="${p.id}" href="${p.id}.xhtml" media-type="application/xhtml+xml"/>`).join("\n")}
${images.map((i) => `    <item id="${i.id}" href="${i.href}" media-type="image/${i.href.endsWith(".jpg") ? "jpeg" : "png"}"${i.properties ? ` properties="${i.properties}"` : ""}/>`).join("\n")}${ncx ? `\n    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>` : ""}
  </manifest>
  <spine>${pages.map((p) => `<itemref idref="${p.id}"/>`).join("")}</spine>
</package>`),
    ...Object.fromEntries(pages.map((p) => [`OEBPS/${p.id}.xhtml`, strToU8(page(p.title, p.body))])),
    ...(ncx
      ? {
          "OEBPS/toc.ncx": strToU8(`<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap>
${ncx.map(([label, id], i) => `  <navPoint id="n${i}" playOrder="${i + 1}"><navLabel><text>${label}</text></navLabel><content src="${id}.xhtml"/></navPoint>`).join("\n")}
</navMap></ncx>`),
        }
      : {}),
    ...Object.fromEntries(Object.entries(held).map(([href, data]) => [`OEBPS/${href}`, data])),
  };
  // A fixed time stamp, so the file is the same each run.
  const mtime = new Date("2024-03-01T00:00:00Z");
  writeFileSync(join(import.meta.dir, "files", name), zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { mtime, level: k === "mimetype" ? 0 : 6 }]]))));
}

book(
  "plates.epub",
  "A Field Book of Herons",
  [
    { id: "cover", title: "Cover", body: `<section epub:type="cover"><img src="img/cover.jpg" alt="A Field Book of Herons"/></section>` },
    { id: "survey", title: "The survey", body: `<h1>The survey</h1>\n<p>Each spring we counted the herons along the river.</p>\n<img src="img/map.png" alt="Map of the river survey"/>\n<p>The counts rose every year.</p>` },
    { id: "plate1", title: "Plate", body: `<img src="img/discovery.png" alt="The first nest we found"/>` },
    { id: "results", title: "Results", body: `<h1>Results</h1>\n<p>The colony doubled in five years.</p>` },
    { id: "plate2", title: "Plate", body: `<img src="img/field-notes.png" alt="A page of field notes"/>` },
  ],
  [
    { id: "cover-image", href: "img/cover.jpg", properties: "cover-image" },
    { id: "map", href: "img/map.png" },
    { id: "discovery", href: "img/discovery.png" },
    { id: "field-notes", href: "img/field-notes.png" },
  ],
  { "img/discovery.png": PNG },
);

const forgetting = (heading: string): Page => ({ id: "forgetting", title: "Forgetting", body: `<h1>${heading}</h1>\n<p>Memory fades quickly at first.</p>` });
const practice: Page = { id: "practice", title: "Practice", body: `<h1>Practice</h1>\n<p>Testing strengthens a memory.</p>` };
book("chapters.epub", "Two Chapters on Memory", [forgetting("Forgetting"), practice]);
book("chapters-reordered.epub", "Two Chapters on Memory", [practice, forgetting("Forgetting")]);
book("chapters-renamed.epub", "Two Chapters on Memory", [forgetting("How fast we forget"), practice]);

const words = (n: number, seed: string) => Array.from({ length: n }, (_, i) => `${seed} ${i + 1}.`).join(" ");
book(
  "front-matter.epub",
  "The Slow Lamp",
  [
    { id: "title", title: "Title", body: `<section epub:type="frontmatter titlepage"><img src="img/title.png" alt="The Slow Lamp"/></section>` },
    {
      id: "mini_toc",
      title: "The Slow Lamp",
      body: `<p><a href="prologue.xhtml">Begin Reading</a></p>\n<p><a href="contents.xhtml">Table of Contents</a></p>\n<p><a href="author.xhtml">A Note About the Author</a></p>\n<p><a href="copyright.xhtml">Copyright Page</a></p>\n<p><b>Thank you for buying this Lantern House ebook.</b></p>\n<p>To receive special offers and news of new books, sign up for our newsletters.</p>\n<p><a href="https://example.com/signup"><img src="img/signup.png" alt="Sign Up"/></a></p>\n<p>Or visit us online at <a href="https://example.com/newsletter">example.com/newsletter</a></p>`,
    },
    { id: "notice", title: "Copyright notice", body: `<section epub:type="frontmatter"><p>The author and publisher have provided this e-book to you for your personal use only. You may not make it publicly available in any way. Copyright infringement is against the law.</p></section>` },
    { id: "dedication", title: "Dedication", body: `<section epub:type="frontmatter dedication"><p>To the night shift, who kept the lamp lit</p></section>` },
    { id: "prologue", title: "Prologue", body: `<section epub:type="frontmatter prologue"><h1>Prologue: The First Evening</h1>\n<p>The lamp took an hour to warm, and nobody hurried it.</p></section>` },
    { id: "part1", title: "Part I", body: `<section epub:type="bodymatter part"><h1>Part I</h1><h1>Light</h1></section>` },
    { id: "chapter1", title: "1", body: `<section epub:type="bodymatter chapter"><h1>1</h1><h1>What a Lamp Remembers</h1>\n<p>A wick trimmed each night burns evenly for years.</p></section>` },
  ],
  [
    { id: "title-image", href: "img/title.png" },
    { id: "signup", href: "img/signup.png" },
    { id: "cover-image", href: "img/cover.png", properties: "cover-image" },
  ],
  { "img/title.png": PNG, "img/signup.png": PNG, "img/cover.png": cover(400, 600, [38, 70, 83]) },
);
book(
  "front-matter-plain.epub",
  "Tide Tables for Beginners",
  [
    { id: "p1", title: "Tide Tables for Beginners", body: `<p>TIDE TABLES FOR BEGINNERS</p>\n<p>Ada Learner</p>` },
    { id: "p2", title: "Copyright", body: `<p>Copyright © 2019 by Ada Learner</p>\n<p>All rights reserved. No part of this book may be reproduced without written permission.</p>\n<p>ISBN 978-0-00-000000-2</p>` },
    { id: "p3", title: "Contents", body: `<p>CONTENTS</p>\n<p><a href="p4.xhtml">A Note to the Reader</a></p>\n<p><a href="p5.xhtml">1. Reading the Table</a></p>\n<p><a href="p6.xhtml">Copyright</a></p>` },
    { id: "p4", title: "A Note to the Reader", body: `<p>A NOTE TO THE READER</p>\n<p>Read chapter 1 with a real tide table open beside you.</p>` },
    { id: "p5", title: "1", body: `<p>1. READING THE TABLE</p>\n<p>${words(40, "High water comes later each day")}</p>` },
    { id: "p6", title: "Copyright", body: `<p>Copyright © 2019 by Ada Learner. All rights reserved.</p>` },
  ],
  [],
  {},
  [
    ["Title Page", "p1"],
    ["Copyright", "p2"],
    ["Contents", "p3"],
    ["A Note to the Reader", "p4"],
    ["1. Reading the Table", "p5"],
    ["Copyright", "p6"],
  ],
);
