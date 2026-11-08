import { expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempLibrary } from "./helpers.ts";

const cli = join(import.meta.dir, "../../cli/src/ore.ts");
const ore = async (root: string, args: string[], stdin?: string) => {
  const p = Bun.spawn(["bun", cli, ...args, "--json"], { env: { ...process.env, ORE_LIBRARY: root, ORE_NO_ENRICH: "" }, stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin), stdout: "pipe", stderr: "pipe" });
  const out = await new Response(p.stdout).text();
  if ((await p.exited) !== 0) throw new Error(await new Response(p.stderr).text());
  return JSON.parse(out);
};

// The reader waits for prequestions only while an enrich is on its way: a source added with
// --no-enrich says so, instead of a "Writing prequestions…" that nothing is writing.
test("a source added with --no-enrich is listed and shown as not enriched on purpose", async () => {
  const lib = await tempLibrary();
  const added = await ore(lib.root, ["add", "--stdin", "--no-enrich"], "# Skipped on purpose\n\nNo enrich for this one.");
  expect(added.enrich).toBe("skipped");
  const listed = (await ore(lib.root, ["ls"])).find((i: { id: string }) => i.id === added.id);
  expect(listed.enrich_skipped).toBe(true);
  expect((await ore(lib.root, ["show", added.id])).enrich_skipped).toBe(true);
  const snip = await ore(lib.root, ["snippet", "--text", "A quote kept without enrich.", "--no-enrich"]);
  expect((await ore(lib.root, ["show", snip.id])).enrich_skipped).toBe(true);
});

// `ore ls` reads the logs folder once for every source, not a file check per source.
test("ls and show say why a source's last enrich failed, from the logs read once", async () => {
  const lib = await tempLibrary();
  const a = await ore(lib.root, ["add", "--stdin", "--no-enrich"], "# Failed once\n\nIts enrich died.");
  const b = await ore(lib.root, ["add", "--stdin", "--no-enrich"], "# Never enriched\n\nNothing logged.");
  writeFileSync(join(lib.root, ".ore", "logs", `enrich-${a.id}.error`), "Claude is signed out.");
  const listed = await ore(lib.root, ["ls"]);
  expect(listed.find((i: { id: string }) => i.id === a.id).enrich_error).toBe("Claude is signed out.");
  expect(listed.find((i: { id: string }) => i.id === b.id).enrich_error).toBeUndefined();
  expect(listed.find((i: { id: string }) => i.id === b.id).enrich_skipped).toBe(true);
  expect((await ore(lib.root, ["show", a.id])).enrich_error).toBe("Claude is signed out.");
});
