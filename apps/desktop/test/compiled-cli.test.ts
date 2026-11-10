import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileCli } from "../scripts/compile-cli.ts";

// The installed app runs a compiled `ore` (D30), and that file starts its own background work: the day's
// catch-up, a new source's enrich, card remixes, a PDF's tables. Compiled with --bytecode it no longer
// looked compiled to itself, started each job as `ore <checkout>/ore.ts catch-up`, and every one died
// with "unknown command" in a log nobody reads (Tyler's library, 2026-11-09). Every other test runs the
// CLI from source, so this one runs the file the app ships.
test("the compiled CLI starts its background work", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ore-compiled-"));
  const bin = join(dir, "ore-cli");
  await compileCli(bin);
  const env = { ...process.env, ORE_LIBRARY: join(dir, "library"), ORE_NO_ENRICH: "" };
  const run = async (...args: string[]) => expect(await Bun.spawn([bin, ...args], { env, stdout: "ignore", stderr: "inherit" }).exited).toBe(0);
  await run("init");
  await run("today", "--json"); // Home's first read starts the day's catch-up, detached
  const log = join(env.ORE_LIBRARY, ".ore/logs/catch-up.log");
  const said = () => (existsSync(log) ? readFileSync(log, "utf8") : "");
  for (let i = 0; i < 100 && !said().trim(); i++) await Bun.sleep(100);
  expect(said().trim()).toBe("Enriched 0 of 0");
}, 60_000);
