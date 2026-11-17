// Which `ore` commands call Claude or Codex (D7), in one list for the app, the phone and the mock bridge.

/** Commands that answer with what the AI said, which the app reads as an object. */
const ANSWERS = new Set(["tutor", "ask", "ask-library", "grade", "key-points", "check", "explain", "research"]);
/** Commands that call it and write what it made (enrich, remix and the daily catch-up, run in the background). */
const WRITES = new Set(["enrich", "remix", "catch-up"]);

/** Whether a run answers with what the AI said. Not `check --covered` (his own marks, stored), a `recall`
 *  without `--feedback` (what he wrote, stored), a `tried` without `--line` or a `dig` that only keeps or ends one: those call no AI. */
export function answersWithAi(args: string[]): boolean {
  const [name] = args;
  if (name === "recall") return args.includes("--feedback");
  if (name === "tried") return args.includes("--line");
  if (name === "dig") return args.some((a) => a === "--ask" || a.startsWith("--answer"));
  if (name === "check") return !args.some((a) => a === "--covered" || a.startsWith("--covered="));
  return ANSWERS.has(name!);
}

/** Whether a run calls the AI at all: the phone can't (it says so up front) and the mock bridge answers it canned. */
export const callsAi = (args: string[]): boolean => answersWithAi(args) || WRITES.has(args[0]!);
