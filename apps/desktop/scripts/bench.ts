// Speed benchmark: the built app in a browser on a big seeded library (seed-big at ORE_SEED_SCALE=4:
// ~950 sources, ~2,300 highlights, ~4,400 reviews, a 1.5 MB book), timing what Tyler waits on.
//   bun apps/desktop/scripts/bench.ts                 seeds a library once (kept in $TMPDIR/ore-bench), builds, runs 3 rounds
//   bun apps/desktop/scripts/bench.ts --rounds 5 --only reader   (steps before it still run, unreported)
//   BENCH_LIB=/path   use that library instead
// Each step reports the wall time until the screen is settled: no `ore` call in flight and no long task for 300 ms.
// Numbers are medians across rounds; `calls` is how many `ore` commands the step ran, `cli` the slowest one,
// `long` the main thread's long tasks (ms). --calls lists each call's start and length; --compiled runs a compiled CLI.
//   --check bench-baseline.json   fails when a step's median is over 1.5× its baseline (+150 ms, so a short step's
//   jitter doesn't trip it), or a step fails; CI runs this. Without the file it prints one to save from that machine.
//   Shared CI runners differ: one ran every step 2–8× over (#209). So the bench also times a fixed piece of work no
//   Ore code touches (RUNNER), and a runner slower at it than the baseline's gets that much more room on every step.
import { chromium, type Page } from "playwright";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { compileCli } from "./compile-cli.ts";

const APP = join(import.meta.dir, "..");
const MOCK = join(APP, "scripts/mock");
const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const ROUNDS = Number(arg("--rounds") ?? 3);
const ONLY = arg("--only");
const CHECK = arg("--check");
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
if (compiled) await compileCli(compiled);
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

/** The runner's speed, in ms: fixed work in a page of its own (sorting and copying numbers, laying out a list), and
 *  starting a process 5 times (each `ore` call is one), as the steps do both. */
const RUNNER = "runner: fixed work";
async function runnerMs(browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<number[]> {
  const page = await browser.newPage();
  const ms: number[] = [];
  for (let i = 0; i < 5; i++) ms.push(await page.evaluate(() => {
    const t0 = performance.now();
    const a = Array.from({ length: 300_000 }, (_, i) => (i * 7919) % 100_003);
    JSON.parse(JSON.stringify(a.sort((x, y) => x - y)));
    const list = document.createElement("div");
    for (let i = 0; i < 3000; i++) list.appendChild(document.createElement("div")).textContent = `row ${i}`;
    document.body.replaceChildren(list);
    void list.offsetHeight;
    return performance.now() - t0;
  }) + (() => {
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) Bun.spawnSync(["bun", "-e", "0"]);
    return performance.now() - t0;
  })());
  await page.close();
  return ms;
}

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
  // Real ratings: the scale-4 seed has ~50 cards due; reseed (delete $TMPDIR/ore-bench) once they run out.
  ["review: rate 5 cards", async (page) => {
    const q = page.locator(".review-q");
    return measure(page, async () => {
      for (let i = 0; i < 5 && (await q.isVisible()); i++) {
        // An Explain card shows its answer on No idea, a Fact card on how sure he is.
        const noIdea = page.getByRole("button", { name: "No idea" });
        await ((await noIdea.isVisible()) ? noIdea : page.getByRole("radio", { name: "Think so" }).first()).click();
        await page.getByRole("button", { name: "Good", exact: true }).click();
        // The next card (it opens on its answer, so the ratings go), or the end of the session. Not the question's
        // text: the scaled seed repeats questions, so two cards in a row can read the same and the wait never ends.
        await page.getByRole("button", { name: "Good", exact: true }).waitFor({ state: "detached" });
      }
    });
  }],
];

if (ONLY && !steps.some(([n]) => n.includes(ONLY))) {
  bridge.kill();
  vite.kill();
  throw new Error(`no step matches --only ${ONLY}: ${steps.map(([n]) => n).join(", ")}`);
}
const runs = new Map<string, Result[]>();
const failed: string[] = [];
const runner: number[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  browser = await chromium.launch();
  for (let r = 0; r < ROUNDS; r++) {
    runner.push(...(await runnerMs(browser)));
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
        failed.push(name);
      }
    }
    await page.close();
  }
  runner.push(...(await runnerMs(browser)));
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

console.log(`${RUNNER.padEnd(28)} ${String(Math.round(median(runner))).padStart(6)}`);

if (CHECK) {
  const medians = Object.fromEntries([...runs].map(([name, rs]) => [name, median(rs.map((r) => r.ms))]));
  medians[RUNNER] = Math.round(median(runner));
  if (!existsSync(CHECK)) {
    console.log(`\nno baseline at ${CHECK}; this machine's, to save there:\n${JSON.stringify(medians, null, 2)}`);
  } else {
    const { [RUNNER]: baseRunner, ...base }: Record<string, number> = await Bun.file(CHECK).json();
    // Never stricter than the baseline: a fast runner keeps the plain 1.5×.
    const slower = baseRunner ? Math.max(1, medians[RUNNER]! / baseRunner) : 1;
    if (slower > 1.2) console.log(`\nthis runner is ${slower.toFixed(1)}× slower than the baseline's at fixed work; every step gets that much more room`);
    const slow = Object.entries(base).flatMap(([name, ms]) => {
      const now = medians[name];
      return now !== undefined && now > Math.max(ms * 1.5, ms + 150) * slower ? [`${name}: ${now} ms, baseline ${ms}${slower > 1.2 ? ` (×${slower.toFixed(1)} for the runner)` : ""}`] : [];
    });
    const missing = Object.keys(base).filter((n) => !(n in medians) && !failed.includes(n));
    for (const l of [...failed.map((n) => `${n}: failed`), ...slow, ...missing.map((n) => `${n}: not run`)]) console.error(`✗ ${l}`);
    if (failed.length || slow.length || missing.length) process.exit(1);
    console.log(`\nevery step within 1.5× of ${CHECK}`);
  }
}
