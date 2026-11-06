import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addHighlight, readAnnotations } from "../src/annotations.ts";
import { regionsFrom, tidyLatex, type Region } from "../src/ingest/docling.ts";
import { pdfToDoc } from "../src/ingest/pdf.ts";
import { addSource, addText, readTables, tablesState, reimportSource, undoReimport } from "../src/ingest/index.ts";
import { findItem, updateItemMeta } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";

// D125: pdf.js reads a PDF's prose; Docling, an optional Mac download, reads its tables and display
// formulas, and those regions replace pdf.js's lines by their place on the page. tables.pdf comes from
// fixtures/intake/make-tables-pdf.py and tables.docling.json is Docling's real reading of it.

const FIX = join(import.meta.dir, "fixtures", "intake", "files");
const LAYOUT = join(FIX, "tables.docling.json");

/** A stand-in for the docling CLI: writes the saved reading into --output, as the real one does. */
function fakeDocling(fail = false): string {
  const bin = join(mkdtempSync(join(tmpdir(), "ore-docling-bin-")), "docling");
  writeFileSync(bin, fail ? `#!/bin/sh\necho "RuntimeError: out of memory" >&2\nexit 1\n` : `#!/bin/sh\nwhile [ "$1" != "--output" ]; do shift; done\ncp "${LAYOUT}" "$2/tables.json"\n`);
  chmodSync(bin, 0o755);
  return bin;
}

const was = process.env.ORE_DOCLING;
afterEach(() => {
  if (was === undefined) delete process.env.ORE_DOCLING;
  else process.env.ORE_DOCLING = was;
});

const TABLE = "| Schedule | Learners | Day 1 | Day 30 |\n| --- | --- | --- | --- |\n| Spaced | 412 | 91% | 74% |\n| Massed | 398 | 93% | 41% |\n| Control | 120 | 88% | 37% |";
const PROSE = ["Learners who spread their reviews out remembered more a month later", "Table 1: Recall after one day and after thirty days.", "at a rate set by its stability S:", "Each successful review raises S, so the next gap can be longer than the last one."];

describe("PDF tables and formulas (D125)", () => {
  test("PDF: tables and display formulas read by Docling replace their lines, the prose stays as it was", async () => {
    const lib = await tempLibrary();
    const item = await addSource(lib, join(FIX, "tables.pdf"));
    // Without Docling the table's cells run into the text as lines, and the source says it has a table.
    expect(item.body).not.toContain("| Schedule |");
    expect(item.meta.structure).toEqual(["tables"]);
    process.env.ORE_DOCLING = "/nope/docling";
    expect(tablesState(lib, item)).toEqual({ tables_reader: false });
    for (const s of PROSE) expect(item.body).toContain(s);
    const kept = addHighlight(item, { exact: "Each successful review raises S", intent: "card" });

    process.env.ORE_DOCLING = fakeDocling();
    const r = await readTables(lib, item.meta.id);
    expect(r.changed).toBe(true);
    expect(r.regions).toBe(2);
    const now = findItem(lib, item.meta.id);
    expect(now.body).toContain("## Spacing and recall\n\nLearners who spread");
    expect(now.body).toContain(`group.\n\n${TABLE}\n\nTable 1:`);
    expect(now.body).toContain("stability S:\n\n$$\nR ( t ) = e ^ { - t / S } , \\quad S _ { n + 1 } = S _ { n } \\cdot ( 1 + a )\n$$\n\nEach successful");
    for (const s of PROSE) expect(now.body).toContain(s);
    expect(now.body).not.toMatch(/412\s+91%/); // the cells are not also left as a line
    expect(readAnnotations(now).find((a) => a.id === kept.id)?.status).not.toBe("orphaned");
    expect(existsSync(join(now.dir, "layout.json"))).toBe(true);
    expect(tablesState(lib, now)).toEqual({ tables: "read" });

    // The reading is kept: a later reimport (a better pdf.js reader) keeps the tables without Docling.
    delete process.env.ORE_DOCLING;
    expect((await reimportSource(lib, item.meta.id)).changed).toBe(false);
    expect(findItem(lib, item.meta.id).body).toContain(TABLE);

    // Undo takes the tables back out, and the reading with them.
    const back = await undoReimport(lib, item.meta.id);
    expect(back.body).not.toContain("| Schedule |");
    expect(existsSync(join(back.dir, "layout.json"))).toBe(false);
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

  test("reading tables says what to do when Docling is missing or fails, and leaves the source as it was", async () => {
    const lib = await tempLibrary();
    const item = await addSource(lib, join(FIX, "tables.pdf"));
    process.env.ORE_DOCLING = "/nope/docling";
    await expect(readTables(lib, item.meta.id)).rejects.toThrow(/isn't installed.*Settings/);
    process.env.ORE_DOCLING = fakeDocling(true);
    await expect(readTables(lib, item.meta.id)).rejects.toThrow("couldn't read this PDF: RuntimeError: out of memory");
    // The reader shows why at once, not a wait on a run that already died.
    expect(tablesState(lib, item)).toEqual({ tables_error: "The table and formula reader couldn't read this PDF: RuntimeError: out of memory", tables_reader: true });
    expect(findItem(lib, item.meta.id).body).toBe(item.body);
    const text = await addText(lib, "# Spacing\n\nSpaced practice beats massed practice.");
    await expect(readTables(lib, text.meta.id)).rejects.toThrow("Only a PDF source");
  });

  test("a formula Docling finds inside a table is one of its cells, and a label row lower down stays in the body", async () => {
    const regions = regionsFrom(JSON.parse(readFileSync(LAYOUT, "utf8")));
    const t = regions.find((r) => r.kind === "table")!;
    if (t.kind !== "table") throw new Error("no table");
    // Docling marks a row near the bottom as a header too (ResNet's "FLOPs" row).
    const marked: Region = { ...t, cells: t.cells.map((c) => (c.row === 3 ? { ...c, header: true } : c)) };
    const inner: Region = { kind: "formula", page: 1, box: t.cells[5]!.box, latex: "412" };
    const body = (await pdfToDoc(new Uint8Array(readFileSync(join(FIX, "tables.pdf"))), [marked, inner, ...regions.filter((r) => r.kind === "formula")])).body;
    expect(body).toContain(TABLE);
    expect(body).not.toContain("$$\n412");
  });

  test("Docling's boxes are turned to bottom-left points, and its LaTeX made safe for KaTeX", () => {
    const [t] = regionsFrom({
      pages: { "1": { page_no: 1, size: { width: 612, height: 792 } } },
      tables: [{ prov: [{ page_no: 1, bbox: { l: 10, t: 100, r: 200, b: 160, coord_origin: "TOPLEFT" } }], data: { num_rows: 2, num_cols: 2, table_cells: [{ bbox: { l: 10, t: 100, r: 100, b: 130, coord_origin: "TOPLEFT" }, start_row_offset_idx: 0, start_col_offset_idx: 0, column_header: true, text: " A " }] } }],
    });
    expect(t).toMatchObject({ kind: "table", page: 1, box: { l: 10, r: 200, t: 692, b: 632 }, cells: [{ row: 0, col: 0, rows: 1, cols: 1, header: true, text: "A", box: { t: 692, b: 662 } }] });
    // A one-row "table" is a line Docling boxed, not a table.
    expect(regionsFrom({ tables: [{ prov: [{ page_no: 1, bbox: { l: 0, t: 1, r: 1, b: 0 } }], data: { num_rows: 1, num_cols: 3, table_cells: [{ bbox: { l: 0, t: 1, r: 1, b: 0 }, start_row_offset_idx: 0, start_col_offset_idx: 0 }] } }] })).toEqual([]);
    expect(tidyLatex("E = m c ^ { 2 } & & ( 3 )")).toBe("E = m c ^ { 2 } \\tag{3}");
    expect(tidyLatex("a & = b")).toBe("a = b");
    expect(tidyLatex("\\begin{aligned} a & = b \\end{aligned}")).toBe("\\begin{aligned} a & = b \\end{aligned}");
    expect(tidyLatex("f ( x ) = ( 2 )")).toBe("f ( x ) = ( 2 )"); // a bracket that isn't an equation number stays
  });
});
