import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { paths, type Library } from "./library.ts";

/** One AI run as `usage.jsonl` keeps it (#547): what each job spends, so Ore Cloud's allowance and price
 *  (D355) rest on measured numbers, not the estimate of 2026-11-26. `cost_usd` is the vendor's own figure
 *  (claude gives one, codex only tokens). A run that failed still spent what it spent. */
export interface UsageLine {
  ts: string;
  job: string;
  vendor: string;
  model: string;
  prompt_version: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd?: number;
  runs: number;
  ok: boolean;
}

const file = (lib: Library) => join(paths.logs(lib), "usage.jsonl");

/** Adds a run's line. Best effort: a log that can't be written never fails the run it describes. */
export function logUsage(lib: Library, line: UsageLine): void {
  try {
    mkdirSync(paths.logs(lib), { recursive: true });
    appendFileSync(file(lib), JSON.stringify(line) + "\n");
  } catch {
    // a read-only or vanished library: the run still counts
  }
}

export interface UsageTotal { runs: number; input_tokens: number; output_tokens: number; cost_usd: number; /** Runs whose vendor gave no dollar figure (codex): their cost is not in `cost_usd`. */ unpriced_runs: number }

/** `ore usage`: every month's spend, by job. Lines that don't parse (a write cut short) are skipped. */
export function usageSummary(lib: Library): { months: Record<string, { total: UsageTotal; jobs: Record<string, UsageTotal> }> } {
  const months: Record<string, { total: UsageTotal; jobs: Record<string, UsageTotal> }> = {};
  if (!existsSync(file(lib))) return { months };
  const zero = (): UsageTotal => ({ runs: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0, unpriced_runs: 0 });
  const add = (t: UsageTotal, l: UsageLine) => {
    t.runs += l.runs;
    t.input_tokens += l.input_tokens;
    t.output_tokens += l.output_tokens;
    if (typeof l.cost_usd === "number") t.cost_usd = Math.round((t.cost_usd + l.cost_usd) * 1e6) / 1e6;
    else t.unpriced_runs += l.runs;
  };
  for (const raw of readFileSync(file(lib), "utf8").split("\n")) {
    if (!raw.trim()) continue;
    let l: UsageLine;
    try {
      l = JSON.parse(raw) as UsageLine;
    } catch {
      continue;
    }
    if (typeof l.ts !== "string" || typeof l.job !== "string") continue;
    const m = (months[l.ts.slice(0, 7)] ??= { total: zero(), jobs: {} });
    add(m.total, l);
    add((m.jobs[l.job] ??= zero()), l);
  }
  return { months };
}
