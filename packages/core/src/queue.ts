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
