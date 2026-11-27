import { writeFileSync } from "node:fs";
import { guarded } from "./guard.ts";
import { encode, importJob, type ImportJob } from "./import.ts";

/** One import, in its own process (isolate.ts): reads the job from its input, writes the reply's JSON. */

// First to go when memory runs out, before the server (Linux; elsewhere there is nothing to set).
try {
  writeFileSync("/proc/self/oom_score_adj", "1000");
} catch {}
// Every link the import opens, its images and redirects too, must be on the public web.
globalThis.fetch = guarded(globalThis.fetch);

const raw = new Uint8Array(await Bun.stdin.arrayBuffer());
const nl = raw.indexOf(10);
const head = JSON.parse(new TextDecoder().decode(raw.subarray(0, nl))) as { url: string } | { name: string; sizes: number[]; beside: string[] };
let job: ImportJob;
if ("url" in head) job = { url: head.url };
else {
  let at = nl + 1;
  const [main, ...rest] = head.sizes.map((n) => raw.subarray(at, (at += n)));
  job = { name: head.name, bytes: main!, beside: Object.fromEntries(head.beside.map((n, i) => [n, rest[i]!])) };
}
await Bun.write(Bun.stdout, JSON.stringify(encode(await importJob(job))));
