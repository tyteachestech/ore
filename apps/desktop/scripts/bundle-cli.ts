// Builds the `ore` CLI as one file for the release app (tauri.release.json): the app carries it in
// Contents/MacOS, so a friend needs no Bun or checkout.
// Usage: bun apps/desktop/scripts/bundle-cli.ts   (writes src-tauri/binaries/, which git ignores)
import { $ } from "bun";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../../..");
const out = join(import.meta.dir, "../src-tauri/binaries");
const triple = (await $`rustc -vV`.text()).match(/^host: (\S+)/m)?.[1];
if (!triple) throw new Error("rustc -vV printed no host triple");
mkdirSync(out, { recursive: true });
await $`bun build --compile --minify ${join(root, "packages/cli/src/ore.ts")} --outfile ${join(out, `ore-${triple}`)}`;

console.log(`bundled ore-${triple}`);
