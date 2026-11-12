#!/usr/bin/env bun
// Use the iPhone app in the iOS Simulator like a person: real touches through XCUITest
// (apps/phone/sim-driver), a screenshot after every action. Built for AI testers (Codex, Claude).
//
//   bun apps/phone/scripts/sim.ts start [--lib DIR] [--device NAME] [--fresh]   build, install, start the driver
//   bun apps/phone/scripts/sim.ts tap X Y | doubletap X Y | longpress X Y [SECS]
//   bun apps/phone/scripts/sim.ts swipe X Y X2 Y2 [SECS]    a flick; drag X Y X2 Y2 holds first (moves things)
//   bun apps/phone/scripts/sim.ts type "text" | key return|delete|tab
//   bun apps/phone/scripts/sim.ts shot | tree | launch | home | activate | wait SECS | rotate portrait|landscape
//   bun apps/phone/scripts/sim.ts reset    delete the app and its data, install it again (a first launch)
//   bun apps/phone/scripts/sim.ts stop
// X and Y are iPhone points from the top left (a 2x screenshot's pixels / 3 on iPhone 18 Pro: use
// `tree` for exact frames). Each command prints JSON: {"ok", "shot": png path, "error"}.
// The library is a copy built into the app (D78): --lib is a scratch library, never ~/Ore.
import { spawnSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const phone = resolve(import.meta.dir, "..");
const driver = join(phone, "sim-driver");
const dir = process.env.ORE_SIM_DIR ?? "/tmp/ore-sim";
const bundle = "com.tylerpoelking.ore.phone";
const appPath = join(phone, "src-tauri/gen/apple/build/arm64-sim/Ore.app");
const [op, ...args] = process.argv.slice(2);

function sh(cmd: string, argv: string[], opts: { env?: Record<string, string>; cwd?: string } = {}) {
  const r = spawnSync(cmd, argv, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", ...opts, env: { ...process.env, ...opts.env } });
  if (r.status !== 0) throw new Error(`${cmd} ${argv.join(" ")} failed:\n${(r.stderr || r.stdout).slice(-2000)}`);
  return r.stdout;
}

function flag(name: string) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function device(): string {
  const name = flag("--device") ?? process.env.ORE_SIM_DEVICE ?? "iPhone 18 Pro";
  const list = JSON.parse(sh("xcrun", ["simctl", "list", "devices", "available", "--json"])).devices as Record<string, { name: string; udid: string; state: string }[]>;
  const all = Object.entries(list).sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true })).flatMap(([, d]) => d);
  const d = all.find((d) => d.udid === name) ?? all.find((d) => d.name === name && d.state === "Booted") ?? all.find((d) => d.name === name);
  if (!d) throw new Error(`no simulator named ${name}`);
  if (d.state !== "Booted") sh("xcrun", ["simctl", "boot", d.udid]);
  return d.udid;
}

function savedDevice() {
  const f = join(dir, "device");
  return existsSync(f) ? readFileSync(f, "utf8").trim() : device();
}

function install(udid: string) {
  spawnSync("xcrun", ["simctl", "terminate", udid, bundle]);
  spawnSync("xcrun", ["simctl", "uninstall", udid, bundle]);
  sh("xcrun", ["simctl", "install", udid, appPath]);
}

async function send(cmd: Record<string, unknown>, timeoutMs = 60_000) {
  const outFile = join(dir, "out.json");
  const prev = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")).seq ?? -1 : -1;
  const seq = Math.max(prev, -1) + 1;
  writeFileSync(join(dir, "cmd.tmp"), JSON.stringify({ ...cmd, seq }));
  renameSync(join(dir, "cmd.tmp"), join(dir, "cmd.json"));
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const out = JSON.parse(readFileSync(outFile, "utf8"));
      if (out.seq === seq) return out;
    } catch {}
    await Bun.sleep(50);
  }
  throw new Error("the driver did not answer: run `start` again");
}

async function start() {
  mkdirSync(join(dir, "shots"), { recursive: true });
  const udid = device();
  writeFileSync(join(dir, "device"), udid);
  const lib = flag("--lib");
  if (lib) {
    const abs = resolve(lib);
    if (abs === resolve(homedir(), "Ore") || abs.includes("Mobile Documents")) throw new Error("use a scratch library, never ~/Ore");
    console.error("building the app for the Simulator with", abs, "(a few minutes)");
    sh("bun", ["run", "tauri", "ios", "build", "--debug", "--target", "aarch64-sim"], { cwd: phone, env: { ORE_PHONE_LIBRARY: abs } });
  }
  if (!existsSync(appPath)) throw new Error("no Simulator build yet: pass --lib DIR");
  if (lib || args.includes("--fresh")) install(udid);
  spawnSync("xcrun", ["simctl", "terminate", udid, bundle]);
  sh("xcodegen", ["generate", "--quiet"], { cwd: driver });
  sh("xcodebuild", ["build-for-testing", "-project", "OreSimDriver.xcodeproj", "-scheme", "Driver", "-destination", `id=${udid}`, "-derivedDataPath", "build", "-quiet"], { cwd: driver });
  writeFileSync(join(dir, "cmd.json"), JSON.stringify({ seq: -1 }));
  writeFileSync(join(dir, "out.json"), JSON.stringify({ seq: -2 }));
  const log = openSync(join(dir, "driver.log"), "w");
  spawn("xcodebuild", ["test-without-building", "-project", "OreSimDriver.xcodeproj", "-scheme", "Driver", "-destination", `id=${udid}`, "-derivedDataPath", "build", "-only-testing:DriverUITests/Driver/testDrive"], {
    cwd: driver, detached: true, stdio: ["ignore", log, log], env: { ...process.env, TEST_RUNNER_ORE_SIM_DIR: dir, TEST_RUNNER_ORE_SIM_BUNDLE: bundle },
  }).unref();
  const end = Date.now() + 180_000;
  while (Date.now() < end) {
    try {
      if (JSON.parse(readFileSync(join(dir, "out.json"), "utf8")).ready) break;
    } catch {}
    await Bun.sleep(200);
  }
  return send({ op: "launch", settle: 2 });
}

const n = (i: number) => Number(args[i]);
const ops: Record<string, () => Promise<unknown>> = {
  start,
  reset: async () => (install(savedDevice()), send({ op: "launch", settle: 2 })),
  tap: () => send({ op: "tap", x: n(0), y: n(1) }),
  doubletap: () => send({ op: "doubletap", x: n(0), y: n(1) }),
  longpress: () => send({ op: "longpress", x: n(0), y: n(1), secs: args[2] ? n(2) : 0.8 }),
  swipe: () => send({ op: "swipe", x: n(0), y: n(1), x2: n(2), y2: n(3), secs: args[4] ? n(4) : 0.25 }),
  drag: () => send({ op: "drag", x: n(0), y: n(1), x2: n(2), y2: n(3), secs: args[4] ? n(4) : 0.5 }),
  type: () => send({ op: "type", text: args.join(" ") }),
  key: () => send({ op: "key", key: args[0] }),
  rotate: () => send({ op: "rotate", to: args[0] }),
  wait: () => send({ op: "wait", secs: n(0) || 1 }),
  shot: () => send({ op: "shot" }),
  tree: () => send({ op: "tree" }),
  launch: () => send({ op: "launch", settle: 2 }),
  home: () => send({ op: "home" }),
  activate: () => send({ op: "activate" }),
  stop: () => send({ op: "stop" }, 10_000),
};

if (!op || !ops[op]) {
  console.log(readFileSync(import.meta.path, "utf8").split("\n").filter((l) => l.startsWith("//")).join("\n"));
  process.exit(op ? 1 : 0);
}
try {
  console.log(JSON.stringify(await ops[op]()));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: (e as Error).message }));
  process.exit(1);
}
