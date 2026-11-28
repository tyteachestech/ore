import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { addHighlight, readAnnotations } from "../src/annotations.ts";
import { cellsFrom, regionsFrom, tidyLatex, type PaddlePage, type Region } from "../src/ingest/paddle.ts";
import { pageViews, pdfToDoc } from "../src/ingest/pdf.ts";
import { addSource, addText, readTables, tablesState, reimportSource, undoReimport } from "../src/ingest/index.ts";
import { findItem, updateItemMeta } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";

// D125, D346: pdf.js reads a PDF's words; PaddleOCR-VL, an optional Mac download, reads
// each page's picture for its headings, tables and display formulas, and those regions shape pdf.js's
// lines by their place on the page. tables.pdf comes from fixtures/intake/make-tables-pdf.py;
// tables.paddle.json and scan.paddle.json are the reader's real readings of tables.pdf and scan.pdf
// on Tyler's Mac (2026-11-22).

const FIX = join(import.meta.dir, "fixtures", "intake", "files");
const LAYOUT = join(FIX, "tables.paddle.json");
const pdf = (name: string) => new Uint8Array(readFileSync(join(FIX, name)));
const regionsOf = async (name: string) => regionsFrom(JSON.parse(readFileSync(join(FIX, `${name}.paddle.json`), "utf8")) as PaddlePage[], await pageViews(pdf(`${name}.pdf`)));

/** A stand-in for the reader's Python, run as `<python> <script> <pdf> <out.json>`: writes the saved reading. */
function fakePaddle(fail = false): string {
  const bin = join(mkdtempSync(join(tmpdir(), "ore-paddle-bin-")), "python");
  writeFileSync(bin, fail ? `#!/bin/sh\necho "RuntimeError: out of memory" >&2\nexit 1\n` : `#!/bin/sh\ncp "${LAYOUT}" "$3"\n`);
  chmodSync(bin, 0o755);
  return bin;
}

const was = process.env.ORE_PADDLE;
afterEach(() => {
  if (was === undefined) delete process.env.ORE_PADDLE;
  else process.env.ORE_PADDLE = was;
});

const TABLE = "| Schedule | Learners | Day 1 | Day 30 |\n| --- | --- | --- | --- |\n| Spaced | 412 | 91% | 74% |\n| Massed | 398 | 93% | 41% |\n| Control | 120 | 88% | 37% |";
const PROSE = ["Learners who spread their reviews out remembered more a month later", "Table 1: Recall after one day and after thirty days.", "at a rate set by its stability S:", "Each successful review raises S, so the next gap can be longer than the last one."];

describe("PDF tables and formulas (D125)", () => {
  test("PDF: tables and display formulas read by the page reader replace their lines, the prose stays as it was", async () => {
    const lib = await tempLibrary();
    const item = await addSource(lib, join(FIX, "tables.pdf"));
    // Without the reader the table's cells run into the text as lines, and the source says it has a table.
    expect(item.body).not.toContain("| Schedule |");
    expect(item.meta.structure).toEqual(["tables"]);
    process.env.ORE_PADDLE = "/nope/python";
    expect(tablesState(lib, item)).toEqual({ tables_reader: false });
    for (const s of PROSE) expect(item.body).toContain(s);
    const kept = addHighlight(item, { exact: "Each successful review raises S", intent: "card" });

    process.env.ORE_PADDLE = fakePaddle();
    const r = await readTables(lib, item.meta.id);
    expect(r.changed).toBe(true);
    expect(r.regions).toBe(3); // a heading, a table and a formula
    const now = findItem(lib, item.meta.id);
    expect(now.body).toContain("## Spacing and recall\n\nLearners who spread");
    expect(now.body).toContain(`group.\n\n${TABLE}\n\nTable 1:`);
    expect(now.body).toContain("stability S:\n\n$$\nR(t)=e^{-t/S},\\quad S_{n+1}=S_{n}\\cdot(1+\\alpha)\n$$\n\nEach successful");
    for (const s of PROSE) expect(now.body).toContain(s);
    expect(now.body).not.toMatch(/412\s+91%/); // the cells are not also left as a line
    expect(readAnnotations(now).find((a) => a.id === kept.id)?.status).not.toBe("orphaned");
    expect(existsSync(join(now.dir, "layout.json"))).toBe(true);
    // Its step, for a read run in the background: the reader's Undo takes back exactly this one (review of #443).
    expect(tablesState(lib, now)).toEqual({ tables: "read", tables_step: r.step });

    // The reading is kept: a later reimport (a better pdf.js reader) keeps the tables without the reader.
    delete process.env.ORE_PADDLE;
    expect((await reimportSource(lib, item.meta.id)).changed).toBe(false);
    expect(findItem(lib, item.meta.id).body).toContain(TABLE);

    // Undo takes the tables back out, and the reading with them.
    const back = await undoReimport(lib, item.meta.id);
    expect(back.body).not.toContain("| Schedule |");
    expect(existsSync(join(back.dir, "layout.json"))).toBe(false);
  });

  test("ore tables reports the questions whose passage the read took away, as reimport does (review of #443)", async () => {
    const lib = await tempLibrary();
    const item = await addSource(lib, join(FIX, "tables.pdf"));
    const asked = addHighlight(item, { exact: "Spaced 412 91% 74% Massed 398 93% 41%", intent: "question", note: "Why does massed drop so far?" });
    const p = Bun.spawn(["bun", join(import.meta.dir, "../../cli/src/ore.ts"), "tables", item.meta.id, "--json"], { env: { ...process.env, ORE_LIBRARY: lib.root, ORE_NO_ENRICH: "1", ORE_PADDLE: fakePaddle() }, stdout: "pipe", stderr: "pipe" });
    const [out, code] = await Promise.all([new Response(p.stdout).text(), p.exited]);
    expect(code).toBe(0);
    const r = JSON.parse(out) as { changed: boolean; step?: string; unplaced?: { id: string; exact: string; intent: string }[] };
    expect(r.changed).toBe(true);
    expect(r.step).toBeTruthy();
    expect(r.unplaced).toEqual([{ id: asked.id, exact: asked.exact, intent: "question" }]);
  });

  test("a PDF link whose file was replaced reads the new file whole: the old file's reading is not laid on it (F581)", async () => {
    // The publisher replaced the PDF at the same address: what the reader saw in the old file describes other pages.
    const lib = await tempLibrary();
    const saved = globalThis.fetch;
    let file = "tables.pdf";
    globalThis.fetch = (async () => new Response(pdf(file), { headers: { "content-type": "application/pdf" } })) as unknown as typeof fetch;
    try {
      const item = await addSource(lib, "https://example.test/revised.pdf");
      process.env.ORE_PADDLE = fakePaddle();
      await readTables(lib, item.meta.id);
      expect(findItem(lib, item.meta.id).body).toContain(TABLE);
      delete process.env.ORE_PADDLE;
      file = "paper.pdf";
      const r = await reimportSource(lib, item.meta.id);
      const fresh = await pdfToDoc(pdf("paper.pdf"));
      expect(r.item.body).toBe(fresh.body);
      expect(r.item.body).not.toContain("| Spaced | 412");
      expect(existsSync(join(r.item.dir, "layout.json"))).toBe(false);
      // The same file again keeps its reading.
      file = "tables.pdf";
      await undoReimport(lib, item.meta.id);
      expect((await reimportSource(lib, item.meta.id)).changed).toBe(false);
      expect(findItem(lib, item.meta.id).body).toContain(TABLE);
    } finally {
      globalThis.fetch = saved;
    }
  });

  test("a PDF link that serves the same pages with a new download stamp keeps its saved reading (F581)", async () => {
    // Some hosts stamp each download (a trailer comment, a new date in its metadata): the pages and their words are the same.
    const lib = await tempLibrary();
    const saved = globalThis.fetch;
    const stamped = (n: number) => new Uint8Array([...pdf("tables.pdf"), ...new TextEncoder().encode(`\n% downloaded ${n}\n`)]);
    let n = 1;
    globalThis.fetch = (async () => new Response(stamped(n), { headers: { "content-type": "application/pdf" } })) as unknown as typeof fetch;
    try {
      const item = await addSource(lib, "https://example.test/stamped.pdf");
      process.env.ORE_PADDLE = fakePaddle();
      await readTables(lib, item.meta.id);
      delete process.env.ORE_PADDLE;
      n = 2;
      const r = await reimportSource(lib, item.meta.id);
      expect(r.changed).toBe(false);
      expect(findItem(lib, item.meta.id).body).toContain(TABLE);
      expect(existsSync(join(r.item.dir, "layout.json"))).toBe(true);
    } finally {
      globalThis.fetch = saved;
    }
  });

  test("a PDF of prose has nothing to offer; one added before tables were spotted learns it on reimport", async () => {
    const lib = await tempLibrary();
    const prose = await addSource(lib, join(FIX, "paper.pdf"));
    expect(prose.meta.structure).toBeUndefined();
    expect(tablesState(lib, prose)).toEqual({});
    const item = await addSource(lib, join(FIX, "tables.pdf"));
    await updateItemMeta(lib, item.meta.id, (m) => ({ ...m, structure: undefined }));
    expect((await reimportSource(lib, item.meta.id)).changed).toBe(false);
    expect(findItem(lib, item.meta.id).meta.structure).toEqual(["tables"]);
  });

  test("reading tables says what to do when the reader is missing or fails, and leaves the source as it was", async () => {
    const lib = await tempLibrary();
    const item = await addSource(lib, join(FIX, "tables.pdf"));
    process.env.ORE_PADDLE = "/nope/python";
    await expect(readTables(lib, item.meta.id)).rejects.toThrow(/isn't installed.*Settings/);
    process.env.ORE_PADDLE = fakePaddle(true);
    await expect(readTables(lib, item.meta.id)).rejects.toThrow("couldn't read this PDF: RuntimeError: out of memory");
    // The reader shows why at once, not a wait on a run that already died.
    expect(tablesState(lib, item)).toEqual({ tables_error: "The PDF page reader couldn't read this PDF: RuntimeError: out of memory", tables_reader: true });
    expect(findItem(lib, item.meta.id).body).toBe(item.body);
    const text = await addText(lib, "# Spacing\n\nSpaced practice beats massed practice.");
    await expect(readTables(lib, text.meta.id)).rejects.toThrow("Only a PDF source");
  });

  test("a formula the reader finds inside a table is one of its cells, and a label row lower down stays in the body", async () => {
    const regions = await regionsOf("tables");
    const t = regions.find((r) => r.kind === "table")!;
    if (t.kind !== "table") throw new Error("no table");
    // A reader may mark a row near the bottom as a header too (ResNet's "FLOPs" row).
    const marked: Region = { ...t, cells: t.cells.map((c) => (c.row === 3 ? { ...c, header: true } : c)) };
    const { l, r, t: top, b } = t.box;
    const inner: Region = { kind: "formula", page: 1, box: { l: l + (r - l) / 3, r: r - (r - l) / 3, t: top - (top - b) / 3, b: b + (top - b) / 3 }, latex: "412" };
    const body = (await pdfToDoc(pdf("tables.pdf"), [marked, inner, ...regions.filter((r) => r.kind === "formula")])).body;
    expect(body).toContain(TABLE);
    expect(body).not.toContain("$$\n412");
  });

  test.each([
    ["does not parse", "\\begin{aligned} R(t)&=e^{-t/S} \\\\ S_{n+1}&=S_n"],
    ["drops an equals sign", "R(t)=e^{-t/S},\\quad S_{n+1} S_n\\cdot(1+\\alpha)"],
  ])("PDF: keeps the original formula text when the page reader's LaTeX %s", async (_why, latex) => {
    const formula = (await regionsOf("tables")).find((r) => r.kind === "formula")!;
    const body = (await pdfToDoc(pdf("tables.pdf"), [{ ...formula, latex }])).body;
    expect(body).toContain("\n\n*R(t) = e*⁻*t/S*, *Sn+1 = Sn · (1 +* α)\n\n");
    expect(body).not.toContain("$$");
  });

  test("a cell, which has no box, takes pdf.js's own text for it where the two agree, so powers and bold stay", async () => {
    const t = (await regionsOf("tables")).find((r) => r.kind === "table")!;
    if (t.kind !== "table") throw new Error("no table");
    expect(t.cells.every((c) => !c.box)).toBe(true);
    // The model spells a cell its own way ("10 19" for a power); pdf.js's reading of the same characters wins.
    const odd: Region = { ...t, cells: t.cells.map((c) => (c.text === "91%" ? { ...c, text: "9 1 %" } : c.text === "Massed" ? { ...c, text: "Massed (crammed)" } : c)) };
    const body = (await pdfToDoc(pdf("tables.pdf"), [odd])).body;
    expect(body).toContain("| Spaced | 412 | 91% | 74% |");
    // A cell pdf.js has no match for keeps the model's text.
    expect(body).toContain("| Massed (crammed) | 398 | 93% | 41% |");
  });

  test("the reader's pixels are scaled onto the page's points, its HTML table laid on a grid, its LaTeX made safe for KaTeX", () => {
    const page: PaddlePage = { page: 1, width: 1224, height: 1584, blocks: [
      { label: "header", content: "Running head", bbox: [0, 0, 1224, 40] },
      { label: "paragraph_title", content: "## Methods", bbox: [100, 100, 400, 140] },
      { label: "text", content: "Each  $ x_n $ is drawn.", bbox: [100, 160, 1100, 200] },
      { label: "table", content: '<table><tr><td rowspan="2">Task</td><td colspan="2">No &amp; back</td></tr><tr><td>Mean</td><td>SD</td></tr><tr><td>Flexion</td><td>66</td><td>23</td></tr></table>', bbox: [20, 200, 400, 320] },
      { label: "table", content: "<table><tr><td>one row</td><td>is a line</td></tr></table>", bbox: [0, 0, 1, 1] },
      { label: "display_formula", content: " $$ E=mc^{2} \\quad (3) $$ ", bbox: [200, 400, 600, 440] },
    ] };
    const [whole, head, text, t, f, ...rest] = regionsFrom([page], [[0, 0, 612, 792]]);
    expect(rest).toEqual([]); // the running head and the one-row "table" are no regions
    expect(whole).toEqual({ kind: "page", page: 1, box: { l: 0, b: 0, r: 612, t: 792 }, by: "PaddleOCR-VL-1.6 (paddleocr 3.7.0)" });
    expect(head).toEqual({ kind: "text", page: 1, box: { l: 50, r: 200, t: 742, b: 722 }, text: "Methods", head: true });
    expect(text).toMatchObject({ kind: "text", text: "Each $x_n$ is drawn." });
    expect(t).toMatchObject({ kind: "table", box: { l: 10, r: 200, t: 692, b: 632 }, rows: 3, cols: 3 });
    expect(cellsFrom(page.blocks[3]!.content).cells.map((c) => [c.row, c.col, c.rows, c.cols, c.header, c.text])).toEqual([[0, 0, 2, 1, true, "Task"], [0, 1, 1, 2, true, "No & back"], [1, 1, 1, 1, false, "Mean"], [1, 2, 1, 1, false, "SD"], [2, 0, 1, 1, false, "Flexion"], [2, 1, 1, 1, false, "66"], [2, 2, 1, 1, false, "23"]]);
    expect(f).toMatchObject({ kind: "formula", latex: "E=mc^{2} \\tag{3}" });
    // A page with no size, or past the PDF's last page, is skipped.
    expect(regionsFrom([{ ...page, page: 2 }], [[0, 0, 612, 792]])).toEqual([]);
    // A page turned on its side is pictured turned: its boxes would land on the wrong text, so it has no regions.
    expect(regionsFrom([{ ...page, width: 1584, height: 1224 }], [[0, 0, 612, 792]])).toEqual([]);
    // Every block with words is text, a contents list and a reference too; a page number never is.
    expect(regionsFrom([{ ...page, blocks: [{ label: "content", content: "1 Intro 3", bbox: [0, 0, 9, 9] }, { label: "reference", content: "[1] A. Reader", bbox: [0, 9, 9, 19] }, { label: "number", content: "7", bbox: [0, 20, 9, 29] }] }], [[0, 0, 612, 792]]).map((r) => r.kind)).toEqual(["page", "text", "text"]);
    expect(tidyLatex("E = m c ^ { 2 } & & ( 3 )")).toBe("E = m c ^ { 2 } \\tag{3}");
    expect(tidyLatex("a & = b")).toBe("a = b");
    expect(tidyLatex("\\begin{aligned} a & = b \\end{aligned}")).toBe("\\begin{aligned} a & = b \\end{aligned}");
    expect(tidyLatex("f ( x ) = ( 2 )")).toBe("f ( x ) = ( 2 )"); // a bracket that isn't an equation number stays
    expect(tidyLatex("\\ F F N ( x ) = b _ { 2 } \\quad \\ \\ ( 3 )")).toBe("F F N ( x ) = b _ { 2 } \\tag{3}");
    expect(tidyLatex("\\mathcal { L } = p ( z ) \\, ( 7 )")).toBe("\\mathcal { L } = p ( z ) \\tag{7}");
  });

  test("PDF: on a page the reader read, a heading is what it saw as one, whatever the text's size", async () => {
    const regions = await regionsOf("tables");
    const caption = regions.find((r) => r.kind === "text" && r.text.startsWith("Table 1:"))!;
    // The reader calls the caption, set in the body's size, a heading, and the large title plain text.
    const swapped = regions.map((r): Region => (r === caption && r.kind === "text" ? { ...r, head: true } : r.kind === "text" && r.head ? { kind: "text", page: r.page, box: r.box, text: r.text } : r));
    const body = (await pdfToDoc(pdf("tables.pdf"), swapped)).body;
    expect(body).toContain("### Table 1: Recall after one day and after thirty days.");
    expect(body).not.toContain("## Spacing and recall");
    expect(body).toContain("Spacing and recall");
    // A page it has not read keeps the size rule.
    expect((await pdfToDoc(pdf("tables.pdf"))).body).toContain("## Spacing and recall");
  });

  test("PDF: a designed page drawn out of order is read in the reader's order, unless that order climbs back up a column", async () => {
    // columns.pdf (make-columns-pdf.py) draws its right-hand column first, so pdf.js reads it first.
    const data = pdf("columns.pdf");
    const drawn = (await pdfToDoc(data)).body;
    expect(drawn.indexOf("Second, test yourself")).toBeLessThan(drawn.indexOf("First, spread"));
    const whole: Region = { kind: "page", page: 1, box: { l: 0, b: 0, r: 612, t: 792 } };
    const left: Region = { kind: "text", page: 1, box: { l: 66, r: 300, t: 716, b: 664 }, text: "First" };
    const right: Region = { kind: "text", page: 1, box: { l: 324, r: 560, t: 716, b: 664 }, text: "Second" };
    const body = (await pdfToDoc(data, [whole, left, right])).body;
    expect(body).toContain("as the memory starts to fade.\n\nSecond, test yourself before you feel ready, since recalling an idea strengthens it more than reading.");
    expect(body.startsWith("<!-- page 1 -->\n\nFirst, spread your reviews out over days")).toBe(true);
    // An order that climbs back up a column is the reader's mistake (seen on two-column papers): the PDF's own order stands.
    const top = (r: Region, t: number, b: number): Region => ({ ...r, box: { ...r.box, t, b } });
    const climbing = [whole, top(left, 690, 664), top(right, 716, 664), top(left, 716, 691)];
    expect((await pdfToDoc(data, climbing)).body).toBe(drawn);
  });

  test("PDF: text at the top of a column that the reader left out of every block is read where it sits, before that column's next block (F745)", async () => {
    // BERT's page 4: the reader boxed the right column from its second block down, so the first one,
    // drawn after a block in the left column, followed the whole page and came after Task #2.
    // columns.pdf draws its right column first; here the reader misses the left column's first line.
    const whole: Region = { kind: "page", page: 1, box: { l: 0, b: 0, r: 612, t: 792 } };
    const left: Region = { kind: "text", page: 1, box: { l: 66, r: 300, t: 693, b: 664 }, text: "days" };
    const right: Region = { kind: "text", page: 1, box: { l: 324, r: 560, t: 716, b: 664 }, text: "Second" };
    const body = (await pdfToDoc(pdf("columns.pdf"), [whole, left, right])).body;
    expect(body.indexOf("First, spread")).toBeGreaterThanOrEqual(0);
    expect(body.indexOf("First, spread")).toBeLessThan(body.indexOf("days, so that"));
    expect(body.indexOf("as the memory starts to fade.")).toBeLessThan(body.indexOf("Second, test yourself"));
  });

  test("PDF: two headings one after the other stay two, and a page that is one picture and a caption keeps the picture's words in it", async () => {
    const regions = await regionsOf("tables");
    const caption = regions.find((r) => r.kind === "text" && r.text.startsWith("Table 1:"))!;
    const next = regions.find((r) => r.kind === "text" && r.text.startsWith("The chance"))!;
    const both = regions.map((r): Region => ((r === caption || r === next) && r.kind === "text" ? { ...r, head: true } : r));
    const body = (await pdfToDoc(pdf("tables.pdf"), both)).body;
    expect(body).toContain("### Table 1: Recall after one day and after thirty days.\n\n### The chance of recalling");
    // columns.pdf has six lines of its own: a block of prose the reader saw where the page has none is a picture's.
    const whole: Region = { kind: "page", page: 1, box: { l: 0, b: 0, r: 612, t: 792 } };
    const shot: Region = { kind: "text", page: 1, box: { l: 72, r: 540, t: 400, b: 200 }, text: "File Edit View" };
    expect((await pdfToDoc(pdf("columns.pdf"), [whole, shot])).body).not.toContain("File Edit View");
  });

  test("one PDF is read at a time: a second read waits for the first, and a lock left by a run that died is taken over", async () => {
    const lib = await tempLibrary();
    const a = await addSource(lib, join(FIX, "tables.pdf"));
    const b = await addSource(lib, join(FIX, "paper.pdf"));
    const log = join(mkdtempSync(join(tmpdir(), "ore-paddle-log-")), "log");
    const bin = join(mkdtempSync(join(tmpdir(), "ore-paddle-bin-")), "python");
    writeFileSync(bin, `#!/bin/sh\necho start >> "${log}"\nsleep 0.3\necho end >> "${log}"\necho "[]" > "$3"\n`);
    chmodSync(bin, 0o755);
    process.env.ORE_PADDLE = bin;
    // Its own lock, never the one a real read on this machine holds.
    const lock = (process.env.ORE_PADDLE_LOCK = join(dirname(log), "lock"));
    writeFileSync(lock, "999999999");
    try {
      await Promise.all([readTables(lib, a.meta.id), readTables(lib, b.meta.id)]);
    } finally {
      delete process.env.ORE_PADDLE_LOCK;
    }
    expect(readFileSync(log, "utf8")).toBe("start\nend\nstart\nend\n");
    expect(readdirSync(dirname(log))).toEqual(["log"]);
  });

  test("PDF: a scanned page, which has no text of its own, takes the reader's; a picture's words on a page with text stay in the picture", async () => {
    const body = (await pdfToDoc(pdf("scan.pdf"), await regionsOf("scan"))).body;
    expect(body).toBe("<!-- page 1 -->\n\n### The testing effect\n\nRetrieving a memory makes it stronger than reading it again. Quiz yourself before you feel ready.\n");
    // On tables.pdf, which has its own text, a block of prose the page has no text for is left out; a caption or a table is not.
    const regions = await regionsOf("tables");
    const empty = { l: 400, r: 600, t: 80, b: 60 };
    const added: Region[] = [...regions, { kind: "text", page: 1, box: empty, text: "Call me Ishmael." }, { kind: "text", page: 1, box: { ...empty, t: 50, b: 40 }, text: "Figure 2: a screenshot.", caption: true }];
    const mixed = (await pdfToDoc(pdf("tables.pdf"), added)).body;
    expect(mixed).not.toContain("Ishmael");
    expect(mixed).toContain("the last one.\n\nFigure 2: a screenshot.");
  });

  test("PDF: a scanned page between text pages keeps the page reader's words", async () => {
    const regions = (await regionsOf("scan")).map((region) => ({ ...region, page: 2 }));
    const { body } = await pdfToDoc(pdf("mixed-scan.pdf"), regions);
    expect(body).toContain("<!-- page 2 -->\n\n### The testing effect\n\nRetrieving a memory makes it stronger than reading it again. Quiz yourself before you feel ready.\n\n<!-- page 3 -->");
  });

  test("PDF: on a page with its own text, what the reader wrote in a block of prose or a heading changes nothing, so it is not asked to read them (D357)", async () => {
    // The driver sends the reading model only tables, formulas, scans and captions with no text; this is the
    // rule that makes that safe. If the doc ever takes a prose block's words from the reader, this fails first.
    const pages = JSON.parse(readFileSync(join(FIX, "tables.paddle.json"), "utf8")) as PaddlePage[];
    const unread = pages.map((p) => ({ ...p, blocks: p.blocks.map((b) => (b.label === "table" || b.label.includes("formula") ? b : { ...b, content: "not what the page says" })) }));
    expect(unread.flatMap((p) => p.blocks).some((b) => b.content === "not what the page says")).toBe(true);
    const views = await pageViews(pdf("tables.pdf"));
    expect((await pdfToDoc(pdf("tables.pdf"), regionsFrom(unread, views))).body).toBe((await pdfToDoc(pdf("tables.pdf"), regionsFrom(pages, views))).body);
  });
});

test("tidyLatex: a line break's backslash before a number is not a separator", () => {
  expect(tidyLatex("a = b \\\\ ( 2 )")).toBe("a = b \\\\ ( 2 )");
  expect(tidyLatex("a = b \\quad ( 1 )")).toBe("a = b \\tag{1}");
});
