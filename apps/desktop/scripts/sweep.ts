#!/usr/bin/env bun
// Runs a Codex sweep on the Mac: `bun run sweep <sweep folder> [--only a,b] [--dry-run]`, from a worktree.
// The folder holds sweep.json ({ "testers": [{ "name": "firstrun", "seed": "init" | "seed" | "big", "scale"?: 5 }] }),
// an optional preamble.md and a <name>-prompt.md per tester. In those, {{mac}} {{bridge}} {{phone}} {{webkit}}
// {{library}} {{phoneLibrary}} {{out}} become this run's ports and folders. For each tester it seeds a scratch
// library and a phone copy, serves the release build under its CSP with a bridge, serves the phone build, and starts
// Codex once the Mac load check passes (mac-load.ts: at most two testers, a big library alone). It stops each
// tester's servers when that tester ends, and everything it started when the run ends or is stopped.
// Output: codex-out/<name>/ (Codex writes report.md there), codex-out/<name>.log, codex-out/logs/, codex-out/done.txt.
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { check, clean, killTree, MAX_TESTERS } from "./mac-load";

export type Tester = { name: string; seed: "init" | "seed" | "big"; scale?: number };
export type Ports = { mac: number; bridge: number; phone: number };

// Ports WebKit refuses to load (the Fetch standard's "bad ports"; 1723 cost sweep 4 a restart of its setup).
const BAD = new Set([1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103,
  104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530,
  531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060,
  5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080]);

/** The next `n` ports from `from` that WebKit loads and `free` says nobody holds. */
export function pickPorts(n: number, from: number, free: (p: number) => boolean): number[] {
  const out: number[] = [];
  for (let p = from; out.length < n; p++) if (!BAD.has(p) && free(p)) out.push(p);
  return out;
}

export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** A tester whose library is bigger than the usual big seed runs with no other tester beside it. */
export const alone = (t: Tester) => t.seed === "big" && (t.scale ?? 1) > 1;

/** Who starts next: the first waiting tester that fits beside the ones running, or none. */
export function next(waiting: Tester[], running: Tester[]): Tester | undefined {
  if (running.some(alone) || running.length >= MAX_TESTERS) return;
  return waiting.find((t) => (alone(t) ? running.length === 0 : true));
}

function portFree(p: number): boolean {
  try {
    Bun.serve({ port: p, hostname: "::", fetch: () => new Response() }).stop(true);
    return true;
  } catch {
    return false;
  }
}

async function up(url: string, ms = 180_000): Promise<void> {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(1000)) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(60_000) })).ok) return;
    } catch {}
  }
  throw new Error(`${url} didn't answer in ${ms / 1000} s`);
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--only");
  if (!dir) throw new Error("usage: bun run sweep <sweep folder> [--only a,b] [--dry-run]");
  const root = resolve(import.meta.dir, "../../..");
  if (root === join(homedir(), "Developer/ore")) throw new Error("Run sweeps from a worktree, never ~/Developer/ore.");
  const folder = resolve(dir);
  const only = args.includes("--only") ? (args[args.indexOf("--only") + 1] ?? "").split(",") : undefined;
  const testers: Tester[] = JSON.parse(readFileSync(join(folder, "sweep.json"), "utf8")).testers
    .filter((t: Tester) => !only || only.includes(t.name));
  const preamble = existsSync(join(folder, "preamble.md")) ? readFileSync(join(folder, "preamble.md"), "utf8") + "\n\n" : "";
  const out = join(root, "codex-out"), libs = join(out, "libs"), logs = join(out, "logs");

  const ports = pickPorts(1 + testers.length * 3, 1760, portFree);
  const port = (i: number) => ports[i]!;
  const webkit = port(0);
  const plan = new Map<string, Ports>(testers.map((t, i) => [t.name, { mac: port(1 + i * 3), bridge: port(2 + i * 3), phone: port(3 + i * 3) }]));
  const prompts = new Map(testers.map((t) => {
    const p = plan.get(t.name)!;
    const vars = { ...p, webkit: `ws://[::1]:${webkit}/`, library: join(libs, t.name), phoneLibrary: join(libs, `${t.name}-phone`), out: join(out, t.name) };
    return [t.name, fill(preamble + readFileSync(join(folder, `${t.name}-prompt.md`), "utf8"), vars)];
  }));
  for (const t of testers) {
    const p = plan.get(t.name)!;
    console.log(`${t.name}: Mac ${p.mac}, bridge ${p.bridge}, iPhone ${p.phone}, seed ${t.seed}${t.scale ? ` ×${t.scale}` : ""}${alone(t) ? ", alone" : ""}`);
  }
  console.log(`WebKit server: ws://[::1]:${webkit}/`);
  if (args.includes("--dry-run")) return;

  mkdirSync(logs, { recursive: true });
  const children: Bun.Subprocess[] = [];
  const start = (cmd: string[], log: string, opts: { cwd?: string; env?: Record<string, string> } = {}) => {
    const c = Bun.spawn(cmd, { cwd: opts.cwd ?? root, env: { ...process.env, ...opts.env }, stdout: Bun.file(join(logs, log)), stderr: Bun.file(join(logs, log.replace(/\.log$/, ".err.log"))), stdin: "ignore" });
    children.push(c);
    return c;
  };
  const stopAll = async () => {
    children.forEach((c) => killTree(c.pid));
    await clean(root, () => {}, false).catch(() => {});
  };
  process.on("SIGINT", () => void stopAll().then(() => process.exit(130)));
  process.on("SIGTERM", () => void stopAll().then(() => process.exit(143)));

  const run = (cmd: string[], log: string, env: Record<string, string> = {}) => {
    const r = Bun.spawnSync(cmd, { cwd: root, env: { ...process.env, ...env }, stdout: Bun.file(join(logs, log)), stderr: Bun.file(join(logs, log.replace(/\.log$/, ".err.log"))) });
    if (r.exitCode !== 0) throw new Error(`${cmd.join(" ")} failed: see codex-out/logs/${log}`);
  };
  console.log("install and build…");
  run(["bun", "install"], "install.log");
  run(["bun", "run", "--cwd", "apps/desktop", "build"], "build.log");
  start(["node", "-e", `require("playwright").webkit.launchServer({ port: ${webkit}, host: "::1", wsPath: "/" }).then(s => console.log(s.wsEndpoint()))`], "webkit.log");

  const conf = JSON.parse(readFileSync(join(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"));
  const cspFor = (bridge: number) => ["connect-src", "img-src", "media-src"]
    .reduce((csp: string, d) => csp.replace(`${d} 'self'`, `${d} 'self' http://localhost:${bridge}`), conf.app.security.csp);

  const tester = async (t: Tester) => {
    const p = plan.get(t.name)!, lib = join(libs, t.name), mock = "apps/desktop/scripts/mock";
    mkdirSync(join(out, t.name), { recursive: true });
    if (t.seed === "init") run(["bun", "packages/cli/src/ore.ts", "init"], `seed-${t.name}.log`, { ORE_LIBRARY: lib });
    else run(["bun", `${mock}/${t.seed === "big" ? "seed-big" : "seed"}.ts`, lib], `seed-${t.name}.log`, t.scale ? { ORE_SEED_SCALE: String(t.scale) } : {});
    cpSync(lib, `${lib}-phone`, { recursive: true });
    const csp = cspFor(p.bridge), dist = join(root, "apps/desktop/dist");
    const mac = Bun.serve({ port: p.mac, async fetch(req) {
      const path = new URL(req.url).pathname;
      const f = Bun.file(join(dist, path === "/" || path.includes("..") ? "index.html" : path));
      return (await f.exists()) ? new Response(f, { headers: { "content-security-policy": csp } }) : new Response("not found", { status: 404 });
    } });
    const bridge = start(["bun", `${mock}/bridge.ts`], `bridge-${t.name}.log`, { env: { PORT: String(p.bridge), ORE_LIBRARY: lib } });
    const phone = start(["bunx", "vite", "--port", String(p.phone), "--strictPort"], `phone-${t.name}.log`, { cwd: join(root, "apps/desktop"), env: { ORE_PHONE: "1", ORE_PHONE_LIBRARY: `${lib}-phone` } });
    try {
      await up(`http://localhost:${p.mac}/`);
      await up(`http://localhost:${p.phone}/src/main.tsx`);
      const prompt = join(out, `${t.name}-prompt.md`);
      writeFileSync(prompt, prompts.get(t.name)!);
      console.log(`${t.name} started ${new Date().toTimeString().slice(0, 8)}`);
      // SWEEP_CODEX (a shell command, the prompt as $1) stands in for Codex when checking the runner itself.
      const fake = process.env.SWEEP_CODEX;
      const codex = fake ? ["sh", "-c", fake, "sweep"] : ["codex", "exec", "-m", "gpt-6-astra", "-c", "model_reasoning_effort=high",
        "-c", "sandbox_workspace_write.network_access=true", "--sandbox", "workspace-write", "-C", root];
      const c = Bun.spawn([...codex, readFileSync(prompt, "utf8")], { cwd: root, stdin: "ignore", stdout: Bun.file(join(out, `${t.name}.log`)), stderr: Bun.file(join(out, `${t.name}.err.log`)) });
      children.push(c);
      return await c.exited;
    } finally {
      mac.stop(true);
      killTree(bridge.pid);
      killTree(phone.pid);
    }
  };

  const waiting = [...testers], running: Tester[] = [], jobs: Promise<void>[] = [];
  while (waiting.length) {
    const t = next(waiting, running);
    const why = t && !process.env.SWEEP_CODEX ? check(alone(t), () => {}) : null;
    if (!t || why) {
      if (why) console.log(`waiting: ${why}`);
      await Promise.race([...jobs, Bun.sleep(30_000)]);
      continue;
    }
    waiting.splice(waiting.indexOf(t), 1);
    running.push(t);
    const job = tester(t)
      .then((rc) => `${t.name} exit ${rc}`, (e) => `${t.name} failed: ${e.message}`)
      .then((line) => {
        appendFileSync(join(out, "done.txt"), `${line} ${new Date().toTimeString().slice(0, 8)}\n`);
        console.log(line);
        running.splice(running.indexOf(t), 1);
        jobs.splice(jobs.indexOf(job), 1);
      });
    jobs.push(job);
    await Bun.sleep(5000); // let the new tester show in the process list before the next check
  }
  await Promise.all(jobs);
  await stopAll();
  for (const t of testers) console.log(`${t.name}: ${existsSync(join(out, t.name, "report.md")) ? `codex-out/${t.name}/report.md` : "no report"}`);
}

if (import.meta.main) await main().catch((e) => (console.error(e.message), process.exit(1)));
