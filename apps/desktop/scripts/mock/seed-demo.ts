// Seeds the library the product video is filmed on: bun seed-demo.ts <root>
// A year of one person's learning, small enough to read on camera: ~45 sources over 7 skills, every exercise a
// real question with a real answer, a year of reviews replayed through FSRS so gems are cut, missed, won back
// and polished, and a short session due today that cuts gems, closes the day's goal and reaches a level.
// Every word here was written for Ore (no copied text); studies are named where a fact rests on one.
// On the Mac: ORE_LIBRARY=~/OreDemo open -n /Applications/Ore.app   (never seed over ~/Ore)
import { addMess } from "./mess.ts";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  addHighlight, appendJsonl, createItem, initLibrary, paths, recordReview, removeSkill, setReviewSettings, setSkillLook,
  skillNotesPath, startSession, endSession, updateItemMeta, writeCardMeta, writeNewCard, type ItemType,
} from "../../../../packages/core/src/index.ts";

const root = process.argv[2];
if (!root) throw new Error("usage: bun seed-demo.ts <root>");
if (existsSync(root) && readdirSync(root).length) throw new Error(`${root} is not empty: the demo library is seeded into a new folder`);
await initLibrary(root);
const lib = { root };

// Deterministic, so two takes film the same library.
let seed = 7;
const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff) / 2 ** 31);
const DAY = 86400_000;
const now = Date.now();
const at = (daysAgo: number) => new Date(now - daysAgo * DAY);
const iso = (daysAgo: number) => at(daysAgo).toISOString().replace(/\.\d+Z$/, "Z");

// The skills a new library starts with that this person never used.
for (const id of ["creativity", "self-regulation-motivation"]) await removeSkill(lib, id);
for (const [id, look] of [
  ["ai", { icon: "mc:ai", color: "purple", collection: "Work" }],
  ["learning", { icon: "mc:brain", color: "pink", collection: "Work" }],
  ["teaching", { icon: "mc:black_board", color: "blue", collection: "Work" }],
  ["storytelling-writing", { icon: "mc:pen_2", color: "yellow", collection: "Craft" }],
  ["creator-business", { icon: "mc:briefcase", color: "orange", collection: "Craft" }],
  ["habits", { icon: "mc:leaf", color: "green", collection: "Life" }],
  ["focus-attention", { icon: "mc:target", color: "red", collection: "Life" }],
] as const) await setSkillLook(lib, id, look);

/** One thing to remember from a source: a Fact (question, answer) or, with a rubric, an Explain. The answer is a
 *  sentence of the source's own text, so its exercise opens at the passage. `when`: where its memory stands
 *  today (default: as old as its source). */
type Fact = { q: string; a: string; rubric?: string[]; when?: "ready" | "fresh" | "missed" | "mended" | "polished" | "new" };
type Src = { skills: string[]; type: ItemType; age: number; status: "inbox" | "reading" | "done"; title: string; author?: string; url?: string; lede: string; facts: Fact[]; body?: string; pin?: boolean;
  /** Days since he last had it open (reading), and a question of his own on its opening line. */
  opened?: number; ask?: string };

const f = (q: string, a: string, extra: Partial<Fact> = {}): Fact => ({ q, a, ...extra });

// The source the reader is filmed on: headings, a figure, a table and a formula (D122).
const FSRS_BODY = `# How FSRS schedules a memory

Every exercise in a spaced repetition system is waiting for one moment: the day you are about to forget it. Review earlier and the effort is wasted. Review later and the memory is gone. FSRS, the Free Spaced Repetition Scheduler, is a model that estimates that day for each memory separately.

## Three numbers per memory

FSRS tracks three variables for every memory: stability, difficulty and retrievability.

| Variable | What it means | Changes when |
| --- | --- | --- |
| Stability | Days until recall drops to 90% | Every review |
| Difficulty | How hard this memory is for you, 1 to 10 | Every review, slowly |
| Retrievability | Chance you can recall it right now | Every day |

Stability is the number of days it takes for the chance of recall to fall to 90%. A new memory might have a stability of two or three days. One you have recalled five times in a row can reach a year.

## The forgetting curve

Between reviews, retrievability falls along a curve that is steep at first and then flattens:

$$R(t) = \\left(1 + \\frac{t}{9S}\\right)^{-1}$$

Here $$t$$ is the days since the last review and $$S$$ is the stability. When $$t = S$$ the formula gives exactly 0.9.

![Two forgetting curves: a new memory falls fast, a stable one slowly](assets/curves.svg)

## What a review does

A successful recall raises stability, and it raises it most when the memory was close to being forgotten. That is why a review on the due date teaches more than one a week early: the harder the recall, the bigger the gain. A miss cuts stability sharply, and the memory starts again from a short interval.

## Choosing how much to forget

You choose a desired retention, usually 90%. Raising desired retention shortens every interval, so you forget less but review far more. Going from 90% to 95% roughly doubles the daily work. For most learning, 85% to 90% is the best trade.
`;
// Plot 0–180 days, 100% at y=50 and 0% at the y=350 axis. Straight one-day
// samples cannot overshoot or hook upward the way the hand-drawn Béziers did.
const curve = (stability: number) => Array.from({ length: 181 }, (_, days) => {
  const retention = 1 / (1 + days / (9 * stability));
  return `${days ? "L" : "M"}${(80 + days / 180 * 820).toFixed(3)} ${(350 - retention * 300).toFixed(3)}`;
}).join(" ");
const CURVES = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="420" viewBox="0 0 960 420"><rect width="960" height="420" fill="#f6f5f1"/><g font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#333"><line x1="80" y1="40" x2="80" y2="350" stroke="#333" stroke-width="2"/><line x1="80" y1="350" x2="900" y2="350" stroke="#333" stroke-width="2"/><text x="20" y="64">100%</text><text x="30" y="86">90%</text><line x1="80" y1="80" x2="900" y2="80" stroke="#999" stroke-dasharray="6 6"/><text x="440" y="396">Days since last review</text><path d="${curve(3)}" fill="none" stroke="#d6457a" stroke-width="4"/><path d="${curve(60)}" fill="none" stroke="#2f8f6f" stroke-width="4"/><text x="250" y="300" fill="#d6457a">Stability 3 days</text><text x="620" y="150" fill="#2f8f6f">Stability 60 days</text></g></svg>`;

const SOURCES: Src[] = [
  // Learning
  { skills: ["learning", "teaching"], type: "article", age: 330, status: "done", title: "The testing effect: why retrieval beats rereading", author: "Mara Lindqvist", lede: "Pulling an answer out of memory changes the memory. Putting it back in by rereading mostly does not.", facts: [
    f("In Roediger and Karpicke (2006), how did the tested group compare with the rereading group after one week?", "After one week the group that took a recall test remembered about 50% more than the group that reread the passage."),
    f("Explain why rereading creates an illusion of competence.", "Rereading makes the text feel fluent, and that familiarity is easily mistaken for being able to recall it, so learners overrate what they know.", { rubric: ["Names fluency or familiarity", "Says familiarity is mistaken for recall", "Says learners overrate what they know"], when: "polished" }),
    f("What is the hypercorrection effect?", "A wrong answer given with high confidence, once corrected, is remembered better than one given with low confidence.", { when: "mended" }),
  ] },
  { skills: ["learning"], type: "article", age: 21, opened: 0.4, status: "reading", pin: true, title: "How FSRS schedules a memory", author: "Jonas Reiter", body: FSRS_BODY, lede: "", facts: [
    f("Which three variables does FSRS track for every memory?", "FSRS tracks three variables for every memory: stability, difficulty and retrievability.", { when: "ready" }),
    f("In FSRS, what does a memory's stability measure?", "Stability is the number of days it takes for the chance of recall to fall to 90%.", { when: "ready" }),
    f("Explain what raising desired retention costs you.", "Raising desired retention shortens every interval, so you forget less but review far more.", { rubric: ["Intervals get shorter", "Fewer things forgotten", "Much more daily review"], when: "fresh" }),
    f("Why does a review on the due date teach more than one a week early?", "A successful recall raises stability, and it raises it most when the memory was close to being forgotten.", { when: "new" }),
  ] },
  { skills: ["learning"], type: "article", age: 300, status: "done", title: "Spacing: why cramming works tonight and fails next month", ask: "Does the best gap change for skills, not facts?", lede: "Two hours tonight and two hours spread over two weeks cost the same. They do not buy the same memory.", facts: [
    f("What is the spacing effect?", "The spacing effect is that the same study time produces more lasting memory when it is spread across sessions than when it is massed into one."),
    f("Who first measured the forgetting curve, and when?", "Hermann Ebbinghaus measured the forgetting curve on himself and published it in 1885."),
    f("According to Cepeda and colleagues (2008), how long should the gap between study sessions be?", "Cepeda and colleagues found the best gap is roughly 10 to 20 percent of how long you want to remember.", { when: "mended" }),
  ] },
  { skills: ["learning"], type: "pdf", age: 270, status: "done", title: "Interleaving: mix the problems, not just the topics", ask: "Would this work for my coding exercises?", author: "Dana Okoro", lede: "Practising one kind of problem at a time feels smooth. Mixing them feels worse and works better.", facts: [
    f("What did Rohrer and Taylor (2007) find when students mixed problem types in practice?", "Rohrer and Taylor found that students who interleaved problem types did worse during practice but far better on a test a week later."),
    f("Explain why interleaving helps even though it feels harder.", "Interleaving forces you to decide which kind of problem you are facing before you solve it, and that choice is what a real test demands.", { rubric: ["You must identify the problem type", "Blocked practice hides that step", "A real test requires it"] }),
  ] },
  { skills: ["learning"], type: "article", age: 240, status: "done", title: "Desirable difficulties", lede: "Some things that slow learning down today are the reason it lasts.", facts: [
    f("Who coined the term desirable difficulties?", "Robert Bjork coined the term desirable difficulties for conditions that slow learning now and strengthen it later."),
    f("In Bjork's theory, what is the difference between storage strength and retrieval strength?", "Storage strength is how well a memory is embedded, and retrieval strength is how easily you can reach it right now."),
    f("Why does a hard recall build more than an easy one?", "When retrieval strength is low, a successful recall adds the most storage strength.", { when: "polished" }),
  ] },
  { skills: ["learning", "habits"], type: "article", age: 200, status: "done", title: "Sleep and what your brain keeps", ask: "Is a nap enough, or does it have to be a full night?", author: "Ines Carvalho", lede: "Learning does not finish when you close the book. A large part of it happens that night.", facts: [
    f("Which stage of sleep matters most for consolidating facts?", "Slow-wave sleep, the deep stage early in the night, matters most for consolidating facts and events."),
    f("What is hippocampal replay?", "During sleep the hippocampus replays the day's activity patterns, which helps move new memories into long-term storage in the cortex."),
  ] },
  { skills: ["learning"], type: "pdf", age: 170, status: "done", title: "Ten study techniques, ranked by the evidence", lede: "A 2013 review by Dunlosky and colleagues rated ten common study techniques by how well they hold up.", facts: [
    f("Which two techniques did Dunlosky and colleagues (2013) rate as high utility?", "Only two techniques were rated high utility: practice testing and distributed practice."),
    f("How did Dunlosky's review rate highlighting and rereading?", "Highlighting and rereading were both rated low utility, because they rarely require recalling anything."),
    f("What is elaborative interrogation?", "Elaborative interrogation means asking yourself why a stated fact is true and answering in your own words."),
  ] },
  { skills: ["learning", "teaching"], type: "article", age: 130, status: "done", title: "Worked examples, and when to stop using them", lede: "Showing a beginner a solved problem beats making them struggle through it. The reverse is true for an expert.", facts: [
    f("What is the worked example effect?", "Novices learn more from studying solved problems than from solving the same problems themselves."),
    f("What is the expertise reversal effect?", "Guidance that helps a novice slows an expert down, because the expert has to reconcile it with what they already know.", { when: "missed" }),
  ] },
  { skills: ["learning"], type: "article", age: 75, status: "done", title: "Prequestions: guess before you read", lede: "Trying to answer a question you cannot yet answer makes the answer stick when you meet it.", facts: [
    f("What is the pretesting effect?", "Attempting a question before studying improves memory for the answer, even when the attempt is wrong."),
    f("What makes a prequestion work, according to Kornell and colleagues (2009)?", "The failed attempt only helps if you see the correct answer afterwards.", { when: "ready" }),
  ] },
  { skills: ["learning"], type: "epub", age: 45, opened: 3, status: "reading", title: "Knowing what you know", author: "Mara Lindqvist", lede: "How sure you feel and how much you know are two different measurements.", facts: [
    f("What is a judgment of learning?", "A judgment of learning is your own prediction of whether you will recall something later."),
    f("When is a judgment of learning most accurate?", "A judgment made after a delay is far more accurate than one made right after studying, because it tests long-term memory.", { when: "fresh" }),
  ] },
  // AI
  { skills: ["ai"], type: "article", age: 310, status: "done", title: "Agents or workflows? Start with the simplest thing", ask: "Which of my automations are agents that should be workflows?", author: "Priya Raman", lede: "Most problems that look like they need an agent need one good prompt and a way to check its answer.", facts: [
    f("What distinguishes an agent from a workflow?", "In a workflow the steps are fixed in code, and in an agent the model decides its own steps and which tools to use."),
    f("Name the five common workflow patterns.", "The five common patterns are prompt chaining, routing, parallelisation, orchestrator and workers, and evaluator and optimiser."),
    f("Explain when an agent is the wrong choice.", "An agent trades cost, speed and predictability for flexibility, so it is the wrong choice when the steps are known in advance.", { rubric: ["Agents cost more or run slower", "They are less predictable", "Fixed steps do not need one"], when: "polished" }),
  ] },
  { skills: ["ai"], type: "pdf", age: 290, status: "done", title: "Attention, explained without the math", lede: "The 2017 paper that introduced the transformer replaced recurrence with one idea.", facts: [
    f("What does self-attention let a model do?", "Self-attention lets every token weigh every other token in the input when computing its own representation."),
    f("Which 2017 paper introduced the transformer?", "The transformer was introduced in 'Attention Is All You Need' by Vaswani and colleagues in 2017."),
    f("Why does a transformer need positional encoding?", "Attention has no built-in sense of order, so position information is added to each token."),
  ] },
  { skills: ["ai"], type: "article", age: 250, status: "done", title: "Retrieval-augmented generation in practice", author: "Tomás Greene", lede: "A model cannot quote a document it has never seen. Retrieval puts the right pages in front of it.", facts: [
    f("What does retrieval-augmented generation do?", "Retrieval-augmented generation finds passages relevant to a question and puts them in the prompt, so the model answers from them."),
    f("What is the trade-off in choosing a chunk size?", "Small chunks retrieve precisely but lose context, and large chunks keep context but bury the relevant line.", { when: "mended" }),
    f("Why add a reranker after the first search?", "A reranker reads the question and each candidate together, so it orders them more accurately than vector distance alone."),
  ] },
  { skills: ["ai"], type: "article", age: 210, status: "done", title: "Prompt caching: pay once for the long part", lede: "If every request starts with the same ten pages, you should not pay to read them ten times.", facts: [
    f("What does prompt caching store?", "Prompt caching stores the model's processing of a prompt's prefix, so a later request with the same prefix skips that work."),
    f("How should you order a prompt so the cache is hit?", "Put the stable content first and what changes last, because a cache only matches from the start of the prompt."),
  ] },
  { skills: ["ai"], type: "article", age: 160, status: "done", title: "Evaluating an LLM app before your users do", ask: "How many cases is enough to trust a difference?", author: "Priya Raman", lede: "Without a test set, every prompt change is a guess that feels like progress.", facts: [
    f("Why build an evaluation set before changing a prompt?", "A fixed set of cases with known good answers shows whether a change helped overall or only fixed the one example in front of you."),
    f("What must you check before trusting a model as a judge?", "A model judge has to be compared with human labels first, to measure how often the two agree."),
    f("Explain why one run of an eval is not enough.", "Model output varies from run to run, so a single run cannot separate a real improvement from noise.", { rubric: ["Outputs vary between runs", "A small difference may be noise", "Repeat runs to see the spread"] }),
  ] },
  { skills: ["ai"], type: "article", age: 120, status: "done", title: "Embeddings, simply", lede: "An embedding turns a piece of text into a point, placed so that similar meanings land close together.", facts: [
    f("What is an embedding?", "An embedding is a list of numbers that represents a text's meaning, so texts with similar meanings have similar numbers."),
    f("What does cosine similarity measure?", "Cosine similarity measures the angle between two vectors, ignoring their length."),
    f("Why search by embedding instead of by keyword?", "An embedding search finds passages that mean the same thing even when they share no words with the question."),
  ] },
  { skills: ["ai"], type: "article", age: 60, status: "done", title: "How a machine learns to speak", author: "Elin Sato", lede: "Text to speech used to glue recorded syllables together. Now a model generates the sound itself.", facts: [
    f("What are the two classic stages of a neural text to speech system?", "An acoustic model turns text into a spectrogram, and a vocoder turns the spectrogram into a waveform."),
    f("What is prosody?", "Prosody is the rhythm, stress and pitch of speech, the part that carries emotion and emphasis.", { when: "ready" }),
    f("Why does a short voice sample suffice to clone a voice?", "The model has already learned how voices vary from thousands of speakers, so a sample only has to locate one voice within that range.", { when: "fresh" }),
  ] },
  { skills: ["ai"], type: "article", age: 30, opened: 1.2, status: "reading", title: "Tool use: giving a model hands", lede: "A model that can only write text can still act, if something else carries out what it writes.", facts: [
    f("In tool use, who actually runs the tool?", "The model only writes a structured request, and the application runs the tool and returns the result.", { when: "ready" }),
    f("What most improves how well a model uses a tool?", "A clear description of what the tool does and when to use it improves tool use more than anything else.", { when: "new" }),
  ] },
  { skills: ["ai"], type: "article", age: 12, opened: 0.9, status: "reading", title: "Why long prompts drift", author: "Tomás Greene", lede: "A bigger context window holds more. It does not attend to all of it equally.", facts: [
    f("What is a context window?", "A context window is the most text, measured in tokens, that a model can take in at once.", { when: "fresh" }),
    f("What is the 'lost in the middle' effect?", "Models recall the start and end of a long prompt better than its middle.", { when: "new" }),
  ] },
  // Teaching
  { skills: ["teaching"], type: "article", age: 280, status: "done", title: "Cognitive load: teaching within four slots", author: "Dana Okoro", lede: "Working memory is small, and a lesson that overfills it teaches nothing.", facts: [
    f("About how many new items can working memory hold at once, according to Cowan (2001)?", "Cowan estimated that working memory holds about four chunks at once."),
    f("What are the three kinds of cognitive load?", "The three kinds are intrinsic load from the material, extraneous load from how it is presented, and germane load from building understanding."),
    f("Explain the split-attention effect.", "When a diagram and its explanation sit apart, learners spend working memory joining them instead of understanding them.", { rubric: ["Related information is separated", "Joining it uses working memory", "Less is left for learning"] }),
  ] },
  { skills: ["teaching"], type: "pdf", age: 220, status: "done", title: "Feedback that lands", ask: "What does good feedback on a video script look like?", lede: "Feedback is one of the strongest influences on learning, and a third of the time it makes things worse.", facts: [
    f("What did Black and Wiliam's 1998 review conclude about formative assessment?", "Black and Wiliam concluded that frequent, low-stakes checks used to adjust teaching raise achievement substantially."),
    f("Why can praise aimed at the person backfire?", "Praise aimed at the person draws attention to the self and away from the task, so it rarely improves the work."),
  ] },
  { skills: ["teaching", "storytelling-writing"], type: "article", age: 150, status: "done", title: "Explaining with analogies", author: "Mara Lindqvist", lede: "An analogy borrows a structure the learner already owns.", facts: [
    f("What does a good analogy map from the familiar thing to the new one?", "A good analogy maps relationships, not surface features, from the familiar thing to the new one."),
    f("What should you always say after giving an analogy?", "Say where the analogy breaks, so the learner does not carry the wrong parts across.", { when: "mended" }),
  ] },
  { skills: ["teaching"], type: "article", age: 100, status: "done", title: "The curse of knowledge", lede: "Once you know something, you cannot easily imagine not knowing it.", facts: [
    f("In Newton's 1990 tapping study, how often did listeners name the tapped song, and what did tappers predict?", "Listeners named the song 2.5% of the time, while the tappers had predicted 50%."),
    f("What is the curse of knowledge?", "The curse of knowledge is the difficulty of imagining what it is like not to know something you know well."),
  ] },
  { skills: ["teaching"], type: "pdf", age: 50, status: "done", title: "Bloom's two sigma problem", lede: "In 1984 Benjamin Bloom reported a result that education has been trying to reproduce at scale ever since.", facts: [
    f("What did Bloom report about one-to-one tutoring in 1984?", "Bloom reported that students tutored one to one performed two standard deviations above students in a conventional class."),
    f("What two things did Bloom's tutoring combine?", "The tutoring combined mastery learning with constant corrective feedback.", { when: "ready" }),
  ] },
  // Storytelling and writing
  { skills: ["storytelling-writing"], type: "article", age: 260, status: "done", title: "The story spine", lede: "Once upon a time. Every day. Until one day. Because of that. Until finally. And ever since.", facts: [
    f("Who created the story spine?", "The playwright Kenn Adams created the story spine as an improvisation exercise."),
    f("What does the story spine force a writer to show?", "The repeated 'because of that' forces each event to cause the next, which is what separates a story from a list."),
  ] },
  { skills: ["storytelling-writing", "creator-business"], type: "article", age: 190, status: "done", title: "Hooks: open a loop, then earn the close", ask: "Which of my last five videos closed their loop?", author: "Sam Whitlock", lede: "The first lines of anything have one job, which is to make the next lines necessary.", facts: [
    f("What is an open loop?", "An open loop is a question raised early that the audience needs answered, which keeps them going until it closes."),
    f("What breaks the trust a hook creates?", "A hook that promises more than the piece delivers trains the audience to stop believing your next one."),
  ] },
  { skills: ["storytelling-writing"], type: "epub", age: 140, status: "done", title: "Clear sentences", lede: "Most unclear writing is clear thinking in the wrong order.", facts: [
    f("Where should the subject and its verb sit in a clear sentence?", "Keep the subject and its verb close together and near the start of the sentence."),
    f("In what order should a sentence present old and new information?", "Start a sentence with what the reader already knows and end it with what is new.", { when: "polished" }),
    f("Explain why nominalisations make writing harder to read.", "A nominalisation hides an action inside a noun, so the reader has to work out who did what.", { rubric: ["An action becomes a noun", "The actor disappears", "The reader must rebuild it"] }),
  ] },
  { skills: ["storytelling-writing"], type: "article", age: 40, opened: 5, status: "reading", title: "Editing your own draft", author: "Sam Whitlock", lede: "You cannot see your own draft until you make it strange again.", facts: [
    f("Why does reading a draft aloud find problems that reading silently misses?", "Reading aloud slows you to the pace of speech, so you hear the sentences your eye skipped over.", { when: "fresh" }),
  ] },
  // Creator business
  { skills: ["creator-business"], type: "article", age: 230, status: "done", title: "Reading a retention graph", lede: "A view count says how many people arrived. The retention graph says where they left.", facts: [
    f("What does an audience retention graph show?", "An audience retention graph shows the share of viewers still watching at each moment of a video."),
    f("What does a sharp drop in the first thirty seconds usually mean?", "A sharp early drop usually means the opening did not deliver what the title and thumbnail promised."),
  ] },
  { skills: ["creator-business"], type: "article", age: 180, status: "done", title: "Pricing a course", author: "Noor Haddad", lede: "The price is part of the product. It tells the buyer what kind of thing this is.", facts: [
    f("What is value-based pricing?", "Value-based pricing sets the price from what the result is worth to the buyer, not from what it cost to make."),
    f("What is price anchoring?", "Price anchoring is showing a higher reference price first, so the real price is judged against it."),
  ] },
  { skills: ["creator-business"], type: "article", age: 90, status: "done", title: "Sponsorships, in plain numbers", lede: "A sponsor is buying attention by the thousand, and you should know your own price.", facts: [
    f("What does CPM stand for in sponsorship pricing?", "CPM is the cost per thousand views, the usual unit for pricing a sponsored placement."),
    f("Why can a small channel charge a higher CPM than a large one?", "A narrow audience that matches the sponsor's buyer is worth more per view than a broad one.", { when: "ready" }),
  ] },
  { skills: ["creator-business"], type: "article", age: 25, opened: 6, status: "reading", title: "A newsletter is an asset you own", lede: "Platforms lend you an audience. A list of addresses is one you keep.", facts: [
    f("What is an open rate?", "An open rate is the share of delivered emails that were opened.", { when: "fresh" }),
  ] },
  // Habits
  { skills: ["habits"], type: "epub", age: 320, status: "done", title: "The habit loop", lede: "A habit is a behaviour that a situation starts without asking you first.", facts: [
    f("What are the three parts of the habit loop?", "The habit loop has three parts: a cue, a routine and a reward."),
    f("Which part of the loop is easiest to change?", "Keep the cue and the reward and swap the routine, because the cue and the craving are the hardest parts to remove."),
  ] },
  { skills: ["habits"], type: "pdf", age: 205, status: "done", title: "If-then plans", author: "Ines Carvalho", lede: "Deciding in advance when and where you will act removes the decision from the moment.", facts: [
    f("What is an implementation intention?", "An implementation intention is a plan in the form 'if situation X arises, I will do Y'."),
    f("Who introduced implementation intentions?", "The psychologist Peter Gollwitzer introduced implementation intentions in the 1990s."),
    f("Explain why an if-then plan works better than a goal alone.", "The plan ties the action to a cue you will meet anyway, so starting no longer depends on remembering or on willpower.", { rubric: ["Links the action to a specific cue", "The cue triggers it", "Less reliance on memory or willpower"], when: "mended" }),
  ] },
  { skills: ["habits"], type: "article", age: 110, status: "done", title: "How long a habit really takes", ask: "What made the 18-day habits so fast?", lede: "Twenty-one days is a number from a 1960 self-help book. The measured answer is longer and far more varied.", facts: [
    f("In Lally and colleagues' 2010 study, what was the median time for a habit to become automatic?", "The median time for a new habit to become automatic was 66 days."),
    f("How wide was the range in Lally's study?", "The range ran from 18 to 254 days, depending on the person and the behaviour.", { when: "missed" }),
  ] },
  { skills: ["habits", "focus-attention"], type: "article", age: 35, status: "done", title: "Design the room, not the willpower", lede: "The easiest habit to keep is the one your surroundings make the default.", facts: [
    f("What is friction, in habit design?", "Friction is every extra step between you and a behaviour, and adding or removing it changes how often you do it.", { when: "ready" }),
  ] },
  // Focus
  { skills: ["focus-attention"], type: "epub", age: 245, status: "done", title: "Deep work", lede: "The ability to concentrate without distraction is becoming rarer at the same time as it becomes more valuable.", facts: [
    f("How does Cal Newport define deep work?", "Deep work is professional activity done in distraction-free concentration that pushes your abilities to their limit."),
    f("What is shallow work?", "Shallow work is logistical, low-demand activity that can be done while distracted and is easy to replicate."),
  ] },
  { skills: ["focus-attention"], type: "pdf", age: 155, status: "done", title: "Attention residue", ask: "How long does the residue last after a quick message check?", author: "Elin Sato", lede: "Switching tasks is not free, even when the switch takes one second.", facts: [
    f("What is attention residue?", "Attention residue is the part of your attention that stays on the previous task after you switch to a new one."),
    f("Who named attention residue, and when?", "Sophie Leroy named attention residue in a 2009 paper."),
  ] },
  { skills: ["focus-attention"], type: "article", age: 28, status: "done", title: "Flow", lede: "The state where time disappears has conditions, and they can be arranged.", facts: [
    f("What balance does flow require, according to Csikszentmihalyi?", "Flow requires a challenge that closely matches your skill, with clear goals and immediate feedback.", { when: "ready" }),
    f("What happens when challenge far exceeds skill?", "When challenge far exceeds skill the result is anxiety, and when skill far exceeds challenge it is boredom.", { when: "fresh" }),
  ] },
  // Saved and not opened yet
  { skills: ["ai"], type: "article", age: 9, status: "inbox", title: "Fine-tuning or prompting: how to choose", author: "Priya Raman", lede: "Fine-tuning changes the model. Prompting changes what you ask it. Most teams should exhaust the second first.", facts: [] },
  { skills: ["ai"], type: "pdf", age: 16, status: "inbox", title: "A field guide to model evaluations", lede: "A catalogue of the ways an evaluation can mislead you, with an example of each.", facts: [] },
  { skills: ["learning"], type: "article", age: 2, status: "inbox", title: "The generation effect", lede: "Information you produce yourself is remembered better than information you read.", facts: [] },
  { skills: ["teaching"], type: "article", age: 12, status: "inbox", title: "Live coding in class", author: "Dana Okoro", lede: "Typing a program in front of students shows them the part a finished file hides: the mistakes.", facts: [] },
  { skills: ["storytelling-writing"], type: "article", age: 1, status: "inbox", title: "Writing for the ear", author: "Sam Whitlock", lede: "A listener cannot reread. Every sentence for the ear has to land the first time.", facts: [] },
  { skills: ["creator-business"], type: "article", age: 20, status: "inbox", title: "Launch week, day by day", author: "Noor Haddad", lede: "A launch is a week of small, planned messages, each with one job.", facts: [] },
  { skills: ["focus-attention"], type: "article", age: 25, status: "inbox", title: "Single-tasking", lede: "Doing one thing at a time is not a personality trait. It is a setup.", facts: [] },
];

const bodyOf = (s: Src) => s.body ?? `# ${s.title}\n\n${s.lede}\n\n${s.facts.length ? `## The main ideas\n\n${s.facts.map((x) => x.a).join("\n\n")}\n` : "## In short\n\nSaved to read this week.\n"}`;

/** His ratings on a memory over its life, by where it should stand today. */
const plan = (when: Fact["when"], age: number): { first: number; ratings: (1 | 2 | 3 | 4)[] | "life"; miss?: number; variant?: boolean } =>
  when === "new" ? { first: 0, ratings: [] }
  : when === "fresh" ? { first: 4, ratings: [3] }
  // Two Goods, the second on its due date: the third is due about now and cuts the gem.
  : when === "ready" ? { first: 20, ratings: [3, 3] }
  : when === "missed" ? { first: age, ratings: "life", miss: -1 }
  : when === "mended" ? { first: age, ratings: "life", miss: 3 }
  : when === "polished" ? { first: age, ratings: "life", variant: true }
  : { first: age, ratings: "life" };

let cards = 0, reviews = 0;
const dueToday: string[] = [];
/** Memories old enough to be looked at again early: the cards the recent days' sessions draw on. */
const settled: { id: string; last: number }[] = [];
for (const s of SOURCES) {
  const text = bodyOf(s);
  const item = await createItem(lib, {
    type: s.type, title: s.title, body: text, skills: s.skills, author: s.author,
    assets: s.body ? [{ name: "curves.svg", data: new TextEncoder().encode(CURVES) }] : undefined,
  });
  await updateItemMeta(lib, item.meta.id, (m) => ({
    ...m, captured_at: iso(s.age), status: s.status,
    finished_at: s.status === "done" ? iso(Math.max(0, s.age - 2 - Math.floor(rnd() * 4))) : undefined,
    pinned_at: s.pin ? iso(1) : undefined,
    opened_at: s.status === "reading" ? iso(s.opened ?? 2) : undefined,
    // What he guessed at before reading (the reader's first row), written with the source as the app's AI would.
    prequestions: s.body ? [{ q: "What is a review trying to catch?" }, { q: "What does it cost to forget less?" }, { q: "Why would an early review teach less?" }] : undefined,
  }));
  if (s.status === "inbox") continue;
  const live = { ...item, body: text };
  // A Key point on the opening line of most sources, or a question of his own there.
  const opening = s.lede.split(/(?<=\.) /)[0]!;
  if (s.ask) addHighlight(live, { exact: opening, intent: "question", note: s.ask });
  else if (s.lede && rnd() < 0.7) addHighlight(live, { exact: opening, intent: "keep" });
  // A technique to try on his own work (D127), the next step the end of a review offers (D148).
  if (s.title === "If-then plans") addHighlight(live, { exact: opening, intent: "apply", note: "Write an if-then plan for Thursday's recording" });
  for (const [i, x] of s.facts.entries()) {
    const mark = addHighlight(live, { exact: x.a, intent: "card" });
    const card = writeNewCard(lib, {
      kind: x.rubric ? "prompt" : "card", content_type: x.rubric ? "concept" : "fact", item: item.meta.id, skills: s.skills, topics: [],
      question: x.q, answer: x.a, rubric: x.rubric ?? [], annotation: mark.id,
    });
    cards++;
    const p = plan(x.when, Math.max(8, s.age - 1 - i));
    writeCardMeta(card, { ...card.meta, created: iso(p.first + 0.2) });
    if (p.variant) appendJsonl(paths.variants(lib, card.meta.id), {
      id: `${card.meta.id}-V1`, rev: 1, card: card.meta.id, type: "new-case", setting: "a colleague's draft", question: `A colleague asks you: ${x.q.charAt(0).toLowerCase()}${x.q.slice(1)}`, answer: x.a,
      rubric: x.rubric ?? [], maps: (x.rubric ?? []).map((_, k) => k), status: "ready", created: iso(40), ai: { vendor: "claude", model: "demo", prompt_version: "variant@demo" },
    });
    // Replay its reviews: each on the day it fell due (a day or two late now and then), until the next is in the future.
    let t = p.first, n = 0, usedVariant = false, last = p.first;
    const fixed = p.ratings === "life" ? null : p.ratings;
    while (fixed ? n < fixed.length : true) {
      if (t <= 0.6) break;
      const missNow = p.miss !== undefined && (p.miss === -1 ? false : n === p.miss);
      const rating = fixed ? fixed[n]! : missNow ? 1 : rnd() < 0.12 ? 4 : rnd() < 0.1 ? 2 : 3;
      const variant = p.variant && !usedVariant && n >= 4 ? `${card.meta.id}-V1` : undefined;
      if (variant) usedVariant = true;
      // This week's reviews took the time a real answer takes, so the week's days show as kept.
      const elapsed_ms = t < 7 ? 150_000 + Math.floor(rnd() * 30_000) : x.rubric ? 45_000 + Math.floor(rnd() * 40_000) : 12_000 + Math.floor(rnd() * 20_000);
      const r = await recordReview(lib, card.meta.id, { rating: variant ? 3 : rating, confidence: rating === 1 ? 1 : rating === 4 ? 3 : 2, now: at(t), elapsed_ms, variant });
      reviews++; n++; last = t;
      const gap = (new Date(r.due_next).getTime() - at(t).getTime()) / DAY;
      const next = t - gap - (fixed ? 0 : rnd() < 0.25 ? 1 + Math.floor(rnd() * 2) : 0);
      // "missed": the last review before today is the miss, so it stands dull, waiting to be won back.
      if (p.miss === -1 && next <= 0.6 && rating !== 1 && n > 3) {
        const back = Math.min(t - 1, 6);
        if (back > 0.6) { await recordReview(lib, card.meta.id, { rating: 1, confidence: 3, now: at(back), elapsed_ms: 20_000 }); reviews++; }
        break;
      }
      t = next;
    }
    if (x.when === "ready") dueToday.push(card.meta.id);
    if (!x.when && s.age > 120) settled.push({ id: card.meta.id, last });
  }
  if (s.body) writeFileSync(join(item.dir, "notes.md"), "## In my words\n\nA review is worth the most on the day I'm about to forget. The schedule is just a guess at that day, kept per memory.\n\n- Stability = days until 90%\n- Higher retention = more reviews, not better memory\n");
}

// The habit, visible: ten minutes a day after the first coffee (D67), kept on most of the last ten days (two
// missed, as real weeks go), and most of today's ten minutes done this morning, so the filmed session closes the
// day. Those days' reviews are settled memories looked at again, each given the time a careful answer takes.
await setReviewSettings(lib, { goal_minutes: 10, plan: "my first coffee", new_per_day: 4 });
let k = 0;
for (const day of [10, 9, 8, 6, 5, 4, 2, 1, 0]) {
  const session = await startSession(lib, at(day ? day + 0.01 : 0.06));
  for (let i = 0; i < (day ? 4 : 3); i++, reviews++) {
    // Only a memory last reviewed before that day: a card's reviews stay in time order.
    while (settled[k % settled.length]!.last <= day + 0.5) k++;
    const card = settled[k++ % settled.length]!;
    card.last = day;
    await recordReview(lib, card.id, { rating: 3, confidence: 2, now: at(day ? day - i * 0.002 : 0.05 - i * 0.004), elapsed_ms: 165_000 + Math.floor(rnd() * 15_000), session: session.id });
  }
  await endSession(lib, at(day ? day - 0.01 : 0.03));
}

// Skill notes, as he would keep them.
const note = skillNotesPath(lib, "learning");
mkdirSync(join(note, ".."), { recursive: true });
writeFileSync(note, "## What I keep coming back to\n\nRecall beats review. Space it. Mix it. If it feels easy, it probably isn't doing much.\n\n## To try\n\n- Write three questions before reading anything long\n- Explain one idea aloud after every chapter\n");

addMess(root);
console.log(`seeded ${root}: ${SOURCES.length} sources, ${cards} exercises, ${reviews} reviews; ${dueToday.length} set to be cut today`);
