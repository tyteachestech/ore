import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ImportJob } from "./import.ts";

/** Each import runs in a process of its own (F761): it reads files and pages strangers
 *  send, and one made to eat memory (a zip bomb) or time (a page that never ends) must take down only
 *  itself, never the server and everyone signed in to it. The process gets a time limit, the first claim
 *  on being killed when memory runs out, and none of the server's secrets. */

export const WORKER = join(import.meta.dir, "import-worker.ts");
/** Longer than a 200 MB file takes to download and read; reopen if real sources are cut off by it. */
export const JOB_SECONDS = 300;
/** All an import reads from its environment (packages/core); a secret added to the server later stays out. */
const KEPT = ["PATH", "HOME", "LANG", "LC_ALL", "TZ", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "https_proxy", "http_proxy", "no_proxy", "SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS", "ORE_TRANSCRIBE", "ORE_NO_TOOLS", "ORE_OCR", "ORE_PADDLE", "ORE_PADDLE_HOME", "ORE_PADDLE_LOCK"];

const TOO_LONG = "That took Ore's server too long to read. Add it on your Mac.";
const FAILED = "Ore's server couldn't read that just now. Try again, or add it on your Mac.";

/** The reply's JSON text, as the server sends it. The job goes to the process on its input as one line
 *  of JSON (the link, or the names and sizes of the files) and then the files' bytes, in that order. */
export async function isolated(job: ImportJob, { script = WORKER, seconds = JOB_SECONDS } = {}): Promise<string> {
  const files = "url" in job ? [] : [job.bytes, ...Object.values(job.beside ?? {})];
  const head = "url" in job ? { url: job.url } : { name: job.name, sizes: files.map((f) => f.byteLength), beside: Object.keys(job.beside ?? {}) };
  // Its scratch space is made and removed here: a process that is killed can't clean up after itself.
  const scratch = mkdtempSync(join(tmpdir(), "ore-cloud-job-"));
  const env = { ...Object.fromEntries(KEPT.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]!])), TMPDIR: scratch };
  // In a process group of its own, so the time limit stops the tools it started too (git, a page reader).
  const proc = Bun.spawn([process.execPath, script], { stdin: "pipe", stdout: "pipe", stderr: "inherit", env, detached: true });
  const stop = () => {
    try {
      process.kill(-proc.pid, 9);
    } catch {
      proc.kill(9);
    }
  };
  let late = false;
  const timer = setTimeout(() => {
    late = true;
    stop();
  }, seconds * 1000);
  const send = (async () => {
    proc.stdin.write(JSON.stringify(head) + "\n");
    for (const f of files) proc.stdin.write(f);
    await proc.stdin.end();
  })().catch(() => {}); // a process that died early stops reading: its exit says what happened
  try {
    const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited, send]);
    if (late) return JSON.stringify({ refused: TOO_LONG });
    if (code !== 0 || !out) {
      console.error(`import process ended with ${proc.signalCode ?? code}`);
      return JSON.stringify({ refused: FAILED });
    }
    return out;
  } finally {
    clearTimeout(timer);
    stop(); // anything it left running
    rmSync(scratch, { recursive: true, force: true });
  }
}
