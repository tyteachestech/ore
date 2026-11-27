// bun rich.ts <checkout> <lib>: seed a rich library with that checkout's own seed and CLI, then add every file
// type, highlights, notes with links and diagrams, chats, cards, reviews, statuses. Logs which steps failed.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const [wt, lib] = process.argv.slice(2) as [string, string];
const CLI = join(wt, "packages/cli/src/ore.ts");
const FX = "/home/user/ore/packages/core/test/fixtures/intake/files";
const env = { ...process.env, ORE_LIBRARY: lib, ORE_NO_ENRICH: "1", ORE_AI: "none" };
const log: string[] = [];
function ore(args: string[], stdin?: string): any {
  const p = Bun.spawnSync(["bun", CLI, ...args, "--json"], { env, stdin: stdin ? Buffer.from(stdin) : undefined });
  const out = p.stdout.toString();
  if (p.exitCode !== 0) { log.push(`FAIL ${args.slice(0, 3).join(" ")}: ${p.stderr.toString().trim().split("\n").pop()}`); return undefined; }
  try { return JSON.parse(out); } catch { return out; }
}
const seed = Bun.spawnSync(["bun", join(wt, "apps/desktop/scripts/mock/seed.ts"), lib], { env });
if (seed.exitCode !== 0) throw new Error(seed.stderr.toString());

const files = ["paper.pdf", "textbook.pdf", "tables.pdf", "scan.pdf", "book.epub", "chapters.epub", "front-matter.epub", "document1.docx", "figure.docx", "deck.pptx", "numpy.ipynb", "word.rtf", "vocab.xlsx", "verbs.csv", "obsidian-note.md", "chatgpt-copy.html", "screenshot.png", "../audio/chaptered.mp3", "saved-lesson/lesson.html"];
const added: { file: string; id: string }[] = [];
for (const f of files) {
  if (!existsSync(join(FX, f))) { log.push(`missing fixture ${f}`); continue; }
  const r = ore(["add", join(FX, f), "--skill", "learning", "--no-enrich"]);
  const id = r?.id ?? r?.item?.id ?? r?.meta?.id ?? r?.items?.[0]?.id;
  if (id) added.push({ file: f, id }); else if (r) log.push(`add ${f}: no id in ${JSON.stringify(r).slice(0, 200)}`);
}
const items: any[] = ore(["ls"]) ?? [];
const ids = items.map((i) => i.id ?? i.meta?.id);
// A highlight of each kind on every added source, from a sentence in its own text.
const intents = ["keep", "question", "apply", "card"];
for (const [n, a] of added.entries()) {
  const s = ore(["show", a.id]);
  const body: string = (typeof s === "string" ? s : s?.body ?? s?.doc ?? "") as string;
  const words = body.replace(/[#*_`>\[\]()!|$\\-]/g, " ").split(/\s+/).filter((w) => /^[A-Za-z]{3,}$/.test(w));
  if (words.length < 20) { log.push(`show ${a.file}: too little text (${words.length} words)`); continue; }
  const mid = Math.floor(words.length / 2);
  // Find a run of words that sits verbatim in the body.
  for (let k = mid; k < words.length - 4; k++) {
    const exact = body.match(new RegExp(words.slice(k, k + 3).join("\\s+")))?.[0];
    if (exact) { ore(["highlight", a.id, "--exact", exact, "--intent", intents[n % 4]!, "--note", `old note ${n}`]); break; }
  }
  if (n % 3 === 0) ore(["status", a.id, "done"]);
  else if (n % 3 === 1) ore(["opened", a.id]);
}
const [x, y, z] = added.map((a) => a.id);
const scene = JSON.stringify({ type: "excalidraw", version: 2, source: "old", elements: [{ id: "r1", type: "rectangle", x: 0, y: 0, width: 80, height: 40 }, { id: "t1", type: "text", x: 5, y: 5, text: "Spacing" }], appState: {}, files: {} });
if (x) {
  ore(["diagram", x, "map", "--set"], scene);
  ore(["notes", x, "--set", `## From the paper\n\nSee [[${y}]] and the [Testing Effect](ore://item/${ids[0]}).\n\n![Diagram](diagrams/map.excalidraw)\n\n- [ ] follow up\n- [x] read twice\n\n> [!note] A callout\n> with two lines\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n$$e = mc^2$$\n`]);
  ore(["edit", x, "--priority", "P1", "--title", "Renamed paper", "--author", "Someone Else"]);
  ore(["pin", x]);
}
if (y) ore(["archive", y]);
if (z) ore(["prequestion", z, "0", "--after", "no idea", "--confidence", "1"]);
ore(["notes", "--skill", "learning", "--append", `Linked [[${x}]] from the skill note.`, "--heading", "Old heading"]);
ore(["diagram", "--skill", "learning", "skill-map", "--set"], scene);
ore(["skills", "set", "learning", "--priority", "P1", "--hook", "an old hook", "--goal", "an old goal"]);
ore(["skills", "add", "Old Skill", "--collection", "Old Collection"]);
ore(["goal", "--minutes", "25", "--new-per-day", "7", "--plan", "After coffee"]);
// Cards a tutor reply proposed, then a few reviews each, a session around some.
const stamp = JSON.stringify({ vendor: "claude", model: "claude-old-1", prompt_version: "tutor@1" });
for (const [i, a] of added.slice(0, 6).entries()) {
  const kind = i % 2 ? { kind: "prompt", content_type: "concept", question: `Explain idea ${i} of ${a.file}`, answer: `Because ${i}.`, rubric: ["point one", "point two"] } : { kind: "card", content_type: "fact", question: `Fact ${i} of ${a.file}?`, answer: `Answer ${i}`, rubric: [] };
  ore(["tutor-card", a.id, "--card", JSON.stringify(kind), "--ai", stamp]);
}
const session = ore(["session", "start"]);
const cards: any[] = ore(["cards"]) ?? [];
for (const [i, c] of cards.entries()) {
  const id = c.id ?? c.meta?.id;
  ore(["review", id, "--rating", String((i % 4) + 1), "--confidence", String((i % 3) + 1), "--answer", `my answer ${i}`, "--elapsed-ms", "4200", ...(session?.id ? ["--session", session.id] : [])]);
  if (i % 5 === 0) ore(["card", "retire", id]);
}
ore(["session", "end"]);
// A saved tutor chat with an attachment.
const chat = { id: "old-chat", title: "An old chat", carry: [], turns: [{ id: "t1", message: "What is spacing?", reply: "Spacing is [1].", at: new Date().toISOString() }] };
ore(["chat", "old-chat", "--set"], JSON.stringify(chat));
ore(["chat", "--attach", join(FX, "wide.png")]);
// A question he asked, answered from a source; a try.
const q = ore(["questions"]);
const qid = (Array.isArray(q) ? q : q?.questions ?? [])[0]?.id;
if (qid && x) ore(["answer", qid, "--text", "Partly answered", "--item", x]);
const tries = ore(["tries"]);
const tid = (Array.isArray(tries) ? tries : tries?.tries ?? [])[0]?.id;
if (tid) { ore(["try", tid, "--plan", "I'll try it Monday", "--pick"]); ore(["tried", tid, "--text", "It went fine"]); }
ore(["snippet", "--text", "A snippet captured from Safari about interleaving practice.", "--url", "https://example.com/interleave", "--no-enrich"]);
writeFileSync(join(lib, "rich-log.txt"), `added ${added.length}/${files.length}\n` + log.join("\n") + "\n");
console.log(`added ${added.length}/${files.length}, ${log.length} problems`);
