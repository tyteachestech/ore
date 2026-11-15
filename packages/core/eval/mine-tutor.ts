// Finds the tutor turns Tyler wasn't happy with in his real chats, as candidate cases for the tutor eval
// (D295): a reply he asked for again or reworded his message after, one he stopped, one that
// failed. His own second tries say which replies missed, with no thumbs to press. Each candidate carries the
// turns before it and the reply he turned down; read it, decide what the reply should have done, and write
// that as a case's `expect` in tutor-cases.json. Then the waits the library's log recorded: how long a reply
// takes him, and how often one went back to be fixed. Read-only, no AI: `bun run eval:mine:tutor`
// (ORE_LIBRARY picks the library).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listChats, readChat } from "../src/chats.ts";
import { openLibrary, paths, type Library } from "../src/library.ts";

type Version = { message?: string; reply?: string; error?: string; stopped?: boolean; item?: string };
type Turn = Version & { id: string; alts?: Version[] };
export interface Candidate {
  id: string;
  signal: "asked again" | "reworded" | "stopped" | "failed";
  message: string;
  earlier: { message: string; reply: string }[];
  item?: string;
  /** The replies he didn't keep, oldest first. */
  turned_down: string[];
  /** The reply on screen now, when there is one. */
  kept?: string;
}

export function candidates(lib: Library): Candidate[] {
  const out: Candidate[] = [];
  for (const row of listChats(lib)) {
    let turns: Turn[];
    try { turns = readChat(lib, row.id).turns as Turn[]; } catch { continue; } // a chat file that can't be read
    turns.forEach((t, i) => {
      const alts = t.alts ?? [];
      const reworded = alts.find((a) => a.message !== undefined && a.message !== t.message);
      const signal = reworded ? "reworded" : alts.length ? "asked again" : t.stopped ? "stopped" : t.error ? "failed" : null;
      if (!signal) return;
      out.push({
        id: `${row.id}-${t.id}`, signal, message: reworded?.message ?? t.message ?? "",
        earlier: turns.slice(0, i).flatMap((x) => (x.message && x.reply ? [{ message: x.message, reply: x.reply }] : [])),
        ...(t.item ? { item: t.item } : {}),
        turned_down: alts.flatMap((a) => (a.reply ? [a.reply] : a.error ? [`(failed: ${a.error})`] : [])).concat(!alts.length && t.error ? [`(${t.stopped ? "stopped" : "failed"}: ${t.error})`] : []),
        ...(t.reply ? { kept: t.reply } : {}),
      });
    });
  }
  return out;
}

/** What `tutor.jsonl` says of his real waits: turns, the median wait, and how many went back for a second
 *  run, had a citation mended, searched the web or failed. */
export function waits(lib: Library) {
  const file = join(paths.logs(lib), "tutor.jsonl");
  const lines = (existsSync(file) ? readFileSync(file, "utf8").split("\n") : []).flatMap((l) => {
    try { const x = JSON.parse(l) as { ms?: number; runs?: number; moved?: number; dropped?: number; searched?: boolean; error?: string }; return x && typeof x === "object" ? [x] : []; } catch { return []; }
  });
  const ms = lines.map((l) => l.ms ?? 0).sort((a, b) => a - b);
  return {
    turns: lines.length, median_s: lines.length ? Math.round(ms[Math.floor((ms.length - 1) / 2)]! / 100) / 10 : 0,
    went_back: lines.filter((l) => (l.runs ?? 1) > 1).length, mended: lines.filter((l) => (l.moved ?? 0) + (l.dropped ?? 0) > 0).length,
    searched: lines.filter((l) => l.searched).length, failed: lines.filter((l) => l.error).length,
  };
}

if (import.meta.main) {
  const lib = openLibrary();
  const found = candidates(lib);
  const w = waits(lib);
  console.error(`${found.length} tutor turn${found.length === 1 ? "" : "s"} he asked again, reworded, stopped or that failed.`);
  console.error(w.turns ? `${w.turns} logged turns: median wait ${w.median_s} s; ${w.went_back} went back for a second run, ${w.mended} had a citation mended, ${w.searched} searched the web, ${w.failed} failed.` : "No turns logged yet (.ore/logs/tutor.jsonl).");
  console.log(JSON.stringify(found, null, 2));
}
