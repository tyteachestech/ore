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
import { iterableStreams } from "./streams";
import { shareList } from "./share-skills";
import { setFilling } from "../Filling";

// Before any import runs: iOS 26 can't iterate a stream with `for await`, and pdf.js reads a PDF's text that way.
iterableStreams();

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
    // Raw bytes, never base64 text (an hour's podcast as text cost eleven times its size): four bytes of
    // length, that much JSON, then the body.
    const got = new Uint8Array(
      await invoke<ArrayBuffer>("http_fetch", { url, method, headers }).catch((e) => {
        throw new TypeError(`fetch failed: ${e}`);
      }),
    );
    const head = 4 + new DataView(got.buffer, got.byteOffset).getUint32(0);
    const r = JSON.parse(new TextDecoder().decode(got.subarray(4, head))) as { status: number; url: string; headers: [string, string][] };
    const bytes = got.subarray(head);
    // A status the web's Response can't hold (LinkedIn's 999) is a refusal: 520, so the importer says so itself.
    const status = r.status >= 200 && r.status <= 599 ? r.status : 520;
    const res = new Response([204, 205, 304].includes(status) ? null : bytes, { status, headers: r.headers });
    Object.defineProperty(res, "url", { value: r.url });
    Object.defineProperty(res, "redirected", { value: r.url !== url });
    return res;
  }) as typeof fetch;
}

/** Links the Share Extension saved since (apps/phone/share) come into the library's inbox. */
let libraryDir: string | null = null;
const shared = () => (libraryDir ? invoke<number>("share_inbox", { root: libraryDir }).catch(() => 0) : Promise.resolve(0));

/** The share card files a link under a skill with one tap: it shows these, in the sidebar's order. */
export const shareSkills = (skills: { id: string; name: string; icon?: string; color?: string }[]) =>
  void (isTauri() && invoke("share_skills", { json: JSON.stringify(shareList(skills)) }).catch(() => false));

/** The inbox item the share card's Open asked to see (lib.rs `share_open`), once. */
export const shareOpen = () => (isTauri() ? invoke<string | null>("share_open").catch(() => null) : Promise.resolve(null));

/** Speech to a timed transcript in the shell (lib.rs `transcribe`): the audio goes over as raw bytes, its
 *  WebVTT comes back, or why not in the phone's own words. It works only while Ore is on screen. */
const hear = (data: Uint8Array, ext: string, progress?: (done: number, label?: string) => void, language?: string) => {
  progress?.(0);
  const min = (s: number) => Math.max(1, Math.round(s / 60));
  heard = (done, of) => progress?.(done / of, `Transcribing ${min(done)} of ${min(of)} min`);
  return invoke<string>("transcribe", data, { headers: { "x-ext": ext, ...(language ? { "x-language": language } : {}) } })
    .catch((e) => {
      throw new Error(String(e));
    })
    .finally(() => (heard = null));
};
/** The shell says how far a long wait is (lib.rs `progress`): seconds of audio heard, bytes of a download. */
let heard: ((done: number, of: number) => void) | null = null;
let downloaded: ((got: number, of: number) => void) | null = null;

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
      // Podcasts and audio are heard here when this iPhone can (D227): the shell runs Apple's on-device speech.
      if (await invoke<boolean>("can_transcribe").catch(() => false)) await (await import("ore-commands")).setTranscriber(hear);
      const { listen } = await import("@tauri-apps/api/event");
      void listen<[number, number]>("hear-progress", (e) => heard?.(...e.payload));
      void listen<[number, number]>("download-progress", (e) => downloaded?.(...e.payload));
    } else {
      const text = await (await fetch("/library.json")).text();
      const snap = JSON.parse(text) as Record<string, string | null>;
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

/** What came in with a part owed (an episode in at once, D227) is downloaded and heard here, outside any
 *  command so the app stays his meanwhile; only its writing takes a turn. One pass at a time; `landed`
 *  after each source filled. The screens read how far it is from Filling.tsx. */
let filling = false;
let fillAgain = false;
export async function fill(landed: () => void): Promise<void> {
  if (filling) return void (fillAgain = true);
  filling = true;
  let on: string | null = null;
  try {
    const lib = await boot();
    // The journeys' stand-in for the iPhone's speech: `window.__ORE_HEAR = { vtt, hold }`, heard once `hold` is off.
    const stand = import.meta.env.DEV && (globalThis as { __ORE_HEAR?: { vtt: string; hold?: boolean } }).__ORE_HEAR;
    if (stand)
      await lib.setTranscriber(async (_data, _ext, progress) => {
        progress?.(0);
        while (stand.hold) await new Promise((r) => setTimeout(r, 50));
        return stand.vtt;
      });
    await lib.fillOwedHere({
      onProgress: (id, done, label) => {
        if (on && on !== id) landed();
        on = id;
        setFilling({ id, done, label });
        // The shell's download arrives whole: while one is named, its own count says how far it is.
        const mb = (n: number) => Math.max(1, Math.round(n / 1e6));
        downloaded = label === "Downloading" ? (got, of) => setFilling({ id, done: got / of, label: `Downloading ${mb(got)} of ${mb(of)} MB` }) : null;
      },
      turn: exclusive,
    });
  } catch {
    // One that failed keeps its reason on the source itself (core `fillOwed`).
  } finally {
    setFilling(null);
    downloaded = null;
    filling = false;
    if (on) landed();
    if (fillAgain) (fillAgain = false), void fill(landed);
  }
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
      if (q.device === "iphone" && typeof q.file === "string" && !q.file.split("/").some((part) => !part || part === "." || part === "..")) await load(`${dir}/${q.file}`);
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
    const got = readFileSync(path) as string | Uint8Array;
    if (typeof got === "string") return got.startsWith("data:image/") ? got : undefined;
    // One this phone just saved (an import's thumbnail) is still its bytes: the same data URL the folder's read gives.
    const kind = ({ jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp", gif: "gif" } as Record<string, string>)[path.split(".").pop()!.toLowerCase()];
    let bin = "";
    for (let i = 0; i < got.length; i += 0x8000) bin += String.fromCharCode(...got.subarray(i, i + 0x8000));
    return kind ? `data:image/${kind};base64,${btoa(bin)}` : undefined;
  } catch {
    return undefined;
  }
}

/** Commands that call Claude or Codex (D7), which the phone can't run: said plainly up front instead of
 *  failing on a missing prompt file. Storing a recall or his own key-point marks needs no AI. */
const AI = new Set(["grade", "ask", "enrich", "key-points", "research", "remix", "catch-up"]);
const needsAi = (name: string, args: string[]) =>
  AI.has(name) || (name === "recall" && args.includes("--feedback")) || (name === "check" && !args.some((a) => a.startsWith("--covered")));

/** A file picked on the phone (a PDF, a book, a photo) is saved to the inbox, as a link is (D235): its bytes
 *  pass through a scratch path the folder never sees. */
let picks = 0;
export async function queuePicked(name: string, bytes: Uint8Array, skill?: string): Promise<void> {
  await boot();
  const dir = `${ROOT}/.ore/pick-${++picks}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${name}`, bytes);
  try {
    await run(["inbox", "--add-file", `${dir}/${name}`, "--name", name, ...(skill ? ["--skill", skill] : []), "--json"], null);
  } finally {
    rmSync(dir, { recursive: true });
  }
}
