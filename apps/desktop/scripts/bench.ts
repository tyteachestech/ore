// Speed benchmark: the built app in a browser on a big seeded library (seed-big at ORE_SEED_SCALE=4:
// ~950 sources, ~2,300 highlights, ~4,400 reviews, a 1.5 MB book), timing what Tyler waits on.
//   bun apps/desktop/scripts/bench.ts                 seeds a library once (kept in $TMPDIR/ore-bench), builds, runs 3 rounds
//   bun apps/desktop/scripts/bench.ts --rounds 5 --only reader   (steps before it still run, unreported)
//   BENCH_LIB=/path   use that library instead
// Each step reports the wall time until the screen is settled: no `ore` call in flight and no long task for 300 ms.
// Numbers are medians across rounds; `calls` is how many `ore` commands the step ran, `cli` the slowest one,
// `long` the main thread's long tasks (ms). --calls lists each call's start and length; --compiled runs a compiled CLI.
import { chromium, type Page } from "playwright";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const APP = join(import.meta.dir, "..");
const MOCK = join(APP, "scripts/mock");
const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const ROUNDS = Number(arg("--rounds") ?? 3);
const ONLY = arg("--only");
const PORT = 1460, BRIDGE = 1461;

const lib = process.env.BENCH_LIB ?? join(tmpdir(), "ore-bench");
if (!existsSync(join(lib, "skills.yaml"))) {
  console.log(`seeding ${lib} …`);
  await $`bun ${join(MOCK, "seed-big.ts")} ${lib}`.env({ ...process.env, ORE_SEED_SCALE: "4" }).quiet();
}
await $`bun ${join(APP, "../../packages/cli/src/ore.ts")} reindex`.env({ ...process.env, ORE_LIBRARY: lib }).quiet();
if (!process.argv.includes("--no-build")) await $`bunx vite build`.cwd(APP).quiet();

// --compiled: the CLI as the release app carries it (scripts/bundle-cli.ts), instead of from source as `bun link` runs it.
const compiled = process.argv.includes("--compiled") ? join(tmpdir(), "ore-bench-cli") : undefined;
if (compiled) await $`bun build --compile --minify --bytecode ${join(APP, "../../packages/cli/src/ore.ts")} --outfile ${compiled}`.quiet();
const bridge = Bun.spawn(["bun", join(MOCK, "bridge.ts")], { env: { ...process.env, ORE_LIBRARY: lib, PORT: String(BRIDGE), ...(compiled && { ORE_BRIDGE_BIN: compiled }) }, stdout: "ignore", stderr: "inherit" });
const vite = Bun.spawn(["bunx", "vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: APP, stdout: "ignore", stderr: "ignore" });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 100 && !(await fetch(url).then((r) => r.ok, () => false)); i++) await Bun.sleep(100);

// In the page: every ore call's args and time, and long tasks, so a step can wait until all is quiet.
const PROBE = `
  window.__bench = { calls: [], inflight: 0, last: performance.now(), long: [] };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__bench.long.push(e.duration); window.__bench.last = Math.max(window.__bench.last, e.startTime + e.duration); } }).observe({ type: "longtask", buffered: true });
  const wrap = () => {
    const t = window.__TAURI_INTERNALS__; if (!t || t.__wrapped) return; t.__wrapped = true;
    const inv = t.invoke;
    t.invoke = async (cmd, args) => {
      if (cmd !== "ore") return inv(cmd, args);
      const b = window.__bench, t0 = performance.now(); b.inflight++;
      try { return await inv(cmd, args); } finally { b.inflight--; const t1 = performance.now(); b.last = Math.max(b.last, t1); b.calls.push({ cmd: args.args.join(" ").slice(0, 50), ms: Math.round(t1 - t0), t0 }); }
    };
  };
  wrap(); document.addEventListener("DOMContentLoaded", wrap);
`;

type Result = { ms: number; calls: number; cli: number; long: number; slowest?: string; log?: string[] };
/** Runs `act`, then waits until no call is in flight and nothing ran long for 300 ms. */
async function measure(page: Page, act: () => Promise<unknown>, load = false): Promise<Result> {
  // A page load counts from navigation start (0) in the new document.
  const t0 = load ? 0 : await page.evaluate(() => { const b = (window as any).__bench; b.calls = []; b.long = []; return performance.now(); });
  await act();
  // What the step did itself counts until the next frame is drawn.
  await page.evaluate(() => new Promise<void>((ok) => requestAnimationFrame(() => setTimeout(() => { const b = (window as any).__bench; b.last = Math.max(b.last, performance.now()); ok(); }))));
  for (;;) {
    const s = await page.evaluate(() => { const b = (window as any).__bench; return { idle: b.inflight === 0, quiet: performance.now() - b.last }; });
    if (s.idle && s.quiet > 300) break;
    await page.waitForTimeout(50);
  }
  return page.evaluate((t0) => {
    const b = (window as any).__bench;
    const top = [...b.calls].sort((x: any, y: any) => y.ms - x.ms)[0];
    const log = b.calls.map((c: any) => `${String(Math.round(c.t0 - t0)).padStart(6)} +${String(c.ms).padStart(4)}  ${c.cmd}`);
    return { ms: Math.round(Math.max(b.last - t0, 0)), calls: b.calls.length, cli: top?.ms ?? 0, long: Math.round(b.long.reduce((a: number, x: number) => a + x, 0)), slowest: top?.cmd, log };
  }, t0);
}

const BOOK = "The Complete Book of Learning";
const steps: [string, (page: Page) => Promise<Result>][] = [
  ["startup → Home", async (page) => measure(page, async () => { await page.goto(url); await page.locator(".side-item").first().waitFor(); }, true)],
  ["skill page", async (page) => measure(page, () => page.locator(".side-item").filter({ hasText: "Learning" }).first().click())],
  ["All sources", async (page) => measure(page, () => page.getByRole("button", { name: /^All sources/ }).click())],
  ["↓ ×20 in All sources", async (page) => {
    await page.locator(".row").first().waitFor();
    await page.locator("[aria-multiselectable]").focus();
    return measure(page, async () => { for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowDown"); });
  }],
  ["filter sources", async (page) => measure(page, async () => {
    await page.keyboard.press("Meta+f");
    await page.getByLabel("Filter sources").pressSequentially("Complete Book", { delay: 30 });
    await page.locator(".row").filter({ hasText: BOOK }).first().waitFor();
  })],
  ["reader: open 1.5 MB book", async (page) => measure(page, async () => {
    await page.locator(".row").filter({ hasText: BOOK }).first().click();
    await page.locator(".doc-head").filter({ hasText: BOOK }).waitFor();
  })],
  ["reader: scroll the book", async (page) => measure(page, async () => {
    for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 2000); await page.waitForTimeout(16); }
  })],
  ["reader: open short source", async (page) => measure(page, async () => {
    await page.getByRole("button", { name: /^All sources/ }).click();
    await page.keyboard.press("Meta+f");
    await page.getByLabel("Filter sources").fill("");
    await page.locator(".row").nth(3).click();
    await page.locator(".doc-head").waitFor();
  })],
  ["note: type 40 chars", async (page) => {
    const note = page.locator(".ProseMirror").first();
    await note.click();
    await page.keyboard.press("Meta+ArrowDown");
    return measure(page, () => page.keyboard.type("The spacing effect beats cramming, a lot", { delay: 0 }));
  }],
  ["⌘K search", async (page) => {
    await page.keyboard.press("Escape");
    await page.locator(".side-item").first().click();
    return measure(page, async () => {
      await page.keyboard.press("Meta+k");
      await page.locator("[cmdk-input]").pressSequentially("retrieval practice", { delay: 30 });
    });
  }],
  ["start review", async (page) => {
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.locator(".side-item").first().click();
    await measure(page, async () => {});
    return measure(page, async () => {
      await page.getByRole("button", { name: "Start review" }).click();
      await page.getByRole("dialog", { name: "What to review" }).waitFor();
      await page.keyboard.press("Enter");
      await page.locator(".review-q").waitFor();
    });
  }],
];

if (ONLY && !steps.some(([n]) => n.includes(ONLY))) {
  bridge.kill();
  vite.kill();
  throw new Error(`no step matches --only ${ONLY}: ${steps.map(([n]) => n).join(", ")}`);
}
const runs = new Map<string, Result[]>();
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  browser = await chromium.launch();
  for (let r = 0; r < ROUNDS; r++) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(30000);
    await page.addInitScript(`window.__ORE_BRIDGE = ${BRIDGE}`);
    await page.addInitScript({ path: join(MOCK, "tauri.js") });
    await page.addInitScript(PROBE);
    if (process.env.STUB) await page.addInitScript("window.__STUB = 1");
    // --only: the steps before the last match still run (each starts where the one before left off), but only matches report.
    const last = ONLY ? steps.findLastIndex(([n]) => n.includes(ONLY)) : steps.length - 1;
    for (const [name, run] of steps.slice(0, last + 1)) {
      try {
        const res = await run(page);
        if (!ONLY || name.includes(ONLY)) runs.set(name, [...(runs.get(name) ?? []), res]);
      } catch (e) {
        console.error(`${name}: ${(e as Error).message.split("\n")[0]}`);
      }
    }
    await page.close();
  }
} finally {
  await browser?.close();
  bridge.kill();
  vite.kill();
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
console.log(`\n${"step".padEnd(28)} ${"ms".padStart(6)} ${"calls".padStart(6)} ${"cli".padStart(6)} ${"long".padStart(6)}  slowest call`);
for (const [name, rs] of runs) {
  const m = (k: keyof Result) => median(rs.map((r) => r[k] as number));
  console.log(`${name.padEnd(28)} ${String(m("ms")).padStart(6)} ${String(m("calls")).padStart(6)} ${String(m("cli")).padStart(6)} ${String(m("long")).padStart(6)}  ${rs.at(-1)!.slowest ?? ""}`);
  // --calls: when each `ore` call of the last round started (ms into the step) and how long it took.
  if (process.argv.includes("--calls")) for (const l of rs.at(-1)!.log ?? []) console.log(`    ${l}`);
}
