// `ore` on iPhone (phase 0 feel test): there is no CLI process to run, so the same command code
// runs inside the app. The screens call `ore(...args)` exactly as on the Mac (D30); only this
// module differs. node:fs, node:path, node:os, node:util and bun:sqlite are swapped for the phone
// versions in vite.config.ts.
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import { parseArgs } from "@pkgjs/parseargs";
import * as YAML from "yaml";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { mount, readFileSync } from "./fs";
import { ready } from "./sqlite";

export const ROOT = "/lib";

let stdin = "";
const g = globalThis as unknown as Record<string, unknown>;
// What the core and CLI read from Bun and Node besides the modules above.
g.process = {
  env: { ...(g.process as { env?: object } | undefined)?.env, ORE_LIBRARY: ROOT, ORE_NO_ENRICH: "1", ORE_DEVICE: "iphone" },
  platform: "ios",
  pid: 1,
  cwd: () => ROOT,
  kill: () => {
    throw new Error("no processes on iPhone");
  },
};
g.require = (m: string) => {
  if (m === "yaml") return YAML;
  throw new Error(`require(${m}) on iPhone`);
};
g.Bun = {
  YAML: { parse: YAML.parse },
  sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)),
  hash: (s: string) => {
    let h = 5381n;
    for (let i = 0; i < s.length; i++) h = (h * 33n + BigInt(s.charCodeAt(i))) & 0xffffffffffffn;
    return h;
  },
  CryptoHasher: class {
    private parts: string[] = [];
    update(s: string) {
      this.parts.push(s);
      return this;
    }
    digest() {
      return bytesToHex(sha256(new TextEncoder().encode(this.parts.join(""))));
    }
  },
  // AI runs through Claude Code or Codex on the Mac (D7): neither exists on the phone.
  which: () => null,
  stdin: { stream: () => new Response(stdin).body },
  spawn: () => {
    throw new Error("AI runs on your Mac for now");
  },
  spawnSync: () => ({ exitCode: 1, stdout: new Uint8Array(), stderr: new Uint8Array() }),
};

let booted: Promise<typeof import("ore-commands")> | null = null;
/** Loads the library snapshot and SQLite, then the command table. */
function boot() {
  booted ??= (async () => {
    const text = await (await fetch("/library.json")).text();
    const snap = JSON.parse(text) as Record<string, string>;
    await mount(Object.fromEntries(Object.entries(snap).map(([p, t]) => [`${ROOT}/${p}`, t])), bytesToHex(sha256(new TextEncoder().encode(text))));
    await ready(wasmUrl);
    return await import("ore-commands");
  })();
  return booted;
}

/** `ore <args> --json` in-process: the command's JSON output, or its one-line error. */
export async function run<T>(args: string[], input: string | null): Promise<T> {
  const { commands, errorLine } = await boot();
  const [name, ...rest] = args;
  const cmd = commands[name ?? ""];
  if (!cmd) throw new Error(`unknown command "${name}"`);
  if (needsAi(name!, rest)) throw new Error("AI runs on your Mac for now.");
  const { values, positionals } = parseArgs({ args: rest.filter((a) => a !== "--json"), options: { json: { type: "boolean" }, ...cmd.options }, allowPositionals: true, strict: true });
  stdin = input ?? "";
  try {
    const out = await cmd.run(positionals, values);
    // JSON round trip, as the CLI's stdout would be: the screens expect plain data.
    // A picture (thumbnail.*, a course cover) ships as a data URL in the file itself (vite.config.ts): hand
    // the screens the picture, not a path no web view can open.
    return JSON.parse(JSON.stringify(out.data ?? null, (k, v) => ((k === "thumbnail" || k === "course_cover") && typeof v === "string" ? picture(v) : v))) as T;
  } catch (e) {
    throw new Error(errorLine(e));
  }
}

function picture(path: string): string | undefined {
  try {
    const text = readFileSync(path);
    return text.startsWith("data:image/") ? text : undefined;
  } catch {
    return undefined;
  }
}

/** Commands that call Claude or Codex (D7), which the phone can't run: said plainly up front instead of
 *  failing on a missing prompt file. Storing a recall or his own key-point marks needs no AI. */
const AI = new Set(["grade", "ask", "enrich", "key-points", "research", "remix", "catch-up"]);
const needsAi = (name: string, args: string[]) =>
  AI.has(name) || (name === "recall" && args.includes("--feedback")) || (name === "check" && !args.some((a) => a.startsWith("--covered")));
