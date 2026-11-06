// Makes files/book.epub: a two-chapter EPUB 3 with the parts a real book has (cover, contents page, endnotes file,
// metadata, headings, emphasis, a footnote, a table, code, a figure). The text is written for Ore and
// is AGPL like the rest of the repo. Run: bun make-book-epub.ts
import { strToU8, zipSync } from "fflate";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

// A 1×1 PNG, the smallest valid image.
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

const page = (title: string, body: string) => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:xlink="http://www.w3.org/1999/xlink">
<head><title>${title}</title><link rel="stylesheet" href="style.css"/></head>
<body>
${body}
</body>
</html>`;

const files: Record<string, Uint8Array> = {
  mimetype: strToU8("application/epub+zip"),
  "META-INF/container.xml": strToU8(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`),
  "OEBPS/content.opf": strToU8(`<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:5b0c1d3e-0000-4000-8000-0000000000e1</dc:identifier>
    <dc:title>A Small Book of Remembering</dc:title>
    <dc:creator>Ada Learner</dc:creator>
    <dc:creator>Ben Reviewer</dc:creator>
    <dc:date>2024-03-01</dc:date>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="notes" href="text/notes.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="img-cover" href="img/cover.png" media-type="image/png"/>
    <item id="img-curve" href="img/curve.png" media-type="image/png"/>
  </manifest>
  <spine><itemref idref="cover"/><itemref idref="nav"/><itemref idref="c1"/><itemref idref="c2"/><itemref idref="notes"/></spine>
</package>`),
  "OEBPS/style.css": strToU8("p { text-indent: 1em; }"),
  "OEBPS/cover.xhtml": strToU8(page("Cover", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><image xlink:href="img/cover.png" width="1" height="1"/></svg>`)),
  "OEBPS/nav.xhtml": strToU8(page("Contents", `<nav epub:type="toc"><h1>Contents</h1><ol><li><a href="text/ch1.xhtml">Forgetting</a></li><li><a href="text/ch2.xhtml">Practice</a></li></ol></nav>`)),
  "OEBPS/text/ch1.xhtml": strToU8(page("Forgetting", `<section epub:type="chapter">
<h1>1. Forgetting</h1>
<p>Most of what we read is gone within a week. That is not a flaw of <em>weak</em> minds; it is how <strong>every</strong> memory behaves when nothing calls it back.<a epub:type="noteref" href="#fn1" id="r1"><sup>1</sup></a></p>
<h2>The curve</h2>
<p>Recall drops fast at first and then levels off, so the first review matters most.</p>
<figure><img src="../img/curve.png" alt="A forgetting curve falling and then flattening"/><figcaption>Figure 1.1 How recall fades without review.</figcaption></figure>
<table>
<thead><tr><th>Days since reading</th><th>Recalled</th></tr></thead>
<tbody><tr><td>1</td><td>58%</td></tr><tr><td>7</td><td>25%</td></tr><tr><td>30</td><td>21%</td></tr></tbody>
</table>
<aside epub:type="footnote" id="fn1"><p>1. The numbers here are illustrative, not from one study.</p></aside>
</section>`)),
  "OEBPS/text/ch2.xhtml": strToU8(page("Practice", `<section epub:type="chapter">
<h1>2. Practice</h1>
<p>Calling a memory back, rather than rereading it, is what keeps it. The effort is the point.<sup><a epub:type="noteref" role="doc-noteref" href="notes.xhtml#en1" id="r2">2</a></sup></p>
<h2>Scheduling reviews</h2>
<p>A review scheduler only needs the last gap and how the answer went:</p>
<pre><code>def next_gap(gap, remembered):
    return gap * 2.5 if remembered else 1</code></pre>
<blockquote><p>Test yourself before you feel ready.</p></blockquote>
<ul><li>Spread sessions out.</li><li>Mix topics within a session.</li></ul>
<p>The last line of the book.</p>
</section>`)),
  // Endnotes in a file of their own, as Standard Ebooks and many publishers make them.
  "OEBPS/text/notes.xhtml": strToU8(page("Endnotes", `<section epub:type="endnotes" role="doc-endnotes">
<h2>Endnotes</h2>
<ol><li id="en1" epub:type="endnote" role="doc-endnote"><p>Psychologists call this the <em>testing effect</em>. <a href="ch2.xhtml#r2" epub:type="backlink" role="doc-backlink">↩</a></p></li></ol>
</section>`)),
  "OEBPS/img/cover.png": PNG,
  "OEBPS/img/curve.png": PNG,
};

// A fixed time stamp, so the file is the same each run.
const mtime = new Date("2024-03-01T00:00:00Z");
const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { mtime, level: k === "mimetype" ? 0 : 6 }]])));
writeFileSync(join(import.meta.dir, "files", "book.epub"), zip);
