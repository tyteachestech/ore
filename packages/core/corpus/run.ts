// The import corpus (`bun run corpus`, README.md beside this): imports many real files of every kind,
// each into its own scratch library, audits each doc.md against its original (audit.ts), and compares
// each with the last accepted run, so a change to any import shows up on files no fixture covers.
//
//   bun run corpus                       the open corpus (open.json): openly licensed files, fetched once
//   bun run corpus ~/Calibre\ Library    every file under these folders (his own: results stay in .corpus/)
//   bun run corpus <list.json>           a list of files or links, shaped like open.json
//   --accept                             save this run as the one to compare against
//   --jobs 2  --only epub,pdf  --per 40  --timeout 600  --out <dir>
//
// Files are only read: each is imported from where it is into a scratch library under the system's temp
// folder, which is deleted after. Nothing is written beside them.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { audit, changes, coverage, fingerprint, type Fingerprint, type Flag } from "./audit.ts";
import { readOriginal } from "./original.ts";

interface Entry {
  /** A file path, or a link. */
  add: string;
  /** For a link to a file: its hash, so the same bytes are imported every run. */
  sha256?: string;
  /** What it is, for the report: a publisher, a kind of PDF. */
  note?: string;
  /** Its kind, for a link whose path has no extension (arXiv's /pdf/1706.03762v7). */
  kind?: string;
}

interface Result {
  key: string;
  add: string;
  note?: string;
  ms: number;
  error?: string;
  fp?: Fingerprint;
  flags?: Flag[];
  coverage?: ReturnType<typeof coverage>;
}

const HERE = import.meta.dir;
const REPO = resolve(HERE, "../../..");
// A folder of his own holds papers that are his business, not reading: they are left out of a run by name.
const PERSONAL = /\b(?:tax|taxes|return|w-?2|1099|invoice|receipt|statement|bank|payslip|pay stub|medical|health|lab results?|insurance|passport|licen[cs]e|lease|contract|resume|résumé|cv|cover letter|job hunt|offer letter|visa|ssn|password)s?\b/i;
const EXTS = new Set(["epub", "pdf", "docx", "pptx", "xlsx", "csv", "tsv", "ipynb", "md", "txt", "rtf", "html", "htm", "srt", "vtt", "mp3", "m4a", "wav", "png", "jpg", "jpeg"]);

// ── One import, in its own process so a crash or a hang ends only it ─────────────────────────────
if (process.argv[2] === "--one") {
  const [, , , add, docOut] = process.argv;
  const { initLibrary } = await import("../src/init.ts");
  const { addSource } = await import("../src/ingest/index.ts");
  const root = mkdtempSync(join(tmpdir(), "ore-corpus-"));
  const t0 = Date.now();
  try {
    await initLibrary(root);
    const item = await addSource({ root }, add);
    const doc = readFileSync(item.docPath, "utf8");
    writeFileSync(docOut, doc);
    const isFile = existsSync(add);
    const orig = isFile ? await readOriginal(new Uint8Array(readFileSync(add)), extname(add)).catch(() => undefined) : undefined;
    const meta = item.meta as unknown as Record<string, unknown>;
    console.log(JSON.stringify({ ms: Date.now() - t0, fp: fingerprint(meta, item.body), flags: audit(meta, item.body, item.dir, orig), ...(orig ? { coverage: coverage(orig, item.body) } : {}) }));
  } catch (e) {
    console.log(JSON.stringify({ ms: Date.now() - t0, error: (e as Error).message.split("\n")[0].slice(0, 300) }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  process.exit(0);
}

// ── The run ───────────────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const flagArg = (name: string) => (args.includes(`--${name}`) ? (args.splice(args.indexOf(`--${name}`), 1), true) : false);
const accept = flagArg("accept");
// Picks up a run that was stopped: files imported since it started are not imported again.
const resume = flagArg("resume");
const jobs = Number(opt("jobs") ?? 2);
const timeout = Number(opt("timeout") ?? 600) * 1000;
const perArg = opt("per");
const per = perArg ? Number(perArg) : Infinity;
const only = opt("only")?.split(",");
const outArg = opt("out");
const inputs = args.length ? args : [join(HERE, "open.json")];
const open = inputs.length === 1 && resolve(inputs[0]) === join(HERE, "open.json");
const out = resolve(outArg ?? process.env.ORE_CORPUS ?? join(REPO, ".corpus"));
// The open corpus's accepted run is kept in the repo, so a PR shows what it changed; anything else stays in .corpus/.
const baseDir = open ? join(HERE, "open-baseline") : join(out, "baseline");
for (const d of [out, join(out, "docs"), join(out, "results"), join(out, "cache"), baseDir]) mkdirSync(d, { recursive: true });
const marker = join(out, "run-started");
if (!resume || !existsSync(marker)) writeFileSync(marker, new Date().toISOString());
const started = statSync(marker).mtimeMs;

const sha = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");

function walk(dir: string, found: string[]) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const p = join(dir, name);
    const s = statSync(p, { throwIfNoEntry: false });
    if (s?.isDirectory()) walk(p, found);
    else if (s?.isFile() && EXTS.has(extname(name).slice(1).toLowerCase()) && !PERSONAL.test(p)) found.push(p);
  }
}

let entries: Entry[] = [];
for (const input of inputs) {
  const p = resolve(input.replace(/^~(?=\/)/, process.env.HOME ?? "~"));
  if (p.endsWith(".json") && existsSync(p)) entries.push(...(JSON.parse(readFileSync(p, "utf8")).entries as Entry[]));
  else if (existsSync(p) && statSync(p).isDirectory()) {
    const found: string[] = [];
    walk(p, found);
    entries.push(...found.map((add) => ({ add })));
  } else entries.push({ add: input });
}
const extOf = (e: Entry) => e.kind ?? (/^https?:/.test(e.add) && !e.sha256 ? "link" : extname(e.add.split("?")[0]).slice(1).toLowerCase() || "link");
if (only) entries = entries.filter((e) => only.includes(extOf(e)));

// A file with a hash is fetched once into the cache and imported from there; its key is its hash.
async function local(e: Entry): Promise<{ add: string; key: string }> {
  if (!/^https?:/.test(e.add)) {
    // A file's key is a hash of its bytes: the same book in two folders is one entry.
    return { add: e.add, key: sha(readFileSync(e.add)).slice(0, 16) };
  }
  if (!e.sha256) return { add: e.add, key: sha(e.add).slice(0, 16) };
  const ext = `.${extOf(e)}`;
  const file = join(out, "cache", e.sha256.slice(0, 16) + ext);
  if (!existsSync(file)) {
    const res = await fetch(e.add, { headers: { "user-agent": "Ore corpus" } });
    if (!res.ok) throw new Error(`${res.status} fetching ${e.add}`);
    const data = new Uint8Array(await res.arrayBuffer());
    if (sha(data) !== e.sha256) throw new Error(`${e.add} changed: its hash is now ${sha(data)}`);
    writeFileSync(file, data);
  }
  return { add: file, key: e.sha256.slice(0, 16) };
}

// Several of a kind at most (--per), spread through the list, and each file once.
const byKind = new Map<string, Entry[]>();
for (const e of entries) byKind.set(extOf(e), [...(byKind.get(extOf(e)) ?? []), e]);
const picked: Entry[] = [];
for (const list of byKind.values()) {
  const step = list.length > per ? list.length / per : 1;
  for (let i = 0; i < list.length && picked.length < entries.length; i += step) picked.push(list[Math.floor(i)]);
}

function one(add: string, key: string): Promise<Omit<Result, "key" | "add">> {
  const proc = Bun.spawn(["bun", import.meta.path, "--one", add, join(out, "docs", `${key}.md`)], { stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => proc.kill(), timeout);
  // Read at once, beside stdout: a child that fills the stderr pipe would block until the timeout.
  const errText = new Response(proc.stderr).text();
  return new Response(proc.stdout).text().then(async (text) => {
    clearTimeout(timer);
    await proc.exited;
    const last = text.trim().split("\n").pop() ?? "";
    try {
      return JSON.parse(last);
    } catch {
      return { ms: timeout, error: proc.signalCode ? `took over ${timeout / 1000} s` : `crashed: ${(await errText).trim().split("\n").slice(-1)[0]?.slice(0, 200)}` };
    }
  });
}

const results: Result[] = [];
const seenKeys = new Set<string>();
let next = 0;
let done = 0;
async function worker() {
  while (next < picked.length) {
    const e = picked[next++];
    let add = e.add;
    let key = "";
    try {
      ({ add, key } = await local(e));
    } catch (err) {
      // Keyed as `local` keys it, so a pinned link that stops downloading is a regression against its accepted run.
      results.push({ key: e.sha256?.slice(0, 16) ?? sha(e.add).slice(0, 16), add: e.add, note: e.note, ms: 0, error: (err as Error).message });
      continue;
    }
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const saved = join(out, "results", `${key}.json`);
    if (resume && existsSync(saved) && statSync(saved).mtimeMs >= started) {
      results.push(JSON.parse(readFileSync(saved, "utf8")));
      continue;
    }
    const r = { key, add: e.add, ...(e.note ? { note: e.note } : {}), ...(await one(add, key)) };
    results.push(r);
    writeFileSync(join(out, "results", `${key}.json`), JSON.stringify(r, null, 1));
    done++;
    process.stderr.write(`\r${done} of ${picked.length} `);
  }
}
await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker));
process.stderr.write("\n");

// ── The report: what is new since the accepted run ───────────────────────────────────────────────
const name = (r: Result) => (r.note ? `${r.note}: ` : "") + (/^https?:/.test(r.add) ? r.add : basename(r.add));
const lines: string[] = [];
let regressions = 0;
let newFlags = 0;
const counts = new Map<string, number>();
for (const r of results.sort((a, b) => a.add.localeCompare(b.add))) {
  const basePath = join(baseDir, `${r.key}.json`);
  const base: Result | undefined = existsSync(basePath) ? JSON.parse(readFileSync(basePath, "utf8")) : undefined;
  const said: string[] = [];
  if (r.error && !(base?.error === r.error)) said.push(`refused or failed: ${r.error}`);
  if (base?.fp && r.fp) said.push(...changes(base.fp, r.fp));
  if (base?.fp && !r.fp) said.push("imported before, fails now");
  const was = new Set((base?.flags ?? []).map((f) => f.rule));
  const fresh = (r.flags ?? []).filter((f) => !was.has(f.rule));
  for (const f of r.flags ?? []) counts.set(f.rule, (counts.get(f.rule) ?? 0) + 1);
  said.push(...fresh.map((f) => `flag ${f.rule}: ${f.detail}`));
  if (base && said.length) regressions++;
  newFlags += fresh.length;
  if (said.length) lines.push(`- ${name(r)}${base ? "" : " (new)"} [${r.key}]\n${said.map((s) => `    ${s}`).join("\n")}`);
  if (accept) {
    writeFileSync(basePath, JSON.stringify({ ...r, ms: undefined }, null, 1) + "\n");
    // His own files' docs are kept beside their accepted fingerprints, so a later change can be read line by line.
    const doc = join(out, "docs", `${r.key}.md`);
    if (!open && existsSync(doc)) writeFileSync(join(baseDir, `${r.key}.md`), readFileSync(doc));
  }
}
const kinds = [...byKind].map(([k, l]) => `${k} ${Math.min(l.length, per)}`).join(", ");
const summary = [
  `Imported ${results.length} (${kinds}) in ${out}`,
  `${results.filter((r) => r.error).length} refused or failed; ${regressions} changed since the accepted run; ${newFlags} new flags.`,
  `Flags by rule: ${[...counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}`,
  accept ? `Saved as the accepted run in ${baseDir}.` : "",
].filter(Boolean);
const report = [...summary, "", ...lines].join("\n");
writeFileSync(join(out, "report.md"), report + "\n");
console.log(report);
console.log(`\nEach doc.md is in ${join(out, "docs")}/<key>.md`);
process.exit(regressions && !accept ? 1 : 0);
