import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// docs/reviews/findings.md is the one list of every bug and miss found. A sweep reads it instead of a
// hand-written "covered" list, so each row must say where it stands, and a fixed row must name the
// test that keeps it fixed, which must exist.
const root = join(import.meta.dir, "../../..");
// style-check.ts is part of the suite: `bun run e2e` ends with it, and CI fails on its findings.
const SUITE = ["packages/core/test", "packages/cli/test", "apps/desktop/test", "apps/desktop/e2e", "apps/phone/test", "apps/desktop/scripts/mock/style-check.ts"];

function files(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return /\.tsx?$/.test(dir) ? [dir] : []; // a single file
  }
  return entries.flatMap((e) => (e.isDirectory() ? (e.name === "fixtures" || e.name === "golden" ? [] : files(join(dir, e.name))) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
}

const suite = SUITE.flatMap((d) => files(join(root, d)))
  .filter((f) => !f.endsWith("findings.test.ts"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

const STATUS = /^(open|fixed #\d+|not a bug: .+|Tyler: .+|known limit: .+)$/;

export function rows(md: string) {
  return md
    .split("\n")
    .filter((l) => /^\| F\d+ \|/.test(l))
    .map((l) => {
      const [id, found, where, what, status, guard] = l.slice(1, -1).split(" | ").map((c) => c.trim());
      return { id, found, where, what, status, guard };
    });
}

const table = rows(readFileSync(join(root, "docs/reviews/findings.md"), "utf8"));

test("findings: every row has an ID in order, a date, a place, what happened and a known status", () => {
  expect(table.length).toBeGreaterThan(0);
  table.forEach((r, i) => {
    expect(r.id).toBe(`F${i + 1}`);
    expect(r.found).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.where.length).toBeGreaterThan(0);
    expect(r.what.length).toBeGreaterThan(0);
    expect({ id: r.id, status: STATUS.test(r.status) }).toEqual({ id: r.id, status: true });
  });
});

test("findings: a fixed row names a test the suite has, or says why no test can reach it", () => {
  const missing = table
    .filter((r) => r.status.startsWith("fixed"))
    .filter((r) => {
      if (/^no test: .+/.test(r.guard)) return false;
      const name = r.guard.match(/^`(.+)`$/)?.[1];
      return !name || !suite.includes(name);
    })
    .map((r) => `${r.id}: ${r.guard}`);
  expect(missing).toEqual([]);
});

test("findings: a row that isn't fixed has no guard yet", () => {
  expect(table.filter((r) => !r.status.startsWith("fixed") && r.guard !== "—").map((r) => r.id)).toEqual([]);
});
