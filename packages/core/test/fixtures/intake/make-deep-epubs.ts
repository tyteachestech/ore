// Makes the small EPUBs for the books the deep import pass found broken (intake.test.ts, "EPUB: deep import pass"):
// - files/comic.epub: a comic: a cover, four pages that are each one picture, then a short afterword in words.
// - files/picture-book.epub: a fixed-layout picture book whose spine lists its pages as images, with no text page.
// - files/code-book.epub: examples in <pre> with no <code> inside, one of them holding markup, prose after each.
// - files/prefixed-opf.epub: a package file that writes every element with an opf: prefix.
// - files/note-book.epub: a note reference to an <aside epub:type="note">.
// - files/math-book.epub: MathML, inline and display, one with a TeX annotation and one without.
// - files/table-book.epub: a table whose cells hold pictures, and a play's verse laid out in a table.
// The text is written for Ore and is AGPL like the rest of the repo. Run: bun make-deep-epubs.ts
import { strToU8, zipSync } from "fflate";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const PNG = (n: number) => {
  // A 1×1 PNG, a different colour per page so each saves under its own name.
  const base = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
  const out = new Uint8Array(base.length + 1);
  out.set(base);
  out[base.length] = n; // a trailing byte past IEND: still a valid picture to a reader, and a distinct file
  return out;
};

const page = (body: string) => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:xlink="http://www.w3.org/1999/xlink"><head><title>p</title></head><body>${body}</body></html>`;

const CONTAINER = `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;

type Item = { id: string; href: string; type: string; props?: string; body?: string | Uint8Array; spine?: boolean };

function book(name: string, title: string, items: Item[], opf?: (manifest: string, spine: string) => string) {
  const manifest = items.map((i) => `<item id="${i.id}" href="${i.href}" media-type="${i.type}"${i.props ? ` properties="${i.props}"` : ""}/>`).join("\n");
  const spine = items.filter((i) => i.spine).map((i) => `<itemref idref="${i.id}"/>`).join("");
  const pkg = opf?.(manifest, spine) ?? `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">ore-${name}</dc:identifier><dc:title>${title}</dc:title><dc:creator>Ore Fixtures</dc:creator><dc:language>en</dc:language></metadata>
<manifest>${manifest}</manifest><spine>${spine}</spine></package>`;
  const files: Record<string, Uint8Array> = { mimetype: strToU8("application/epub+zip"), "META-INF/container.xml": strToU8(CONTAINER), "OEBPS/content.opf": strToU8(pkg) };
  for (const i of items) if (i.body !== undefined) files[`OEBPS/${i.href}`] = typeof i.body === "string" ? strToU8(i.body) : i.body;
  writeFileSync(join(import.meta.dir, "files", name), zipSync(files));
}

const x = "application/xhtml+xml";

book("comic.epub", "The Lantern Thief", [
  { id: "cover-img", href: "img/cover.png", type: "image/png", props: "cover-image", body: PNG(0) },
  { id: "cover", href: "cover.xhtml", type: x, spine: true, body: page(`<div epub:type="cover"><img src="img/cover.png" alt="Cover"/></div>`) },
  ...[1, 2, 3, 4].flatMap((n) => [
    { id: `p${n}-img`, href: `img/p${n}.png`, type: "image/png", body: PNG(n) },
    { id: `p${n}`, href: `p${n}.xhtml`, type: x, spine: true, body: page(`<div><img src="img/p${n}.png" alt="Page ${n}"/></div>`) },
  ]),
  { id: "after", href: "after.xhtml", type: x, spine: true, body: page(`<h1>Afterword</h1><p>The thief was drawn first as a moth, then as a girl with a lantern.</p>`) },
]);

book("picture-book.epub", "Night Garden", [
  ...[1, 2, 3].map((n) => ({ id: `p${n}`, href: `img/p${n}.png`, type: "image/png", spine: true, body: PNG(n) })),
]);

book("code-book.epub", "Small Programs", [
  { id: "c1", href: "c1.xhtml", type: x, spine: true, body: page(`<h1>Loops</h1><p>A loop repeats its body.</p><pre class="programlisting">for i in range(3):
    print(i &lt; 2)</pre><p>The loop prints three lines.</p><pre>&lt;p&gt;Hello&lt;/p&gt;
&lt;!-- a comment --&gt;</pre><p>The page shows one paragraph.</p>`) },
]);

book("prefixed-opf.epub", "Prefixed Package", [
  { id: "c1", href: "c1.xhtml", type: x, spine: true, body: page(`<h1>One</h1><p>The package names every element with a prefix.</p>`) },
  { id: "c2", href: "c2.xhtml", type: x, spine: true, body: page(`<h1>Two</h1><p>The second chapter follows the first.</p>`) },
], (manifest, spine) => `<?xml version="1.0"?><opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="id"><opf:metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">ore-prefixed</dc:identifier><dc:title>Prefixed Package</dc:title><dc:creator>Ore Fixtures</dc:creator></opf:metadata>
<opf:manifest>${manifest.replace(/<item /g, "<opf:item ")}</opf:manifest><opf:spine>${spine.replace(/<itemref /g, "<opf:itemref ")}</opf:spine></opf:package>`);

book("note-book.epub", "Notes", [
  { id: "c1", href: "c1.xhtml", type: x, spine: true, body: page(`<h1>Rivers</h1><p>The river floods each spring.<a epub:type="noteref" href="#n1">1</a> The town moved uphill.</p><aside epub:type="note" id="n1"><p>1. Records begin in 1820.</p></aside>`) },
]);

const frac = `<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>1</mn><mn>2</mn></mfrac></math>`;
const display = `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><semantics><mrow><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><msqrt><mi>y</mi></msqrt></mrow><annotation encoding="application/x-tex">x^2 + \\sqrt{y}</annotation></semantics></math>`;
const sum = `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow><munderover><mo>∑</mo><mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow><mi>n</mi></munderover><msub><mi>a</mi><mi>i</mi></msub><mo>≤</mo><mi>α</mi></mrow></math>`;
book("math-book.epub", "Halves", [
  { id: "c1", href: "c1.xhtml", type: x, spine: true, body: page(`<h1>Halves</h1><p>Half is ${frac} of a whole.</p>${display}<p>And a sum:</p>${sum}<p>That is all.</p>`) },
]);

book("table-book.epub", "Signs and Lines", [
  { id: "up", href: "img/up.png", type: "image/png", body: PNG(7) },
  { id: "c1", href: "c1.xhtml", type: x, spine: true, body: page(`<h1>Signs</h1><table><tr><th>Metric</th><th>Trend</th></tr><tr><td>Visits</td><td><img src="img/up.png" alt="up"/></td></tr></table>
<h2>Scene one</h2><table><tr><td>1</td><td>Who keeps the gate tonight?<br/>The wind, my lord, and I.<br/>Then bar it well,<br/>and sleep beside it.</td></tr></table><p>Exit both.</p>`) },
]);
