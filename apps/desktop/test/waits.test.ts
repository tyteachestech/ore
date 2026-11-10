import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// The wait rule (AGENTS.md, Interaction checklist): every wait on the AI or the network shows that
// it is working at once, through <Working label=…> (or the Matrix it draws), never a blank or a
// still line. Each slow `ore` call is listed here as the label its screen shows while it runs, or as
// "background: <why>" when nothing waits on it ("Other.tsx: <label>" when another file draws it). A new slow call fails this test until it is listed.
const WAITS: Record<string, string> = {
  "Review.tsx grade": "Checking your answer…",
  "Finish.tsx key-points": "Finding the key points…",
  "Finish.tsx check": "Checking your answer…",
  "Finish.tsx scope": "Leaving that out…",
  "Finish.tsx recall --feedback": "Reading your recall against the source…",
  "Finish.tsx enrich": "background: cards are drafted after he leaves; a failure toasts its reason with Try again",
  "Reader.tsx enrich": "Writing prequestions…",
  "Reader.tsx recall --feedback": "Reading your recall against the chapter…",
  "Explain.tsx explain": "Explaining…",
  "Explain.tsx research": "Finding sources…",
  "SkillPage.tsx research": "Finding sources…",
  "SkillPage.tsx add": "Adding…",
  "Tutor.tsx tutor": "Reading your sources…",
  "Ask.tsx ask": "background: the reply's own dots (ask-dots) stand in for the label, as ChatGPT's do",
  "App.tsx feed follow": "Add.tsx: Adding…",
  "App.tsx feed open": "Feed.tsx: Opening…",
  "App.tsx feed --refresh": "background: the timer's refresh; nothing waits on it",
  "Feed.tsx feed --refresh": "Checking your feeds…",
  "Add.tsx feed find": "background: only offers Follow once a feed is found",
  "Settings.tsx models": "background: the saved model shows until the list arrives",
  // Docling reads a PDF's tables and formulas (D125); its download (oreJob) shows "Downloading the table and formula reader".
  "Tables.tsx tables": "Reading the ",
};

// AI calls (the mock bridge's list) and the ones that go out to the network.
const SLOW = new Set(["enrich", "catch-up", "ask", "ask-library", "tutor", "grade", "key-points", "check", "research", "explain", "scope", "add", "models", "tables"]);
const SLOW_FEED = new Set(["follow", "open", "find", "--refresh"]);

const src = join(import.meta.dir, "../src");
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
}

const found = new Map<string, string>(); // call → the file's code, for its labels
for (const path of files(src)) {
  const code = readFileSync(path, "utf8");
  const name = relative(src, path);
  for (const m of code.matchAll(/\bore(?:Detached|Job)?(?:<[\s\S]{0,200}?>)?\(\s*(?:[\w.]+,\s*[\w.]+,\s*)?"([a-z-]+)"(?:,\s*"([a-z-]+)")?([^\n]*)/g)) {
    const [, cmd, sub, rest] = m as unknown as [string, string, string | undefined, string];
    let key: string | null = null;
    if (cmd === "feed") key = sub && SLOW_FEED.has(sub) ? `feed ${sub}` : !sub && rest.includes('"--refresh"') ? "feed --refresh" : null;
    else if (cmd === "recall") key = `${sub ?? ""}${rest}`.includes("--feedback") ? "recall --feedback" : null;
    else if (cmd === "check") key = rest.includes('"covered"') ? null : "check"; // --covered stores his own marks
    else if (SLOW.has(cmd)) key = cmd;
    if (key) found.set(`${name} ${key}`, code);
  }
}

describe("waits show they are working", () => {
  test("every AI or network call is listed with its wait label", () => {
    expect([...found.keys()].filter((k) => !(k in WAITS))).toEqual([]);
  });

  test("the list names only calls that exist", () => {
    expect(Object.keys(WAITS).filter((k) => !found.has(k))).toEqual([]);
  });

  test("each listed label is drawn with the working spinner on its screen", () => {
    const bad = Object.entries(WAITS).filter(([k, label]: [string, string]) => {
      if (label.startsWith("background: ")) return false;
      const at = /^(\w+\.tsx): (.*)$/.exec(label);
      const code = at ? readFileSync(join(src, at[1]!), "utf8") : found.get(k);
      if (at) label = at[2]!;
      // The spinner sits on the label itself (<Working label=…>) or just before it (a badge's Matrix).
      return !code || ![...code.matchAll(/<Working\b|<Matrix\b/g)].some((m) => {
        const near = code.slice(m.index, m.index + 500);
        return near.includes(label);
      });
    });
    expect(bad.map(([k]) => k)).toEqual([]);
  });
});
