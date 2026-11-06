import { readFileSync } from "node:fs";
import { z } from "zod";
import { findItem, updateItemMeta } from "../items.ts";
import { chapterMarker, readNotes, sectionLines } from "../notes.ts";
import type { Library } from "../library.ts";
import { runAgent } from "./adapter.ts";
import { finishScope } from "./check.ts";

export const RecallFeedbackOutput = z.strictObject({
  feedback: z.string().min(1),
  questions: z.array(z.strictObject({ n: z.number().int(), feedback: z.string().min(1) })),
  missed: z.array(z.string().min(1)).max(3),
  section_lines: z.string().min(1).nullable(),
});
type Output = z.infer<typeof RecallFeedbackOutput>;

// section_lines is a sentence exactly when there were section lines to judge (D18, D32).
function sectionCheck(d: Output, given: unknown[]): string | null {
  if (given.length && d.section_lines === null) return "section_lines must be a sentence when section lines are given";
  if (!given.length && d.section_lines !== null) return "section_lines must be null when no section lines are given";
  return null;
}

// D18 finish step: feedback on Tyler's after-answers and free recall, stored
// as recall.feedback. Never a score.
export async function recallFeedback(lib: Library, ref: string) {
  const item = findItem(lib, ref);
  const prequestions = (item.meta.prequestions ?? [])
    .map((p, i) => ({ n: i + 1, q: p.q, before: p.before ?? null, after: p.after ?? null, skipped: !!p.skipped }))
    .filter((p) => !p.skipped)
    .map(({ skipped: _, ...p }) => p);
  const recall = item.meta.recall?.text;
  const sections = sectionLines(readNotes(item));
  const answered = new Set(prequestions.filter((p) => p.after !== null || p.before !== null).map((p) => p.n));
  if (!recall && !prequestions.some((p) => p.after !== null)) {
    throw new Error(`nothing to give feedback on: record a free recall (ore recall ${item.meta.id} --text) or after-answers (ore prequestion ${item.meta.id} <n> --after) first`);
  }
  const { data, ai } = await runAgent(lib, {
    prompt: "recall-feedback",
    cwd: lib.root,
    files: [item.docPath],
    schema: RecallFeedbackOutput,
    input: { item: { id: item.meta.id, title: item.meta.title, type: item.meta.type }, prequestions, recall: recall ?? null, section_lines: sections, scope: finishScope(item) },
    check: (d) => {
      const bad = d.questions.map((q) => q.n).filter((n, i, all) => !answered.has(n) || all.indexOf(n) !== i);
      return bad.length ? `questions[].n must be unique numbers of answered prequestions (${[...answered].join(", ")}); got ${bad.join(", ")}` : sectionCheck(d, sections);
    },
  });
  await updateItemMeta(lib, item.meta.id, (m) => {
    if (m.recall?.text !== recall) throw new Error("recall text changed while feedback was running; run ore recall --feedback again");
    return { ...m, recall: { ...m.recall, feedback: { ...data, ai } } };
  });
  return { item: item.meta.id, ...data, ai };
}

// Lines (1-based, in doc.md as a file) from the `<!-- chapter n -->` marker to
// the line before the next chapter marker, or to EOF.
export function chapterLines(fileText: string, n: number): { from: number; to: number } | null {
  const lines = fileText.split("\n");
  const from = lines.findIndex((l) => l.trim() === chapterMarker(n));
  if (from === -1) return null;
  const next = lines.findIndex((l, i) => i > from && /^<!-- chapter \d+ -->$/.test(l.trim()));
  return { from: from + 1, to: next === -1 ? lines.length : next };
}

// D18 for EPUBs: feedback on one chapter's closed-book recall only, stored
// as chapter_recalls[n].feedback. No prequestions; never a score.
export async function chapterRecallFeedback(lib: Library, ref: string, n: number) {
  const item = findItem(lib, ref);
  const recall = item.meta.chapter_recalls?.find((c) => c.n === n)?.text;
  if (!recall) throw new Error(`no recall for chapter ${n}: record one first (ore recall ${item.meta.id} --chapter ${n} --text)`);
  const file = readFileSync(item.docPath, "utf8");
  const lines = chapterLines(file, n);
  if (!lines) throw new Error(`item ${item.meta.id} has no ${chapterMarker(n)} marker`);
  // Only the section lines whose heading is in this chapter, and not the recall itself (it sits
  // under the chapter's title in the note, D115).
  const chapterText = file.split("\n").slice(lines.from - 1, lines.to).join("\n");
  const sections = sectionLines(readNotes(item)).filter((s) => chapterText.includes(s.heading) && s.text !== recall);
  const { data, ai } = await runAgent(lib, {
    prompt: "recall-feedback",
    cwd: lib.root,
    files: [item.docPath],
    schema: RecallFeedbackOutput,
    input: { item: { id: item.meta.id, title: item.meta.title, type: item.meta.type }, chapter: n, chapter_lines: lines, prequestions: [], recall, section_lines: sections },
    check: (d) => (d.questions.length ? "questions must be [] for a chapter recall" : sectionCheck(d, sections)),
  });
  const { feedback, missed, section_lines } = data;
  await updateItemMeta(lib, item.meta.id, (m) => {
    const cur = m.chapter_recalls?.find((c) => c.n === n);
    if (cur?.text !== recall) throw new Error(`chapter ${n} recall changed while feedback was running; run ore recall --chapter ${n} --feedback again`);
    return { ...m, chapter_recalls: m.chapter_recalls!.map((c) => (c.n === n ? { ...c, feedback: { feedback, missed, section_lines, ai } } : c)) };
  });
  return { item: item.meta.id, chapter: n, feedback, missed, section_lines, ai };
}
