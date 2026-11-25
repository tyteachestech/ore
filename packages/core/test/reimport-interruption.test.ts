import { expect, test } from "bun:test";
import { copyFileSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { doctor } from "../src/doctor.ts";
import { addSource, reimportSource, undoReimport } from "../src/ingest/index.ts";
import { findItem } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";

async function setup() {
  const lib = await tempLibrary();
  const real = globalThis.fetch;
  let body = "# Source\n\nFirst version.\n";
  globalThis.fetch = (async () => new Response(body, { headers: { "content-type": "text/markdown" } })) as unknown as typeof fetch;
  try {
    const item = await addSource(lib, "https://example.com/undo.md");
    body = "# Source\n\nRevised version.\n";
    const { step } = await reimportSource(lib, item.meta.id);
    return { lib, item, step: step! };
  } finally { globalThis.fetch = real; }
}

test("Undo keeps an existing source readable, with all its files, at every document replacement boundary", async () => {
  const { lib, item, step } = await setup();
  // Isolate fs instrumentation so no other test sees it.
  const code = `
    import { mock } from "bun:test";
    import * as fs from "node:fs";
    const unlink = fs.unlinkSync, rename = fs.renameSync;
    mock.module("node:fs", () => ({ ...fs,
      // Stopped as any of the source's own files goes: both versions have them all, so none may go.
      unlinkSync(p) { unlink(p); if (String(p).startsWith(${JSON.stringify(item.dir + "/")})) process.exit(42); },
      renameSync(a,b) { if (String(b) === ${JSON.stringify(item.docPath)} && !fs.existsSync(b)) process.exit(43); rename(a,b); }
    }));
    const { undoReimport } = await import(${JSON.stringify(join(import.meta.dir, "../src/ingest/index.ts"))});
    await undoReimport(${JSON.stringify(lib)}, ${JSON.stringify(item.meta.id)}, ${JSON.stringify(step)});
  `;
  const child = Bun.spawnSync([process.execPath, "-e", code], { env: { ...process.env, ORE_NO_ENRICH: "1" } });
  expect(child.exitCode).toBe(0);
  expect(findItem(lib, item.meta.id).body).toContain("First version.");
});

for (const recover of ["Undo", "Doctor"] as const) test(`${recover} recovers a source missing after an older interrupted reimport`, async () => {
  const { lib, item, step } = await setup();
  const swap = join(lib.root, ".ore", "reimport", item.meta.id, step + ".swap");
  mkdirSync(swap);
  copyFileSync(item.docPath, join(swap, "doc.md"));
  unlinkSync(item.docPath);
  if (recover === "Undo") {
    await undoReimport(lib, item.meta.id, step);
    expect(findItem(lib, item.meta.id).body).toContain("First version.");
  } else {
    const report = await doctor(lib, { fix: true });
    expect(readFileSync(item.docPath, "utf8")).toContain("Revised version.");
    expect(report.fixed.some(s => s.includes("reimport"))).toBe(true);
  }
});

test("Doctor restores the saved original with its document after a partially copied Undo", async () => {
  const { lib, item, step } = await setup();
  const stash = join(lib.root, ".ore", "reimport", item.meta.id, step);
  const swap = stash + ".swap";
  mkdirSync(swap);
  for (const name of ["doc.md", "source.md"]) copyFileSync(join(item.dir, name), join(swap, name));
  unlinkSync(item.docPath);
  copyFileSync(join(stash, "source.md"), join(item.dir, "source.md"));
  await doctor(lib, { fix: true });
  expect(findItem(lib, item.meta.id).body).toContain("Revised version.");
  expect(readFileSync(join(item.dir, "source.md"), "utf8")).toContain("Revised version.");
});
