// Samples the outside eval slices from their public datasets, the same way every time (fixed seed), so
// anyone can check a case against its origin or draw a bigger slice. Downloads are not in the repo:
//   bun packages/core/eval/outside/sample.ts <dir>
// where <dir> holds, under these names:
//   saf.parquet   https://huggingface.co/datasets/Short-Answer-Feedback/saf_communication_networks_english  data/test_unseen_answers-*.parquet
//   seb.parquet   https://huggingface.co/datasets/nkazi/SciEntsBank  data/test-ua-*.parquet
//   squad.json    https://rajpurkar.github.io/SQuAD-explorer/dataset/dev-v2.0.json
// Writes grade-saf.json, grade-scientsbank.json, ask-squad.json and squad-docs/*.md beside this file.
// Licenses and citations: README.md here.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";

const out = import.meta.dir;
const dir = process.argv[2];
if (!dir) throw new Error("usage: bun sample.ts <download dir>");

/** mulberry32: a small seeded generator, so the slice is the same on every machine. */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle<T>(xs: T[], r: () => number): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; }
/** Up to n of xs, spread over questions: at most `cap` per question first, then whatever is left. */
function spread<T>(xs: T[], n: number, key: (x: T) => string, r: () => number, cap = 2): T[] {
  const picked: T[] = [], per = new Map<string, number>(), rest: T[] = [];
  for (const x of shuffle(xs, r)) {
    const k = key(x), c = per.get(k) ?? 0;
    if (c < cap && picked.length < n) { picked.push(x); per.set(k, c + 1); } else rest.push(x);
  }
  return [...picked, ...rest.slice(0, n - picked.length)];
}
const rows = async (f: string) => parquetReadObjects({ file: await asyncBufferFromFile(join(dir, f)) }) as Promise<Record<string, unknown>[]>;
const clean = (s: unknown) => String(s).replace(/\r\n?/g, "\n").trim();
const write = (name: string, data: unknown) => writeFileSync(join(out, name), JSON.stringify(data, null, 2) + "\n");

// SAF: university students' answers on communication networks, each with a teacher's verdict and feedback.
{
  const r = rng(1);
  const all = await rows("saf.parquet");
  const by = (v: string) => all.filter((x) => x.verification_feedback === v);
  const q = (x: Record<string, unknown>) => String(x.question);
  const picks = [...spread(by("Correct"), 20, q, r), ...spread(by("Partially correct"), 20, q, r), ...spread(by("Incorrect"), 20, q, r)];
  const level: Record<string, string> = { Correct: "correct", "Partially correct": "partial", Incorrect: "incorrect" };
  write("grade-saf.json", {
    about: "60 of the 375 test_unseen_answers rows of the SAF communication-networks set (Filighera et al., ACL 2022; CC BY 4.0): 20 Correct, 20 Partially correct, 20 Incorrect, at most two per question. right = the teachers' Correct; Partially correct is wrong, as in Ore (a required point missing is Hard). `why` is the teachers' own feedback. Drawn by sample.ts, seed 1.",
    cases: picks.map((x) => ({
      id: `saf-${String(x.id).slice(0, 8)}`, level: level[String(x.verification_feedback)]!, kind: "card",
      question: clean(x.question), model_answer: clean(x.reference_answer), rubric: [], answer: clean(x.provided_answer),
      label: x.verification_feedback === "Correct" ? "right" : "wrong",
      why: `${x.verification_feedback} (score ${x.score}): ${clean(x.answer_feedback)}`,
    })),
  });
}

// SciEntsBank: school science answers labeled correct, contradictory, partially correct but incomplete, irrelevant or off-topic.
{
  const r = rng(2);
  const all = await rows("seb.parquet");
  const names = ["correct", "contradictory", "incomplete", "irrelevant", "non_domain"];
  const by = (i: number) => all.filter((x) => Number(x.label) === i);
  const q = (x: Record<string, unknown>) => String(x.question);
  const picks = [0, 1, 2, 3, 4].flatMap((i) => spread(by(i), 20, q, r));
  write("grade-scientsbank.json", {
    about: "83 of the 540 test_ua rows of SciEntsBank (SemEval-2013 Task 7, Dzikovska et al. 2013; CC BY 4.0 on Hugging Face, nkazi/SciEntsBank): 20 each of correct, contradictory, partially_correct_incomplete and irrelevant, and all 3 non_domain, at most two per question. right = correct; the other four are wrong. Drawn by sample.ts, seed 2.",
    cases: picks.map((x) => ({
      id: `seb-${String(x.id)}`, level: names[Number(x.label)]!, kind: "card",
      question: clean(x.question), model_answer: clean(x.reference_answer), rubric: [], answer: clean(x.student_answer),
      label: Number(x.label) === 0 ? "right" : "wrong",
      why: `SciEntsBank 5-way label: ${["correct", "contradictory", "partially_correct_incomplete", "irrelevant", "non_domain"][Number(x.label)]}.`,
    })),
  });
}

// SQuAD 2.0 dev: Wikipedia articles with questions a paragraph answers, and questions written to look answered but not be.
{
  const r = rng(3);
  interface QA { question: string; is_impossible: boolean; answers: { text: string }[] }
  interface Article { title: string; paragraphs: { context: string; qas: QA[] }[] }
  const data = (JSON.parse(readFileSync(join(dir, "squad.json"), "utf8")) as { data: Article[] }).data;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const docs = join(out, "squad-docs");
  rmSync(docs, { recursive: true, force: true });
  mkdirSync(docs);
  const cases: unknown[] = [], absent: unknown[] = [];
  for (const a of shuffle(data, r).slice(0, 6)) {
    const slug = a.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const title = a.title.replace(/_/g, " ");
    const body = a.paragraphs.map((p) => p.context.trim()).join("\n\n");
    writeFileSync(join(docs, `${slug}.md`), `---\ntype: article\ntitle: ${JSON.stringify(title)}\nauthor: Wikipedia contributors\nurl: https://en.wikipedia.org/wiki/${a.title}\nlicense: CC BY-SA 4.0 (text via SQuAD 2.0 dev)\n---\n\n${body}\n`);
    const qas = a.paragraphs.flatMap((p) => p.qas);
    // Short answers, so a reply that holds the fact matches the pattern; a long span would fail on paraphrase alone.
    const answerable = qas.filter((q) => !q.is_impossible && q.answers.every((x) => x.text.split(/\s+/).length <= 3 && x.text.length >= 2));
    for (const q of spread(answerable, 5, (q) => q.question, r, 1)) {
      const texts = [...new Set(q.answers.map((x) => x.text.trim()))];
      const pattern = texts.length > 1 ? `(?:${texts.map(esc).join("|")})` : esc(texts[0]!);
      cases.push({ id: `squad-${slug}-${cases.length + 1}`, question: q.question.trim(), sources: [slug], answer: [pattern], evidence: pattern });
    }
    for (const q of spread(qas.filter((q) => q.is_impossible), 2, (q) => q.question, r, 1)) absent.push({ id: `squad-${slug}-none-${absent.length + 1}`, question: q.question.trim() });
  }
  write("ask-squad.json", {
    about: "Ask-your-library questions from SQuAD 2.0 dev (Rajpurkar et al. 2018; CC BY-SA 4.0): 6 Wikipedia articles (squad-docs/, imported as sources), 5 questions each that one paragraph answers in at most three words (any annotator's span counts) and 2 each written to look answered by the article but not be (`absent`). Drawn by sample.ts, seed 3.",
    docs: "squad-docs", cases, hard: [], absent,
  });
}
console.log("wrote grade-saf.json, grade-scientsbank.json, ask-squad.json, squad-docs/");
