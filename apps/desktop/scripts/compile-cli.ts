// The one way the `ore` CLI is compiled into a single file: for the release app (bundle-cli.ts), the
// compiled bench and the test that runs it (test/compiled-cli.test.ts), so what ships is what is tested.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const entry = join(import.meta.dir, "../../../packages/cli/src/ore.ts");

// Vega (charts drawn at import, F744) reaches vega-canvas, whose Node build awaits an optional `canvas` package at
// its top level, which a bytecode build can't hold. Its browser build answers "no canvas" the same way, and Vega
// then measures text by estimate, as it does with no `canvas` installed.
const vegaCanvas: import("bun").BunPlugin = {
  name: "vega-canvas-browser",
  setup(build) {
    build.onResolve({ filter: /^vega-canvas$/ }, (args) => {
      const pkg = createRequire(args.importer).resolve("vega-canvas/package.json");
      return { path: join(dirname(pkg), "build", "vega-canvas.browser.js") };
    });
  },
};

// --bytecode: the app runs `ore` for every read and write, and a compiled CLI that parses its 4 MB of
// JavaScript at each start took 130 ms a call; precompiled bytecode takes 25 ms (source via Bun: 75 ms).
export async function compileCli(outfile: string): Promise<void> {
  const r = await Bun.build({ entrypoints: [entry], compile: { outfile }, minify: true, bytecode: true, target: "bun", plugins: [vegaCanvas] });
  if (!r.success) throw new AggregateError(r.logs, `ore did not compile: ${r.logs.map(String).join("\n")}`);
}
