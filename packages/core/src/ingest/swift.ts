import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// The Swift helpers in `swift/` (text recognition, transcription) are compiled with swiftc the
// first time they run, into the user's cache, and again whenever their source changes.

/** The compiled helper `swift/<name>.swift`, built if needed. */
export async function swiftHelper(name: string): Promise<string> {
  const source = join(import.meta.dir, "swift", `${name}.swift`);
  const dir = join(homedir(), "Library", "Caches", "ore", "helpers");
  const bin = join(dir, `${name}-${createHash("sha256").update(readFileSync(source)).digest("hex").slice(0, 12)}`);
  if (existsSync(bin)) return bin;
  mkdirSync(dir, { recursive: true });
  await run("swiftc", ["-O", source, "-o", bin]).catch((e: Error) => {
    throw new Error(
      /ENOENT/.test(e.message)
        ? "This needs Apple’s command line tools. Run `xcode-select --install` in Terminal, then add it again."
        : `Couldn’t set up the Mac helper (${e.message.trim().split("\n")[0]}).`,
    );
  });
  return bin;
}

/** Runs a command; its stdout on success. Each stderr line goes to `onLine` as it comes. */
export function run(cmd: string, args: string[], onLine?: (line: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "";
    let err = "";
    let partial = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => {
      err += d;
      if (!onLine) return;
      const lines = (partial + d).split("\n");
      partial = lines.pop()!;
      for (const l of lines) onLine(l);
    });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(Object.assign(new Error(err.trim() || `${cmd} exited ${code}`), { code }))));
  });
}
