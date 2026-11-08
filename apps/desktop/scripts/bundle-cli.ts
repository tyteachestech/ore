// Builds the `ore` CLI as one file for the release app (tauri.release.json): the app carries it as
// Contents/MacOS/ore-cli (the app itself is Contents/MacOS/ore), so a friend needs no Bun or checkout.
// Usage: bun apps/desktop/scripts/bundle-cli.ts   (writes src-tauri/binaries/, which git ignores)
import { $ } from "bun";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../../..");
const out = join(import.meta.dir, "../src-tauri/binaries");
const triple = (await $`rustc -vV`.text()).match(/^host: (\S+)/m)?.[1];
if (!triple) throw new Error("rustc -vV printed no host triple");
mkdirSync(out, { recursive: true });
// --bytecode: the app runs `ore` for every read and write, and a compiled CLI that parses its 4 MB of
// JavaScript at each start took 130 ms a call; precompiled bytecode takes 25 ms (source via Bun: 75 ms).
await $`bun build --compile --minify --bytecode ${join(root, "packages/cli/src/ore.ts")} --outfile ${join(out, `ore-cli-${triple}`)}`;

console.log(`bundled ore-cli-${triple}`);
