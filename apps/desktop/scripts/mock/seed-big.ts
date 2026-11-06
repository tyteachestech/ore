// Seeds a "matured" scratch library: a year of use, ~240 sources over 14 skills, months of reviews.
// For seeing where views break at scale: bun seed-big.ts <root>
// All text is generated here (no copyrighted full texts); titles read like real ones so rows have real lengths.
import { addMess } from "./mess.ts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  addHighlight, addSkill, createItem, initLibrary, recordReview, setSkillLook, updateItemMeta, writeNewCard,
  type Intent, type ItemType,
} from "../../../../packages/core/src/index.ts";

const root = process.argv[2]!;
await initLibrary(root);
const lib = { root };

// Deterministic, so screenshots compare across runs.
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]!;
const DAY = 86400_000;
const now = Date.now();
const ago = (d: number) => new Date(now - d * DAY).toISOString().replace(/\.\d+Z$/, "Z");

for (const [name, collection] of [["Spanish", "Life"], ["Piano", "Life"], ["Distributed Systems", "Craft"], ["Personal Finance", "Life"], ["Stoicism", "Life"]] as const)
  await addSkill(lib, name, collection);
const looks: [string, Record<string, string>][] = [
  ["ai", { icon: "mc:ai", color: "purple", collection: "Ty Teaches Tech" }],
  ["learning", { icon: "🧠", color: "pink", collection: "Ty Teaches Tech" }],
  ["teaching", { icon: "mc:black_board", color: "blue", collection: "Ty Teaches Tech" }],
  ["creator-business", { icon: "💼", color: "orange", collection: "Ty Teaches Tech" }],
  ["storytelling-writing", { icon: "✍️", collection: "Craft" }],
  ["creativity", { icon: "🎨", color: "yellow", collection: "Craft" }],
  ["distributed-systems", { icon: "mc:server", color: "teal" }],
  ["habits", { icon: "mc:leaf", color: "green", collection: "Life" }],
  ["focus-attention", { icon: "🎯", color: "red", collection: "Life" }],
  ["self-regulation-motivation", { icon: "🔋", collection: "Life" }],
  ["spanish", { icon: "🇪🇸", color: "red" }],
  ["piano", { icon: "🎹", color: "gray" }],
  ["personal-finance", { icon: "💰", color: "green" }],
  ["stoicism", { icon: "🏛️", color: "gray" }],
];
for (const [id, look] of looks) await setSkillLook(lib, id, look);

// Title stems per skill, combined with a frame so ~240 titles stay distinct and realistic in length.
const TOPICS: Record<string, string[]> = {
  ai: ["Building effective agents", "Prompt caching", "Tool use", "Retrieval-augmented generation", "Evaluating LLM apps", "Fine-tuning vs prompting", "Context windows", "Model routing", "Agent memory", "Structured outputs", "Embeddings", "AI code review"],
  learning: ["The testing effect", "Spaced repetition", "Interleaving", "Desirable difficulties", "Elaborative interrogation", "The forgetting curve", "FSRS scheduling", "Metacognition", "Worked examples", "Prequestions", "Sleep and memory"],
  teaching: ["Cognitive load theory", "Explaining with analogies", "Formative assessment", "Live coding in class", "Designing exercises", "Feedback that lands", "Teaching beginners", "Curriculum sequencing"],
  "creator-business": ["Pricing a course", "YouTube retention graphs", "Newsletter growth", "Sponsorship rates", "One-time vs subscription", "Building in public", "Launch checklists"],
  "storytelling-writing": ["The story spine", "Writing clear sentences", "Hooks and openings", "Editing your own draft", "Show, don't tell", "Narrative structure", "Writing for the screen"],
  creativity: ["Idea generation", "Constraints and creativity", "Keeping a commonplace book", "Remixing ideas", "Incubation"],
  "distributed-systems": ["Raft consensus", "Paxos made simple", "Vector clocks", "CRDTs", "Consistent hashing", "Two-phase commit", "Leader election", "Linearizability"],
  habits: ["Cue, routine, reward", "Habit stacking", "Breaking bad habits", "Environment design", "Tiny habits"],
  "focus-attention": ["Deep work", "Attention residue", "Single-tasking", "Notification hygiene", "Flow states"],
  "self-regulation-motivation": ["Self-determination theory", "Implementation intentions", "Procrastination", "Energy management"],
  spanish: ["Ser vs estar", "The subjunctive", "Por vs para", "Preterite vs imperfect", "Spanish pronunciation", "Common idioms"],
  piano: ["Reading bass clef", "Hand independence", "Chord voicings", "Practising slowly", "Scales and arpeggios"],
  "personal-finance": ["Index funds", "Emergency funds", "Tax-advantaged accounts", "Budgeting by values", "Compound interest"],
  stoicism: ["The dichotomy of control", "Negative visualisation", "Journaling like Marcus Aurelius", "Amor fati"],
};
const FRAMES = [
  (t: string) => t,
  (t: string) => `${t}: a practical guide`,
  (t: string) => `What I learned about ${t.toLowerCase()}`,
  (t: string) => `${t}, explained`,
  (t: string) => `Why ${t.toLowerCase()} matters more than you think`,
  (t: string) => `A beginner's guide to ${t.toLowerCase()}`,
  (t: string) => `${t} | Full lecture`,
  (t: string) => `Notes on ${t.toLowerCase()}`,
  (t: string) => `The complete guide to ${t.toLowerCase()} (with examples, pitfalls, and a worked case study from a real project)`,
];
const TYPES: [ItemType, number][] = [["article", 45], ["youtube", 20], ["pdf", 12], ["epub", 6], ["markdown", 12], ["snippet", 5]];
const typeOf = () => {
  let r = rnd() * 100;
  for (const [t, w] of TYPES) if ((r -= w) < 0) return t;
  return "article";
};

const SENT = [
  (t: string) => `${t} is easier to understand once you see the problem it solves.`,
  (t: string) => `Most people get ${t.toLowerCase()} wrong because they start from the definition instead of an example.`,
  (t: string) => `The key idea behind ${t.toLowerCase()} is that small, repeated effort beats one big push.`,
  (t: string) => `A useful test is whether you can explain ${t.toLowerCase()} to a friend without notes.`,
  (t: string) => `Researchers found the effect was strongest after a delay of several days.`,
  (t: string) => `The trade-off is speed now against durability later, and durability usually wins.`,
  (t: string) => `In practice, the first attempt feels slow and awkward, which is a sign it is working.`,
  (t: string) => `Experts rarely think about ${t.toLowerCase()} directly; they have turned it into habit.`,
  (t: string) => `One common mistake is to measure progress by time spent rather than by what you can recall.`,
  (t: string) => `The simplest version is often good enough, and complexity should be earned.`,
];
const body = (title: string, topic: string, n: number) => {
  const sections = Array.from({ length: n }, (_, i) => {
    const ps = Array.from({ length: 2 + Math.floor(rnd() * 2) }, () => Array.from({ length: 3 }, () => pick(SENT)(topic)).join(" "));
    return `## ${["Overview", "The core idea", "Why it works", "Common mistakes", "In practice", "Further reading"][i % 6]}\n\n${ps.join("\n\n")}`;
  });
  return `# ${title}\n\n${sections.join("\n\n")}\n`;
};

const ids = Object.keys(TOPICS);
// Uneven weights: a few skills carry most of the library, as in real use.
const WEIGHT: Record<string, number> = { ai: 40, learning: 38, teaching: 22, "creator-business": 20, "storytelling-writing": 16, creativity: 8, "distributed-systems": 18, habits: 10, "focus-attention": 9, "self-regulation-motivation": 6, spanish: 22, piano: 10, "personal-finance": 12, stoicism: 7 };
const seen = new Set<string>();
const made: { id: string; skills: string[]; status: string; topic: string; body: string; captured: number }[] = [];
const AUTHORS = ["Ana Ruiz", "J. Chen", "Maya Patel", "Sam Okafor", "Lena Fischer", "", ""];

for (const skill of ids)
  for (let k = 0; k < WEIGHT[skill]!; k++) {
    const topic = pick(TOPICS[skill]!);
    let title = pick(FRAMES)(topic);
    if (seen.has(title)) title = `${title} (part ${k})`;
    seen.add(title);
    const type = typeOf();
    // 1 in 6 also goes under a second skill; 1 in 25 has no skill (All sources only).
    const second = rnd() < 0.16 ? pick(ids.filter((s) => s !== skill)) : null;
    const skills = rnd() < 0.04 ? [] : second ? [skill, second] : [skill];
    const text = body(title, topic, type === "snippet" ? 1 : 2 + Math.floor(rnd() * 4));
    const item = await createItem(lib, {
      type, title, body: text, skills, author: pick(AUTHORS) || undefined,
      url: type === "article" ? `https://example.com/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}` : type === "youtube" ? `https://www.youtube.com/watch?v=${Math.floor(rnd() * 1e11).toString(36)}` : undefined,
    });
    // Captured across the last year, more of it recently. Older sources are mostly done.
    const captured = Math.floor(rnd() ** 1.6 * 360);
    const r = rnd();
    const status = captured > 60 ? (r < 0.62 ? "done" : r < 0.72 ? "reading" : "inbox") : r < 0.25 ? "done" : r < 0.5 ? "reading" : "inbox";
    const archived = rnd() < 0.12;
    await updateItemMeta(lib, item.meta.id, (m) => ({
      ...m,
      captured_at: ago(captured),
      status: status as "inbox" | "reading" | "done",
      finished_at: status === "done" ? ago(Math.max(0, captured - 1 - Math.floor(rnd() * 20))) : undefined,
      archived_at: archived ? ago(Math.max(0, captured - Math.floor(rnd() * 30))) : undefined,
      // A few started sources pinned, as he would keep the ones he's in the middle of.
      pinned_at: status === "reading" && !archived && rnd() < 0.15 ? ago(Math.floor(rnd() * 10)) : undefined,
    }));
    made.push({ id: item.meta.id, skills, status, topic, body: text, captured });
    if (status !== "inbox") {
      const live = { ...item, body: text };
      const sentences = text.split("\n").filter((l) => l && !l.startsWith("#")).flatMap((p) => p.split(/(?<=\.) /));
      const used = new Set<string>();
      for (let h = 0; h < 1 + Math.floor(rnd() * 6); h++) {
        const s = pick(sentences);
        if (used.has(s)) continue;
        used.add(s);
        const intent: Intent = pick(["keep", "keep", "card", "card", "question"]);
        try {
          addHighlight(live, { exact: s, intent, note: intent === "question" ? pick(["Does this hold for kids?", "How would I test this?", "Is there a counter-example?", "What's the original study?"]) : undefined });
        } catch {}
      }
      if (rnd() < 0.3) writeFileSync(join(item.dir, "notes.md"), `## Big idea\n\n${pick(SENT)(topic)}\n\n- ${pick(SENT)(topic)}\n`);
    }
  }

// Cards on finished and started sources; reviews replayed in time order over the months since.
const reviews: { at: number; card: string; rating: 1 | 2 | 3 | 4 }[] = [];
for (const m of made.filter((x) => x.status !== "inbox" && x.skills.length)) {
  for (let c = 0; c < 1 + Math.floor(rnd() * 3); c++) {
    const card = writeNewCard(lib, {
      kind: "card", item: m.id, skills: m.skills, topics: [], content_type: "fact",
      question: `${pick(["What is the key idea behind", "Why does it matter:", "Give an example of", "What's a common mistake with"])} ${m.topic.toLowerCase()}?`,
      answer: pick(SENT)(m.topic), rubric: [],
    });
    let t = m.captured - 1;
    while (t > 1 && rnd() < 0.85) {
      reviews.push({ at: t - rnd(), card: card.meta.id, rating: pick([3, 3, 3, 4, 2, 1]) as 1 | 2 | 3 | 4 });
      t -= 2 + Math.floor(rnd() * 25);
    }
  }
}
reviews.sort((a, b) => b.at - a.at);
for (const r of reviews) await recordReview(lib, r.card, { rating: r.rating, confidence: 2, now: new Date(now - r.at * DAY) });

addMess(root);
const count = (s: string) => made.filter((m) => m.status === s).length;
console.log(`seeded ${root}: ${made.length} sources (${count("inbox")} unopened, ${count("reading")} started, ${count("done")} done), ${reviews.length} reviews`);
