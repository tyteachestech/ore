// Makes the small EPUBs the EPUB picture and chapter cases read (intake.test.ts):
// - files/plates.epub: a cover page whose picture the book doesn't hold, a chapter with a figure the book names
//   but doesn't hold, a plate page after it (img/discovery.png, a name with "cover" inside a word), a second
//   chapter, and a last plate page whose picture is missing.
// - files/chapters.epub, chapters-reordered.epub, chapters-renamed.epub: one two-chapter book as first made, with
//   its chapters swapped, and with its first chapter's heading reworded.
// The text is written for Ore and is AGPL like the rest of the repo. Run: bun make-study-epubs.ts
import { strToU8, zipSync } from "fflate";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// A 1×1 PNG, the smallest valid image.
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

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
function book(name: string, title: string, pages: Page[], images: { id: string; href: string; properties?: string }[] = [], held: Record<string, Uint8Array> = {}) {
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
${images.map((i) => `    <item id="${i.id}" href="${i.href}" media-type="image/${i.href.endsWith(".jpg") ? "jpeg" : "png"}"${i.properties ? ` properties="${i.properties}"` : ""}/>`).join("\n")}
  </manifest>
  <spine>${pages.map((p) => `<itemref idref="${p.id}"/>`).join("")}</spine>
</package>`),
    ...Object.fromEntries(pages.map((p) => [`OEBPS/${p.id}.xhtml`, strToU8(page(p.title, p.body))])),
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
