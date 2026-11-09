import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// A modal dialog keeps Tab inside it (Trap.tsx): without one, ⇧Tab reaches the page behind, where Esc no
// longer closes the dialog and Enter runs what is under it (the Delete skill dialog, Codex sweep 1).
const SRC = join(import.meta.dir, "../src");
const files = readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".tsx") && !f.startsWith("phone/"));

test.each(files.filter((f) => readFileSync(join(SRC, f), "utf8").includes('aria-modal="true"')))("%s: every aria-modal dialog sits in a <Trap>", (f) => {
  const s = readFileSync(join(SRC, f), "utf8");
  expect(s.split("<Trap").length - 1).toBeGreaterThanOrEqual(s.split('aria-modal="true"').length - 1);
});
