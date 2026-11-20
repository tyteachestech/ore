#!/usr/bin/env bun
// Puts this checkout's Ore on Tyler's iPhone over Wi-Fi: `bun run phone:install` (from the repo root, on the Mac).
// `bun run phone:install --status` only says which build the phone runs and how far behind this checkout it is.
// It rewrites the Xcode project (src-tauri/gen/apple) whenever what shapes it changed since it was written, since a
// project from Nov 11 lacked later Swift files and broke the Nov 15 build (retro 2026-11-15). The build number is the
// checkout's commit count, so the installed build names its commit; `0.1.0` alone never told anyone.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { freePercent, refusal } from "../../desktop/scripts/mac-load";

const phone = resolve(import.meta.dir, "..");
const gen = join(phone, "src-tauri/gen/apple");
const BUNDLE = "com.tylerpoelking.ore.phone";

/** What shapes the generated Xcode project: the files ios:init reads, and the names of the Swift files it adds. */
export function inputsStamp(read: (path: string) => string, list: (dir: string) => string[]): string {
  const h = createHash("sha256");
  for (const f of ["scripts/share-target.ts", "scripts/launch-screen.ts", "src-tauri/Entitlements.ios.plist", "src-tauri/tauri.conf.json", "src-tauri/Cargo.toml", "package.json"])
    h.update(`${f}\n${read(f)}\n`);
  for (const d of ["ios", "share"]) h.update(`${d}: ${list(d).sort().join(",")}\n`);
  return h.digest("hex");
}

type Device = { identifier: string; hardwareProperties: { reality: string; platform: string; deviceType: string; udid: string }; deviceProperties: { name: string }; connectionProperties: { pairingState: string } };

/** The paired physical iPhone in `devicectl list devices --json-output`. */
export function pickIphone(json: { result: { devices: Device[] } }): { udid: string; name: string } | undefined {
  const d = json.result.devices.find((d) => d.hardwareProperties.reality === "physical" && d.hardwareProperties.deviceType === "iPhone" && d.connectionProperties.pairingState === "paired");
  return d && { udid: d.hardwareProperties.udid, name: d.deviceProperties.name };
}

export function describe(installed: string | undefined, here: number): string {
  if (!installed) return "Ore isn't on the phone.";
  // Tauri writes the build number after the version: 0.1.0.614. A plain 0.1.0 predates numbered builds.
  const m = installed.match(/^\d+\.\d+\.\d+\.(\d+)$/);
  const n = Number(m?.[1]);
  if (!m) return `The phone runs build ${installed}, from before builds were numbered by commit: assume it's old.`;
  return n === here ? `The phone runs build ${n}, this checkout's.` : n < here ? `The phone runs build ${n}, ${here - n} commits behind this checkout (${here}).` : `The phone runs build ${n}, ahead of this checkout (${here}).`;
}

function sh(cmd: string[], cwd = phone, live = false) {
  const r = spawnSync(cmd[0]!, cmd.slice(1), { cwd, encoding: "utf8", stdio: live ? "inherit" : "pipe" });
  if (r.status !== 0) throw new Error(`${cmd.join(" ")} failed${live ? "" : `:\n${r.stdout}${r.stderr}`}`);
  return (r.stdout ?? "").trim();
}

function devicectl<T>(args: string[]): T {
  const out = join(mkdtempSync(join(tmpdir(), "ore-phone-")), "out.json");
  sh(["xcrun", "devicectl", ...args, "--json-output", out]);
  return JSON.parse(readFileSync(out, "utf8"));
}

function installedVersion(udid: string): string | undefined {
  const r = devicectl<{ result: { apps: { bundleVersion?: string }[] } }>(["device", "info", "apps", "--device", udid, "--bundle-id", BUNDLE]);
  return r.result.apps[0]?.bundleVersion;
}

async function main() {
  const iphone = pickIphone(devicectl(["list", "devices"]));
  if (!iphone) throw new Error("No paired iPhone: pair it once in Xcode › Devices and Simulators.");
  const build = Number(sh(["git", "rev-list", "--count", "HEAD"]));
  console.log(describe(installedVersion(iphone.udid), build));
  if (process.argv.includes("--status")) return;

  // The Mac app's reinstall after a pull holds this lock (.githooks/post-commit); two Rust builds at once load the Mac.
  while (existsSync(join(homedir(), "Library/Caches/ore/app-install.lock"))) {
    console.log("waiting for the Mac app's reinstall to finish…");
    await Bun.sleep(15_000);
  }
  const why = refusal(freePercent(spawnSync("memory_pressure", ["-Q"], { encoding: "utf8" }).stdout), 0);
  if (why) throw new Error(why);

  const stamp = inputsStamp((f) => readFileSync(join(phone, f), "utf8"), (d) => readdirSync(join(phone, d)));
  const stampFile = join(gen, ".ore-inputs");
  if (!existsSync(stampFile) || readFileSync(stampFile, "utf8") !== stamp) {
    if (existsSync(gen)) {
      const old = `${gen}-old-${Date.now()}`;
      renameSync(gen, old);
      console.log(`The Xcode project was older than what shapes it: moved it to ${old} and writing a new one.`);
    }
    sh(["env", "CI=true", "bun", "run", "ios:init"], phone, true);
    writeFileSync(stampFile, stamp);
  }
  sh(["bun", "run", "tauri", "ios", "build", "--debug", "--build-number", String(build)], phone, true);
  sh(["xcrun", "devicectl", "device", "install", "app", "--device", iphone.udid, join(gen, "build/arm64/Ore.ipa")], phone, true);
  console.log(`Installed build ${build} on ${iphone.name}. ${describe(installedVersion(iphone.udid), build)}`);
}

if (import.meta.main) await main().catch((e) => (console.error(e.message), process.exit(1)));
