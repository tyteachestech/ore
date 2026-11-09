// Seeds a realistic scratch library for screenshots: bun seed.ts <root>
import { addMess } from "./mess.ts";
import { $ } from "bun";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  addSkill, addText, addTutorCard, findItem, initLibrary, readAnnotations, recordReview, setItemStatus, setSkillLook, skillNotesPath, updateItemMeta, writeCardMeta, writeNewCard, startSession, endSession,
} from "../../../../packages/core/src/index.ts";

const root = process.argv[2]!;
await initLibrary(root);
const lib = { root };
const CLI = `${import.meta.dir}/../../../../packages/cli/src/ore.ts`;
process.env.ORE_LIBRARY = root;

await setSkillLook(lib, "ai", { icon: "mc:ai", color: "purple", collection: "Ty Teaches Tech" });
await setSkillLook(lib, "learning", { icon: "🧠", color: "pink", collection: "Ty Teaches Tech" });
await setSkillLook(lib, "teaching", { icon: "mc:black_board", color: "blue", collection: "Ty Teaches Tech" });
await setSkillLook(lib, "storytelling-writing", { icon: "✍️", collection: "Craft" });
await setSkillLook(lib, "habits", { icon: "mc:leaf", color: "green", collection: "Life" });
await addSkill(lib, "Distributed Systems and Consensus Protocols for Very Large Clusters", "Craft");

const para = (s: string) => s;
const article = (title: string, sections: [string, string[]][]) =>
  `# ${title}\n\n` + sections.map(([h, ps]) => `## ${h}\n\n${ps.join("\n\n")}`).join("\n\n") + "\n";

const retrieval = article("The Testing Effect: Why Retrieval Beats Rereading", [
  ["What the testing effect is", [
    para("Retrieval practice is the act of pulling information out of memory rather than putting it back in. Decades of laboratory and classroom studies show that a practice test produces more durable learning than an equal amount of time spent rereading the same material, even when no feedback is given."),
    para("Roediger and Karpicke (2006) had students read a prose passage and then either reread it or take a free-recall test. After five minutes the rereaders did slightly better; after one week the tested group remembered roughly 50% more. The advantage only appears after a delay, which is why students rarely notice it on their own."),
  ]],
  ["Why it works", [
    para("Each successful retrieval changes the memory itself. It strengthens the route back to the information and adds new cues, so the next retrieval is easier. Effortful retrieval, the kind that feels a little hard, produces larger gains than easy retrieval."),
    para("Rereading, by contrast, creates fluency: the text feels familiar, and familiarity is easily mistaken for knowing. This illusion of competence is the main reason learners prefer rereading despite its weaker results."),
  ]],
  ["Using it well", [
    para("Space the tests out, mix topics together, and check answers after each attempt. Free recall, short-answer questions and explaining an idea aloud all count. Multiple-choice works too, but only when the wrong options are plausible."),
    para("Confidence matters as much as accuracy. A wrong answer given with high confidence, once corrected, is remembered better than one given with low confidence; this is called the hypercorrection effect."),
  ]],
]);

const agents = article("Building Effective Agents", [
  ["Workflows and agents", [
    para("Workflows are systems where language models and tools are orchestrated through predefined code paths. Agents are systems where the model dynamically directs its own processes and tool usage, keeping control over how it accomplishes the task."),
    para("Start with the simplest solution possible and only increase complexity when needed. That might mean not building an agent at all: a single call with retrieval and good examples is often enough."),
  ]],
  ["Patterns", [
    para("Prompt chaining decomposes a task into a sequence of steps, where each call processes the output of the previous one. Routing classifies an input and sends it to a specialised follow-up. Parallelisation runs subtasks at once and aggregates them."),
    // A figure whose labels are small at column width, for figure zoom (e2e "figure zoom").
    "![The workflow patterns, from simplest to most complex](assets/patterns.svg)",
    para("The orchestrator-workers pattern lets a central model break down a task, delegate to workers, and synthesise their results. Evaluator-optimiser loops have one call generate a response while another evaluates it and provides feedback."),
  ]],
]);

const story = article("The Story Spine", [
  ["The pattern", [para("Once upon a time there was ___. Every day, ___. One day ___. Because of that, ___. Because of that, ___. Until finally ___. And ever since then ___. The spine forces cause and effect, which is what separates a story from a list of events.")]],
]);

// The figure in Building Effective Agents: its labels are small at the column's width (figure zoom).
const PATTERNS = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300"><rect width="1200" height="300" fill="#f4f4f2"/><g font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#222" text-anchor="middle"><rect x="40" y="110" width="300" height="80" rx="10" fill="#fff" stroke="#999"/><text x="190" y="158">Prompt chaining</text><rect x="450" y="110" width="300" height="80" rx="10" fill="#fff" stroke="#999"/><text x="600" y="158">Routing</text><rect x="860" y="110" width="300" height="80" rx="10" fill="#fff" stroke="#999"/><text x="1010" y="158">Orchestrator-workers</text><path d="M340 150h110M750 150h110" stroke="#999" stroke-width="3"/><text x="600" y="250" font-size="16" fill="#666">Each step adds complexity: use the simplest pattern that works</text></g></svg>`;

const mk = async (text: string, skills: string[]) => addText(lib, text, { skills });
const a1 = await mk(retrieval, ["learning", "teaching"]);
const a2 = await mk(agents, ["ai"]);
mkdirSync(join(a2.dir, "assets"), { recursive: true });
writeFileSync(join(a2.dir, "assets", "patterns.svg"), PATTERNS);
const a3 = await mk(story, ["storytelling-writing"]);
await mk(article("A very long title about the neuroscience of habit formation and why cue-routine-reward loops are harder to break than to build", [["Loops", [para("Habits form when a cue reliably predicts a reward.")]]]), ["habits"]);
const a5 = await mk(article("Notes on spaced repetition scheduling (FSRS)", [["Stability", [para("FSRS models stability and difficulty for each card.")]]]), ["learning"]);

await updateItemMeta(lib, a1.meta.id, (m) => ({ ...m, prequestions: [
  { q: "Why does rereading feel effective even when it isn't?" },
  { q: "When does the testing effect show up, and when doesn't it?" },
  { q: "What makes a retrieval attempt more useful?" },
] }));
// A web article as a real add saves it: its site, author and date (D122).
await updateItemMeta(lib, a2.meta.id, (m) => ({ ...m, url: "https://www.anthropic.com/research/building-effective-agents", author: "Erik Schluntz and Barry Zhang", published: "2024-12-19", prequestions: [
  { q: "When is an agent the wrong choice?" },
  { q: "How does a workflow differ from an agent?" },
] }));
await setItemStatus(lib, a1.meta.id, "reading");
await setItemStatus(lib, a3.meta.id, "done");
await setItemStatus(lib, a5.meta.id, "done");

await $`bun ${CLI} highlight ${a1.meta.id} --exact ${"Retrieval practice is the act of pulling information out of memory rather than putting it back in."} --intent keep`.quiet();
await $`bun ${CLI} highlight ${a1.meta.id} --exact ${"after one week the tested group remembered roughly 50% more"} --intent card`.quiet();
await $`bun ${CLI} highlight ${a1.meta.id} --exact ${"this is called the hypercorrection effect"} --intent question --note ${"Does this hold for kids?"}`.quiet();
await $`bun ${CLI} highlight ${a2.meta.id} --exact ${"Start with the simplest solution possible"} --intent question`.quiet();
// A technique to try on his own work (D127), the one the end of a review shows (D148).
await $`bun ${CLI} highlight ${a3.meta.id} --exact ${"The spine forces cause and effect"} --intent apply --note ${"Outline Thursday's video on the spine before writing"}`.quiet();
// A skill note longer than the column, so a ⌘K match at its end has to scroll there.
const habitNote = skillNotesPath(lib, "habits");
mkdirSync(join(habitNote, ".."), { recursive: true });
writeFileSync(habitNote, Array.from({ length: 14 }, (_, i) => `## Week ${i + 1}\n\nKept the morning walk most days; missed it when the day started late.\n`).join("\n") + "\n## What worked\n\nStacking the walk onto the first coffee made it stick.\n");
writeFileSync(join(a1.dir, "notes.md"), "## Big idea\n\nTesting is a learning event, not just a measurement. The benefit only shows after a delay.\n\n- Effortful > easy\n- Confidence + correction = hypercorrection\n");

const card = (item: string, skills: string[], question: string, answer: string, rubric: string[] = [], annotation?: string) =>
  writeNewCard(lib, { kind: rubric.length ? "prompt" : "card", item, skills, topics: [], content_type: rubric.length ? "concept" : "fact", question, answer, rubric, annotation });
/** The Card highlight the first card was made from, so Review shows its passage and Open in source. */
const fromHighlight = readAnnotations(findItem(lib, a1.meta.id)).find((a) => a.intent === "card")!.id;
const cards = [
  card(a1.meta.id, ["learning"], "In Roediger & Karpicke (2006), how much more did the tested group remember after one week?", "About 50% more than the rereading group.", [], fromHighlight),
  card(a1.meta.id, ["learning", "teaching"], "Explain why rereading creates an illusion of competence.", "Rereading builds fluency; familiarity feels like knowing, so learners overrate what they can recall.", ["Names fluency or familiarity", "Links it to misjudging what they know"]),
  card(a1.meta.id, ["learning"], "What is the hypercorrection effect?", "High-confidence errors, once corrected, are remembered better than low-confidence ones."),
  card(a2.meta.id, ["ai"], "What distinguishes an agent from a workflow?", "In an agent the model directs its own process and tool use; a workflow follows predefined code paths."),
  card(a2.meta.id, ["ai"], "Name the five workflow patterns.", "Prompt chaining, routing, parallelisation, orchestrator-workers, evaluator-optimiser."),
  card(a3.meta.id, ["storytelling-writing"], "What does the Story Spine force a writer to show?", "Cause and effect between events."),
  card(a5.meta.id, ["learning"], "Which two variables does FSRS track per card?", "Stability and difficulty."),
];
// Some history: review three cards a few days ago so they become live and some are due.
const past = (d: number) => new Date(Date.now() - d * 86400_000);
for (const [i, c] of cards.slice(0, 4).entries()) await recordReview(lib, c.meta.id, { rating: 3, confidence: 2, now: past(6 + i) });
await startSession(lib); await recordReview(lib, cards[4]!.meta.id, { rating: 3, confidence: 3 }); await endSession(lib);
// A card the tutor kept yesterday: it knows its source but no passage in it, and is new in review today.
const kept = await addTutorCard(lib, a3.meta.id, { kind: "card", content_type: "fact", question: "Which word links the Story Spine's middle beats?", answer: "Because.", rubric: [] }, { vendor: "claude", model: "mock", prompt_version: "tutor@3" });
writeCardMeta(kept, { ...kept.meta, created: past(1).toISOString() });
addMess(root);
console.log("seeded", root);
