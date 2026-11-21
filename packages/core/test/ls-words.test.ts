import { expect, test } from "bun:test";
import { join } from "node:path";
import { tempLibrary } from "./helpers.ts";

const cli = join(import.meta.dir, "../../cli/src/ore.ts");
const ore = async (root: string, args: string[], stdin?: string) => {
  const p = Bun.spawn(["bun", cli, ...args, "--json"], { env: { ...process.env, ORE_LIBRARY: root, ORE_NO_ENRICH: "" }, stdin: stdin === undefined ? "ignore" : new TextEncoder().encode(stdin), stdout: "pipe", stderr: "pipe" });
  const out = await new Response(p.stdout).text();
  if ((await p.exited) !== 0) throw new Error(await new Response(p.stderr).text());
  return JSON.parse(out);
};

// Home's Continue reading says how long is left of a source (D341): `ore ls` counts its words.
test("ore ls says how many words each source holds", async () => {
  const lib = await tempLibrary();
  const added = await ore(lib.root, ["add", "--stdin", "--no-enrich"], "# Counted\n\nOne two three four five.");
  const listed = (await ore(lib.root, ["ls"])).find((i: { id: string }) => i.id === added.id);
  expect(listed.words).toBeGreaterThanOrEqual(5);
  expect(listed.words).toBeLessThanOrEqual(8);
});
