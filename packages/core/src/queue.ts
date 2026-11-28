import { PRIORITY_WEIGHT, type Priority } from "./skills.ts";
import type { CardKind, CardState, ContentType } from "./cards.ts";

// Inputs for one candidate review item. Built from the index; kept plain so
// ordering is testable on its own.
export interface QueueEntry {
  id: string;
  kind: CardKind;
  state: CardState;
  content_type: ContentType;
  item: string;
  skills: string[];
  topics: string[];
  priority: Priority;
  question: string;
  due: string | null; // null: never reviewed
  retrievability: number; // 0 when never reviewed
  relearn: boolean; // missed earlier today, not yet re-asked
}

const NO_TOPIC = "(none)";
const primaryTopic = (e: QueueEntry) => e.topics[0] ?? NO_TOPIC;
export const score = (e: QueueEntry) => PRIORITY_WEIGHT[e.priority] * (1 - e.retrievability);

// Higher score first; under ties higher priority (P1 < P2 lexically), then
// earlier due, then id for stability.
function compare(a: QueueEntry, b: QueueEntry): number {
  return score(b) - score(a) || a.priority.localeCompare(b.priority) || (a.due ?? "").localeCompare(b.due ?? "") || a.id.localeCompare(b.id);
}

// A unit is served as one block: all concepts of a topic (confusables
// adjacent), all definitions from one source item, or a single item.
function unitKey(e: QueueEntry): string {
  if (e.content_type === "definition") return `def:${e.item}`;
  if (e.content_type === "concept") return `concept:${primaryTopic(e)}`;
  return `one:${e.id}`;
}

function orderGroup(entries: QueueEntry[]): QueueEntry[] {
  const units = new Map<string, QueueEntry[]>();
  for (const e of entries) {
    const k = unitKey(e);
    const u = units.get(k);
    if (u) u.push(e);
    else units.set(k, [e]);
  }
  const sortedUnits = [...units.values()].map((u) => u.sort(compare)).sort((a, b) => compare(a[0]!, b[0]!));

  // Round-robin over topics: each turn serves the next unit of each topic.
  const byTopic = new Map<string, QueueEntry[][]>();
  for (const u of sortedUnits) {
    const t = primaryTopic(u[0]!);
    const lane = byTopic.get(t);
    if (lane) lane.push(u);
    else byTopic.set(t, [u]);
  }
  const lanes = [...byTopic.values()];
  const out: QueueEntry[] = [];
  for (let round = 0; out.length < entries.length; round++) {
    for (const lane of lanes) {
      const unit = lane[round];
      if (unit) out.push(...unit);
    }
  }
  return out;
}

// SPEC §3: everything due interleaved by topic; today's relearn passes last.
export function orderQueue(entries: QueueEntry[]): QueueEntry[] {
  return [...orderGroup(entries.filter((e) => !e.relearn)), ...entries.filter((e) => e.relearn).sort(compare)];
}

/** How far down the queue the opening card may come from. */
const WIN_WINDOW = 10;

// D176: a session opens on a card he will likely recall. Most urgent first puts the hardest cards of a
// backlog back to back at the start, which is what makes people stop (Kang, Daniels & Schweitzer 2022).
// So the likeliest recall among the first ten comes first; the rest keep their order, and nothing about
// any card's schedule changes (D22). A card served in a block (confusables, one source's definitions)
// stays in its block.
export function winFirst(ordered: QueueEntry[]): QueueEntry[] {
  const size = new Map<string, number>();
  for (const e of ordered) size.set(unitKey(e), (size.get(unitKey(e)) ?? 0) + 1);
  let best = -1;
  ordered.slice(0, WIN_WINDOW).forEach((e, i) => {
    if (size.get(unitKey(e)) === 1 && (best < 0 || e.retrievability > ordered[best]!.retrievability)) best = i;
  });
  if (best <= 0 || ordered[best]!.retrievability <= ordered[0]!.retrievability) return ordered;
  return [ordered[best]!, ...ordered.slice(0, best), ...ordered.slice(best + 1)];
}

/** Below this chance of recall an exercise is a likely miss. For now: a coin flip. */
const LIKELY_MISS = 0.5;
/** How many likely misses may come back to back before a likely recall is brought forward. */
const MISS_RUN = 2;

// D360: never more than two likely misses in a row. Most forgotten first serves a backlog as one run of
// probable misses, and hard items in a run are what make people stop (Kang, Daniels & Schweitzer 2022;
// guidebook L246: difficulty has to be surmountable). So once two misses have come, the next exercise he
// will likely recall is brought forward to sit before the third. Order only: nothing is dropped or held
// back, no schedule changes (D22). A block (confusables, one source's definitions, D24) is never split,
// moved or interrupted, so a block of misses can run longer than two; when no likely recall is left the
// misses run on. `already`: the misses he has just made in a row (today's last ratings), so a fetch
// mid-session, the quick quiz's or `/ore`'s next batch, carries the run on instead of starting it at none.
export function pace(ordered: QueueEntry[], already = 0): QueueEntry[] {
  const size = new Map<string, number>();
  for (const e of ordered) size.set(unitKey(e), (size.get(unitKey(e)) ?? 0) + 1);
  const single = ordered.map((e) => size.get(unitKey(e)) === 1);
  const miss = (e: QueueEntry) => e.retrievability < LIKELY_MISS;
  // The likely recalls that may move, in queue order: `win` walks them once, so the whole pass is linear.
  const wins = ordered.flatMap((e, i) => (single[i] && !miss(e) ? [i] : []));
  const taken = new Set<number>();
  const out: QueueEntry[] = [];
  let run = already, win = 0;
  for (let i = 0; i < ordered.length; i++) {
    if (taken.has(i)) continue;
    const next = ordered[i]!;
    if (run >= MISS_RUN && single[i] && miss(next)) {
      while (win < wins.length && wins[win]! < i) win++;
      if (win < wins.length) {
        const at = wins[win++]!;
        taken.add(at);
        out.push(ordered[at]!);
        run = 0;
      }
    }
    out.push(next);
    run = miss(next) ? run + 1 : 0;
  }
  return taken.size ? out : ordered;
}
