import { afterAll, beforeAll, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REWRITTEN } from "../eval/ask.ts";
import { addSource, addText } from "../src/ingest/index.ts";
import { tempLibrary } from "./helpers.ts";
import { CASES, FIX } from "./golden-cases.ts";

// Golden imports (D122): one saved example of each kind of source, and the whole doc.md Ore makes
// from it, kept in test/golden/. intake.test.ts checks the parts a learner needs; this catches any
// other change to what comes in, so import quality can't slip without a diff in the PR.
// After a change you mean, rewrite them with `bun run golden:update` and read the diff.

const GOLDEN = join(import.meta.dir, "golden");
const UPDATE = process.env.ORE_UPDATE_GOLDEN === "1";

// The desktop tests leave happy-dom's globals behind; the CLI, where intake runs, has none (intake.test.ts).
const g = globalThis as Record<string, unknown>;
const leaked = { window: g.window, getComputedStyle: g.getComputedStyle };
const realFetch = globalThis.fetch;
const realPath = process.env.PATH;
const realTranscribe = process.env.ORE_TRANSCRIBE;
beforeAll(() => {
  delete g.window;
  delete g.getComputedStyle;
  // yt-dlp prints the saved video's info; its captions are served below.
  const bin = mkdtempSync(join(tmpdir(), "ore-ytdlp-"));
  writeFileSync(join(bin, "yt-dlp"), `#!/bin/sh\ncat '${join(FIX, "video/talk.info.json")}'\n`);
  chmodSync(join(bin, "yt-dlp"), 0o755);
  // A deterministic stand-in for the OS speech boundary; the saved WAV is silence, not speech.
  writeFileSync(join(bin, "transcribe"), `#!/bin/sh\ncat '${join(FIX, "audio/sundial.vtt")}'\n`);
  chmodSync(join(bin, "transcribe"), 0o755);
  process.env.ORE_TRANSCRIBE = join(bin, "transcribe");
  process.env.PATH = `${bin}:${realPath}`;
});
afterAll(() => {
  for (const [k, v] of Object.entries(leaked)) if (v) g[k] = v;
  globalThis.fetch = realFetch;
  process.env.PATH = realPath;
  if (realTranscribe === undefined) delete process.env.ORE_TRANSCRIBE;
  else process.env.ORE_TRANSCRIBE = realTranscribe;
});

/** Serves saved files by URL; anything else (a page's images) is a 404. */
function serve(pages: Record<string, [file: string, type: string]>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const p = pages[String(input instanceof Request ? input.url : input)];
    return p ? new Response(readFileSync(join(FIX, p[0])), { headers: { "content-type": p[1] } }) : new Response("not found", { status: 404 });
  }) as typeof fetch;
}


test("golden: the Ask eval leaves out exactly the pages whose words were rewritten", () => {
  expect(CASES.filter((c) => c.rewritten).map((c) => c.name).sort()).toEqual([...REWRITTEN].sort());
});

for (const c of CASES)
  test(`golden: ${c.name}`, async () => {
    if (c.serve) serve(c.serve);
    const item = c.paste ? await addText(await tempLibrary(), readFileSync(c.add, "utf8"), { html: true }) : await addSource(await tempLibrary(), c.add);
    // Only the id and the time of capture change from run to run.
    const doc = readFileSync(join(item.dir, "doc.md"), "utf8")
      .replace(/^id: .+$/m, "id: <id>")
      .replace(/^captured_at: .+$/m, "captured_at: <time>");
    const path = join(GOLDEN, `${c.name}.md`);
    if (UPDATE) writeFileSync(path, doc);
    else if (!existsSync(path)) throw new Error(`No golden file for ${c.name}: run \`bun run golden:update\` and commit test/golden/${c.name}.md`);
    // On a failure: read the diff. A change you meant is saved with `bun run golden:update`.
    expect(doc).toBe(readFileSync(path, "utf8"));
  });
