import { describe, expect, test } from "bun:test";
import { strToU8, zipSync } from "fflate";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { addSource, addText, backfillSource } from "../src/ingest/index.ts";
import { epubCover, pageImage, thumbnailFile } from "../src/ingest/thumbnail.ts";
import { tempLibrary } from "./helpers.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...Array.from({ length: 96 }, (_, i) => i)]);

function epub(opf: string, files: Record<string, Uint8Array> = {}) {
  return zipSync({
    mimetype: strToU8("application/epub+zip"),
    "META-INF/container.xml": strToU8('<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'),
    "OEBPS/content.opf": strToU8(opf),
    "OEBPS/ch1.xhtml": strToU8("<html><body><h1>One</h1><p>Some text in the first chapter of the book.</p></body></html>"),
    ...files,
  });
}

describe("thumbnails (D77)", () => {
  test("pageImage: og:image first, resolved against the page; then twitter, then apple-touch-icon", () => {
    const base = "https://example.com/blog/post";
    expect(pageImage('<head><meta name="twitter:image" content="/t.png"><meta property="og:image" content="img/og.jpg?a=1&amp;b=2"></head><body>', base)).toBe(
      "https://example.com/blog/img/og.jpg?a=1&b=2",
    );
    expect(pageImage("<head><meta content='https://cdn.x/t.png' name='twitter:image'></head>", base)).toBe("https://cdn.x/t.png");
    expect(pageImage('<head><link rel="apple-touch-icon" sizes="180x180" href="/icon.png"></head>', base)).toBe("https://example.com/icon.png");
    expect(pageImage('<head><link rel="icon" href="/favicon.ico"></head>', base)).toBeUndefined();
    expect(pageImage('<head><meta property="og:image" content="data:image/png;base64,AAAA"></head>', base)).toBeUndefined();
  });

  test("epubCover: cover-image property, else <meta name=cover>, else an image named cover", () => {
    const manifest = (item: string, meta = "") =>
      `<package><metadata><dc:title>B</dc:title>${meta}</metadata><manifest><item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/>${item}</manifest><spine><itemref idref="c1"/></spine></package>`;
    const img = { "OEBPS/images/front.png": PNG };
    expect(epubCover(epub(manifest('<item id="x" href="images/front.png" media-type="image/png" properties="cover-image"/>'), img))).toEqual({ ext: "png", data: PNG });
    expect(epubCover(epub(manifest('<item id="pic" href="images/front.png" media-type="image/png"/>', '<meta name="cover" content="pic"/>'), img))?.ext).toBe("png");
    expect(epubCover(epub(manifest('<item id="cover-jpg" href="images/front.png" media-type="image/jpeg"/>'), img))?.ext).toBe("jpg");
    expect(epubCover(epub(manifest('<item id="fig1" href="images/front.png" media-type="image/png"/>'), img))).toBeUndefined();
  });

  test("an EPUB added from a file gets its cover as thumbnail.*; pasted text gets none", async () => {
    const lib = await tempLibrary();
    const path = join(lib.root, "book.epub");
    writeFileSync(
      path,
      epub(
        '<package><metadata><dc:title>Book</dc:title><dc:creator>Ann Author</dc:creator></metadata><manifest><item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/><item id="cv" href="cover.png" media-type="image/png" properties="cover-image"/></manifest><spine><itemref idref="c1"/></spine></package>',
        { "OEBPS/cover.png": PNG },
      ),
    );
    const item = await addSource(lib, path);
    expect(item.meta.author).toBe("Ann Author");
    expect(thumbnailFile(item)).toBe(join(item.dir, "thumbnail.png"));
    expect(new Uint8Array(readFileSync(thumbnailFile(item)!))).toEqual(PNG);
    const text = await addText(lib, "# Notes\n\nJust text.");
    expect(thumbnailFile(text)).toBeUndefined();
    expect(await backfillSource(lib, text)).toEqual({ thumbnail: undefined, author: undefined });
  });

  test("backfill remakes a thumbnail that isn't a picture; a good one is kept", async () => {
    const lib = await tempLibrary();
    const path = join(lib.root, "book.epub");
    writeFileSync(
      path,
      epub(
        '<package><metadata><dc:title>Book</dc:title></metadata><manifest><item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/><item id="cv" href="cover.png" media-type="image/png" properties="cover-image"/></manifest><spine><itemref idref="c1"/></spine></package>',
        { "OEBPS/cover.png": PNG },
      ),
    );
    const item = await addSource(lib, path);
    writeFileSync(thumbnailFile(item)!, "<html>404</html>");
    await backfillSource(lib, item);
    expect(new Uint8Array(readFileSync(thumbnailFile(item)!))).toEqual(PNG);
  });
});
