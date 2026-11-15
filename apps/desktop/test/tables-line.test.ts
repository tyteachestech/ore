import { expect, test } from "bun:test";
import { tablesLine } from "../src/Tables";
import type { Doc } from "../src/ore";

const pdf = (over: Partial<Doc> = {}) => ({ id: "p", type: "pdf", structure: ["formulas", "tables"], ...over }) as Doc;

test("a PDF whose tables still read as plain text says so on the phone too, with the Mac as the next step (rehearsal 2026-11-15)", () => {
  expect(tablesLine(pdf(), true)).toBe("Formulas and tables in this PDF read as plain text. Open it on your Mac to read them properly.");
  expect(tablesLine(pdf({ structure: ["tables"] }), true)).toBe("Tables in this PDF read as plain text. Open it on your Mac to read them properly.");
  // The Mac shows its own line, with the button that reads them.
  expect(tablesLine(pdf(), false)).toBe("mac");
  // Nothing to say: read already, not a PDF, or no tables or formulas.
  expect(tablesLine(pdf({ tables: "read" }), true)).toBeNull();
  expect(tablesLine(pdf({ type: "article" } as Partial<Doc>), true)).toBeNull();
  expect(tablesLine(pdf({ structure: [] }), true)).toBeNull();
  // The Mac is reading them now; the result reaches the phone through sync.
  expect(tablesLine(pdf({ tables: "reading" }), true)).toBeNull();
});
