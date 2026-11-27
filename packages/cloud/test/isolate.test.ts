import { expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { accounts, session, type Auth } from "../src/auth.ts";
import { isolated } from "../src/isolate.ts";
import { inProcess, makeHandler, unsafeTools } from "../src/server.ts";

// Each import runs in a process of its own (F754): a hostile file that eats memory or
// time takes only its own process down, never the server and everyone signed in to it.
const script = (body: string) => {
  const p = join(mkdtempSync(join(tmpdir(), "ore-worker-")), "w.ts");
  writeFileSync(p, body);
  return p;
};

test("an import that runs past its time is stopped and refused with the next step", async () => {
  const t = Date.now();
  const r = JSON.parse(await isolated({ url: "https://example.com/" }, { script: script("while (true) {}"), seconds: 0.5 }));
  expect(r).toEqual({ refused: expect.stringContaining("Add it on your Mac") });
  expect(Date.now() - t).toBeLessThan(3000);
});

test("an import whose process dies (out of memory) is refused, not an error the server passes on", async () => {
  expect(JSON.parse(await isolated({ name: "a.md", bytes: new Uint8Array([1]) }, { script: script("process.exit(137)") }))).toEqual({ refused: expect.stringContaining("Try again") });
});

test("an import's process never holds the server's secrets", async () => {
  process.env.ORE_SESSION_SECRET = "a-secret-the-import-must-not-see";
  process.env.ORE_STRIPE_KEY = "another";
  try {
    const out = await isolated({ url: "https://example.com/" }, { script: script("process.stdout.write(JSON.stringify(process.env))") });
    expect(out).not.toContain("a-secret-the-import-must-not-see");
    expect(out).not.toContain("another");
    expect(JSON.parse(out).PATH).toBe(process.env.PATH);
  } finally {
    delete process.env.ORE_SESSION_SECRET;
    delete process.env.ORE_STRIPE_KEY;
  }
});

test("a file and the files beside it reach the import's process whole, and come back as the in-process import's", async () => {
  const FIX = join(import.meta.dir, "../../core/test/fixtures/intake/office");
  const job = { name: "text-relative.md", bytes: new Uint8Array(readFileSync(join(FIX, "text-relative.md"))), beside: { "diagram.svg": new Uint8Array(readFileSync(join(FIX, "diagram.svg"))) } };
  const normal = (text: string) => text.replace(/[A-Z0-9]{26}/g, "<id>").replace(/^captured_at: .+$/m, "");
  const files = (text: string) => Object.entries((JSON.parse(text) as { files: Record<string, string> }).files).map(([p, b]) => [p, normal(Buffer.from(b, "base64").toString())]);
  const there = files(await isolated(job));
  expect(there.map(([p]) => p)).toContain("doc.md");
  expect(there.some(([p]) => p!.startsWith("assets/"))).toBe(true);
  expect(there).toEqual(files(await inProcess(job)));
});

test("one account runs two imports at once and 120 an hour; the server four at once (F755)", async () => {
  const auth: Auth = { audience: [], secret: "s".repeat(32), keys: async () => [], accounts: accounts(":memory:") };
  const waits: (() => void)[] = [];
  const handle = makeHandler(auth, () => true, () => new Promise<string>((done) => waits.push(() => done('{"refused":"x"}'))));
  const as = async (who: string) => `Bearer ${await session(auth.accounts.signIn(who), auth)}`;
  const send = async (who: string) => handle(new Request("http://x/import", { method: "POST", headers: { authorization: await as(who), "content-type": "application/json" }, body: JSON.stringify({ url: "https://example.com/" }) }));
  const a1 = send("a"), a2 = send("a");
  await Bun.sleep(5);
  const a3 = await send("a");
  expect(a3.status).toBe(429);
  expect(((await a3.json()) as { refused: string }).refused).toContain("Wait");
  const b1 = send("b"), b2 = send("b");
  await Bun.sleep(5);
  expect((await send("c")).status).toBe(503);
  for (const w of waits.splice(0)) w();
  expect((await Promise.all([a1, a2, b1, b2])).map((r) => r.status)).toEqual([200, 200, 200, 200]);
  // Done, the slots are free again.
  const again = send("c");
  await Bun.sleep(5);
  waits.splice(0).forEach((w) => w());
  expect((await again).status).toBe(200);
});

test("the hourly count: an account's 121st import in an hour waits", async () => {
  const auth: Auth = { audience: [], secret: "s".repeat(32), keys: async () => [], accounts: accounts(":memory:") };
  const handle = makeHandler(auth, () => true, async () => '{"refused":"x"}');
  const authz = `Bearer ${await session(auth.accounts.signIn("a"), auth)}`;
  const send = () => handle(new Request("http://x/import", { method: "POST", headers: { authorization: authz, "content-type": "application/json" }, body: JSON.stringify({ url: "https://example.com/" }) }));
  for (let i = 0; i < 120; i++) expect((await send()).status).toBe(200);
  expect((await send()).status).toBe(429);
});

test("the server won't start where yt-dlp is installed: it opens links itself, past the guard on private addresses (F756)", () => {
  const bin = mkdtempSync(join(tmpdir(), "ore-tools-"));
  const path = process.env.PATH;
  try {
    process.env.PATH = "/usr/bin:/bin";
    expect(unsafeTools()).toEqual([]);
    writeFileSync(join(bin, "yt-dlp"), "#!/bin/sh\n");
    chmodSync(join(bin, "yt-dlp"), 0o755);
    process.env.PATH = `${bin}:/usr/bin:/bin`;
    expect(unsafeTools()).toEqual(["yt-dlp"]);
  } finally {
    process.env.PATH = path;
  }
});
