// `ore` on iPhone (phase 0 feel test): there is no CLI process to run, so the same command code
// runs inside the app. The screens call `ore(...args)` exactly as on the Mac (D30); only this
// module differs. node:fs, node:path, node:os, node:util and bun:sqlite are swapped for the phone
// versions in vite.config.ts.
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import { parseArgs } from "@pkgjs/parseargs";
import * as YAML from "yaml";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { setLibraryRoot } from "./tauri-core";
import { existsSync, load, mkdirSync, mount, mountDisk, readdirSync, readFileSync, rescan, rmSync, writeFileSync } from "./fs";
import { ready } from "./sqlite";

export const ROOT = "/lib";

let stdin = "";
const g = globalThis as unknown as Record<string, unknown>;
// What the core and CLI read from Bun and Node besides the modules above.
g.process = {
  env: { ...(g.process as { env?: object } | undefined)?.env, ORE_LIBRARY: ROOT, ORE_NO_ENRICH: "1", ORE_NO_TOOLS: "1", ORE_DEVICE: "iphone" },
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

/** Other sites go through the shell's native fetch (apps/phone/src-tauri/src/lib.rs `http_fetch`): a web view
 *  can't read them (CORS, and the CSP's connect-src). Same-origin and data/blob URLs stay with the web view. */
if (isTauri()) {
  const own = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!/^https?:/i.test(url) || new URL(url).origin === location.origin) return own(input, init);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    // The shell's fetch only reads: nothing the importers do sends a body.
    if (init?.body != null || (method !== "GET" && method !== "HEAD")) throw new TypeError(`fetch failed: the iPhone app only reads other sites (${method} ${url})`);
    const headers = [...new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).entries()];
    type Fetched = { status: number; url: string; headers: [string, string][]; body: string };
    const r = await invoke<Fetched>("http_fetch", { url, method, headers }).catch((e) => {
      throw new TypeError(`fetch failed: ${e}`);
    });
    const bin = atob(r.body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const res = new Response([101, 204, 205, 304].includes(r.status) ? null : bytes, { status: r.status, headers: r.headers });
    Object.defineProperty(res, "url", { value: r.url });
    Object.defineProperty(res, "redirected", { value: r.url !== url });
    return res;
  }) as typeof fetch;
}

/** Links the Share Extension saved since (apps/phone/share) come into the library's inbox. */
let libraryDir: string | null = null;
const shared = () => (libraryDir ? invoke<number>("share_inbox", { root: libraryDir }).catch(() => 0) : Promise.resolve(0));

/** The share card files a link under a skill with one tap: it shows these, in the sidebar's order. */
export const shareSkills = (skills: { id: string; name: string }[]) =>
  void (isTauri() && invoke("share_skills", { json: JSON.stringify(skills.map(({ id, name }) => ({ id, name }))) }).catch(() => false));

let booted: Promise<typeof import("ore-commands")> | null = null;
/** Loads the library (Ore's iCloud Drive folder on the phone, the snapshot in a browser) and SQLite, then the command table. */
function boot() {
  booted ??= (async () => {
    if (isTauri()) {
      const root = await invoke<string | null>("library_dir");
      if (!root) throw new Error("Turn on iCloud Drive for Ore: Settings › your name › iCloud › Drive.");
      libraryDir = root;
      await shared();
      await mountDisk(ROOT, root, invoke);
      // A source's own files (its images) load from the folder itself: /lib/... is the folder on disk.
      setLibraryRoot(ROOT, root);
    } else {
      const text = await (await fetch("/library.json")).text();
      const snap = JSON.parse(text) as Record<string, string>;
      await mount(Object.fromEntries(Object.entries(snap).map(([p, t]) => [`${ROOT}/${p}`, t])), bytesToHex(sha256(new TextEncoder().encode(text))));
    }
    await ready(wasmUrl);
    return await import("ore-commands");
  })();
  // A failed start (iCloud Drive off) tries again on the next command, once he has turned it on.
  booted.catch(() => (booted = null));
  return booted;
}

let turn: Promise<unknown> = Promise.resolve();
/** One at a time: a command never runs while another, or a read of the Mac's changes, is halfway through. */
function exclusive<T>(f: () => Promise<T>): Promise<T> {
  const r = turn.then(f, f);
  turn = r.catch(() => {});
  return r;
}

/** Reads in what changed on the Mac (through iCloud) since; true if anything did. */
export const pull = () =>
  booted
    ? booted
        .then(async () => {
          const came = await shared();
          return (await exclusive(rescan)) || came > 0;
        })
        .catch(() => false)
    : Promise.resolve(false);

/** A file the share sheet saved to the inbox is listed, not loaded (fs.ts): this phone's own come in as bytes
 *  before an import reads them. Another device's is left for that device, or the Mac. */
async function loadShared() {
  const dir = `${ROOT}/inbox`;
  if (!existsSync(dir)) return;
  for (const n of readdirSync(dir)) {
    if (!n.endsWith(".file.json")) continue;
    try {
      const q = JSON.parse(readFileSync(`${dir}/${n}`, "utf8")) as { file?: unknown; device?: unknown };
      if (q.device === "iphone" && typeof q.file === "string" && !q.file.includes("..")) await load(`${dir}/${q.file}`);
    } catch {}
  }
}

/** `ore <args> --json` in-process: the command's JSON output, or its one-line error. */
export async function run<T>(args: string[], input: string | null): Promise<T> {
  const lib = await boot();
  if (args[0] === "inbox" && args.includes("--import")) await loadShared();
  return exclusive(() => command<T>(lib, args, input));
}

async function command<T>({ commands, errorLine }: typeof import("ore-commands"), args: string[], input: string | null): Promise<T> {
  const [name, ...rest] = args;
  // The journeys' failure path, as on the Mac's mock (scripts/mock/tauri.js): `window.__ORE_FAIL = { notes: "why" }`.
  const fail = import.meta.env.DEV && (globalThis as { __ORE_FAIL?: Record<string, string> }).__ORE_FAIL?.[name ?? ""];
  if (fail) throw new Error(fail);
  // Before iCloud has brought the library down, say so, never "run ore init" (the Mac's library is the one).
  if (isTauri() && !existsSync(`${ROOT}/skills.yaml`)) throw new Error("Your library is on its way from iCloud. It shows here once your Mac has uploaded it.");
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

/** A file picked on the phone (a PDF, a book, a photo) is saved to the inbox, as a link is (D227): its bytes
 *  pass through a scratch path the folder never sees. */
let picks = 0;
export async function queuePicked(name: string, bytes: Uint8Array): Promise<void> {
  await boot();
  const dir = `${ROOT}/.ore/pick-${++picks}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${name}`, bytes);
  try {
    await run(["inbox", "--add-file", `${dir}/${name}`, "--name", name, "--json"], null);
  } finally {
    rmSync(dir, { recursive: true });
  }
}
