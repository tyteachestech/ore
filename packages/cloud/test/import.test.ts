import { afterAll, beforeAll, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { CASES } from "../../core/test/golden-cases.ts";
import { importJob } from "../src/import.ts";
import { handle } from "../src/server.ts";

// Ore Cloud's import (#549): what the server reads must be what the Mac reads, byte for byte, so the
// server can never drift from the Mac. Every golden source goes through the server and is compared with
// its golden doc.md (packages/core/test/golden).
const GOLDEN = join(import.meta.dir, "../../core/test/golden");

const g = globalThis as Record<string, unknown>;
const leaked = { window: g.window, getComputedStyle: g.getComputedStyle };
const realFetch = globalThis.fetch;
const realTranscribe = process.env.ORE_TRANSCRIBE;
const realPath = process.env.PATH;
const FIX = join(import.meta.dir, "../../core/test/fixtures/intake");
beforeAll(() => {
  delete g.window;
  delete g.getComputedStyle;
  // yt-dlp prints the saved video's info, as in golden.test.ts: a page with a video in it comes in whole
  // where yt-dlp is installed, the same as on the Mac.
  const bin = mkdtempSync(join(tmpdir(), "ore-ytdlp-"));
  writeFileSync(join(bin, "yt-dlp"), `#!/bin/sh\ncat '${join(FIX, "video/talk.info.json")}'\n`);
  chmodSync(join(bin, "yt-dlp"), 0o755);
  process.env.PATH = `${bin}:${realPath}`;
  // No speech here, as on the server: an episode comes in owed, and the server refuses it.
  process.env.ORE_TRANSCRIBE = "";
});
afterAll(() => {
  for (const [k, v] of Object.entries(leaked)) if (v) g[k] = v;
  globalThis.fetch = realFetch;
  process.env.PATH = realPath;
  if (realTranscribe === undefined) delete process.env.ORE_TRANSCRIBE;
  else process.env.ORE_TRANSCRIBE = realTranscribe;
});

function serve(pages: Record<string, [file: string, type: string]>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const p = pages[String(input instanceof Request ? input.url : input)];
    return p ? new Response(readFileSync(join(FIX, p[0])), { headers: { "content-type": p[1] } }) : new Response("not found", { status: 404 });
  }) as typeof fetch;
}

const normal = (doc: string) => doc.replace(/^id: .+$/m, "id: <id>").replace(/^captured_at: .+$/m, "captured_at: <time>");
// A video link needs yt-dlp, which YouTube blocks on servers; an episode is heard on the phone (#545 corrections).
const onTheMac = (c: (typeof CASES)[number]) => /^(youtube|podcast)/.test(c.name);
// The files a Markdown note links to by a relative path, sent with it as the phone would.
const besides = (path: string) => Object.fromEntries([...readFileSync(path, "utf8").matchAll(/\]\(([\w.-]+\.(?:svg|png|jpe?g))\)/g)].map((m) => [m[1]!, new Uint8Array(readFileSync(join(dirname(path), m[1]!)))]));
const scratch = () => readdirSync(tmpdir()).filter((n) => n.startsWith("ore-cloud-"));

for (const c of CASES.filter((c) => !c.paste && !onTheMac(c)))
  test(`cloud import matches the Mac: ${c.name}`, async () => {
    if (c.serve) serve(c.serve);
    const job = c.add.startsWith("http") ? { url: c.add } : { name: basename(c.add), bytes: new Uint8Array(readFileSync(c.add)), beside: besides(c.add) };
    const r = await importJob(job);
    if ("refused" in r) throw new Error(`refused: ${r.refused}`);
    expect(normal(new TextDecoder().decode(r.files["doc.md"]))).toBe(readFileSync(join(GOLDEN, `${c.name}.md`), "utf8"));
  });

test("video links and episodes are refused with the next step, never sent back half read (#545 corrections)", async () => {
  for (const c of CASES.filter(onTheMac)) {
    if (c.serve) serve(c.serve);
    const r = await importJob({ url: c.add });
    expect(r).toEqual({ refused: expect.stringContaining("Mac") });
    expect(JSON.stringify(r)).not.toContain("brew");
  }
});

test("the server keeps nothing: each job's library is gone after its reply, a refused one too", async () => {
  const before = scratch();
  serve({ "https://en.wikipedia.org/wiki/Spaced_repetition": ["web/wikipedia.html", "text/html"] });
  await importJob({ url: "https://en.wikipedia.org/wiki/Spaced_repetition" });
  await importJob({ name: "empty.pdf", bytes: new Uint8Array([1, 2, 3]) });
  expect(scratch()).toEqual(before);
  for (const n of before) expect(existsSync(join(tmpdir(), n))).toBe(true);
});

test("POST /import answers a link as JSON with base64 files, and refuses what isn't a request it knows", async () => {
  serve({ "https://en.wikipedia.org/wiki/Spaced_repetition": ["web/wikipedia.html", "text/html"] });
  const ok = await handle(new Request("http://x/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "https://en.wikipedia.org/wiki/Spaced_repetition" }) }));
  const body = (await ok.json()) as { id: string; files: Record<string, string> };
  expect(Buffer.from(body.files["doc.md"]!, "base64").toString()).toContain("Spaced repetition");
  expect((await handle(new Request("http://x/import"))).status).toBe(405);
  expect((await handle(new Request("http://x/nope", { method: "POST" }))).status).toBe(404);
  expect((await handle(new Request("http://x/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "file:///etc/passwd" }) }))).status).toBe(400);
  expect((await handle(new Request("http://x/import", { method: "POST", body: "x" }))).status).toBe(400);
});

test("a page whose video needs yt-dlp, on a server without it, is refused with the Mac as the next step, not brew", async () => {
  const c = CASES.find((c) => c.name === "web-academy-lesson")!;
  serve(c.serve!);
  const path = process.env.PATH;
  process.env.PATH = "/usr/bin:/bin";
  try {
    expect(await importJob({ url: c.add })).toEqual({ refused: expect.stringContaining("Add it on your Mac") });
  } finally {
    process.env.PATH = path;
  }
});

test("a file's images come only from the files sent with it, never from the server's own disk (#549 review)", async () => {
  const png = join(FIX, "files/screenshot.png");
  const note = `# Note\n\nSome words to read here.\n\n![a](file://${png})\n\n![b](../../../../../../../..${png})\n\n![c](${png})\n`;
  const r = await importJob({ name: "note.md", bytes: new TextEncoder().encode(note) });
  if ("refused" in r) throw new Error(r.refused);
  expect(Object.keys(r.files).filter((p) => p.startsWith("assets/"))).toEqual([]);
  expect(new TextDecoder().decode(r.files["doc.md"])).not.toContain("assets/");
});

test("a file named . or .. is refused, not a server error", async () => {
  for (const name of [".", "..", ""]) expect(await importJob({ name, bytes: new Uint8Array([1]) })).toEqual({ refused: expect.stringContaining("no name") });
  const r = await importJob({ name: "n.md", bytes: new TextEncoder().encode("# N\n\nWords to read.\n"), beside: { "..": new Uint8Array([1]), ".": new Uint8Array([1]) } });
  expect("id" in r).toBe(true);
});

test("POST /import takes a Markdown note with its images as JSON, and they come in as on the Mac", async () => {
  const md = join(FIX, "office/text-relative.md");
  const b64 = (p: string) => readFileSync(p).toString("base64");
  const res = await handle(new Request("http://x/import", { method: "POST", headers: { "content-type": "Application/JSON" }, body: JSON.stringify({ name: "text-relative.md", bytes: b64(md), beside: { "diagram.svg": b64(join(FIX, "office/diagram.svg")) } }) }));
  const body = (await res.json()) as { files: Record<string, string> };
  expect(normal(Buffer.from(body.files["doc.md"]!, "base64").toString())).toBe(readFileSync(join(GOLDEN, "office-text-relative.md"), "utf8"));
});
