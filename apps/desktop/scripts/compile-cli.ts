// The one way the `ore` CLI is compiled into a single file: for the release app (bundle-cli.ts), the
// compiled bench and the test that runs it (test/compiled-cli.test.ts), so what ships is what is tested.
import { $ } from "bun";
import { join } from "node:path";

const entry = join(import.meta.dir, "../../../packages/cli/src/ore.ts");

// --bytecode: the app runs `ore` for every read and write, and a compiled CLI that parses its 4 MB of
// JavaScript at each start took 130 ms a call; precompiled bytecode takes 25 ms (source via Bun: 75 ms).
export async function compileCli(outfile: string): Promise<void> {
  await $`bun build --compile --minify --bytecode ${entry} --outfile ${outfile}`.quiet();
}
