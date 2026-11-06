import { findAnnotation, readAnnotations, reviseAnnotation, type Annotation, type Contribution } from "./annotations.ts";
import { nowIso } from "./ids.ts";
import { findItem, listItems, updateItemMeta, type Item, type QuestionMatch } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";

// D47, D75: his questions (Question-intent highlights), each with his answer so far and the sources
// that may answer it. Linking happens by answering (a contribution names its source) or by a match.

export interface QuestionView extends Annotation {
  item_title: string;
  answers: (Contribution & { item_title?: string })[];
  /** Sources that may answer it: matched by enrich, or added for it from Begin research. */
  matches: { item: string; title: string; quote?: string; start?: number }[];
  /** With `item`: why it is listed for that source. */
  here?: "match" | "from" | "skill";
}

/** Questions filed under `skill`, or the ones a source is reading for (`item`: questions of its skills,
 *  asked in it, or matched to it). Open first, then newest asked. */
export function listQuestions(lib: Library, opts: { skill?: string; item?: string } = {}): QuestionView[] {
  const items = listItems(lib);
  const title = new Map(items.map((i) => [i.meta.id, i.meta.title]));
  const matchedBy = new Map<string, QuestionView["matches"]>();
  for (const i of items)
    for (const m of i.meta.question_matches ?? []) {
      if (i.meta.archived_at) continue;
      const list = matchedBy.get(m.question) ?? [];
      list.push({ item: i.meta.id, title: i.meta.title, quote: m.quote, start: m.start });
      matchedBy.set(m.question, list);
    }
  const source = opts.item ? findItem(lib, opts.item) : null;
  const all = items.flatMap((i) =>
    readAnnotations(i)
      .filter((a) => a.intent === "question")
      .map((a): QuestionView & { skills: string[] } => ({
        ...a,
        item_title: i.meta.title,
        skills: i.meta.skills,
        answers: (a.answers ?? []).map((c) => ({ ...c, item_title: c.item ? title.get(c.item) : undefined })),
        matches: matchedBy.get(a.id) ?? [],
      })),
  );
  const listed = all.flatMap(({ skills, ...q }): QuestionView[] => {
    if (opts.skill && !skills.includes(opts.skill)) return [];
    if (!source) return [q];
    const here = q.matches.some((m) => m.item === source.meta.id) ? "match" : q.item === source.meta.id ? "from" : skills.some((s) => source.meta.skills.includes(s)) ? "skill" : null;
    return here ? [{ ...q, here }] : [];
  });
  // Newest asked first, by id (a ULID, so creation time): answering one must not move it.
  return listed.sort((a, b) => (a.status === b.status ? b.id.localeCompare(a.id) : a.status === "open" ? -1 : 1));
}

export interface AnswerInput {
  text?: string;
  /** The source he wrote it from. */
  item?: string;
  quote?: string;
  done?: boolean;
  /** Answered + card: done, and the next enrich drafts a card from his answer (D75, amends D19). */
  card?: boolean;
  /** Removes the contribution with this ts. */
  remove?: string;
}

/** Adds a piece of his answer to a question and/or closes it (D75). */
export async function answerQuestion(lib: Library, ref: string, input: AnswerInput): Promise<{ question: Annotation; item: Item }> {
  const text = input.text?.trim();
  if (!text && !input.done && !input.card && !input.remove) throw new Error("nothing to do: give --text, --done, --card or --remove");
  if (input.item && !text) throw new Error("--item names the source of a contribution: give --text too");
  if (input.item) findItem(lib, input.item);
  return withLock(paths.lock(lib), () => {
    const { item, annotation } = findAnnotation(lib, ref);
    if (annotation.intent !== "question") throw new Error(`${annotation.id} is a ${annotation.intent} highlight, not a question`);
    let answers = annotation.answers ?? [];
    if (input.remove) {
      // One contribution: two written in the same millisecond share a ts.
      const at = answers.findIndex((c) => c.ts === input.remove);
      if (at === -1) throw new Error(`no contribution at ${input.remove}`);
      answers = answers.filter((_, i) => i !== at);
    }
    if (text) answers = [...answers, { ts: nowIso(), text, item: input.item ? findItem(lib, input.item).meta.id : undefined, quote: input.quote?.trim() || undefined }];
    if (input.card && !answers.length) throw new Error("a card is drafted from his answer: write one first");
    const question = reviseAnnotation(item, annotation, {
      answers: answers.length ? answers : undefined,
      ...(input.done || input.card ? { status: "done" as const } : {}),
      // Plain Answered after an undone "Answered + card" asks for no card.
      ...(input.card ? { card: true } : input.done ? { card: undefined } : {}),
    });
    return { question, item };
  });
}

/** Marks a source as one that may answer a question (D75), or drops that mark ("Not answered here"). */
export async function matchQuestion(lib: Library, itemRef: string, questionRef: string, opts: { drop?: boolean; quote?: string; start?: number } = {}) {
  const { annotation } = findAnnotation(lib, questionRef);
  if (annotation.intent !== "question") throw new Error(`${annotation.id} is not a question`);
  const item = findItem(lib, itemRef);
  return updateItemMeta(lib, item.meta.id, (m) => {
    const rest = (m.question_matches ?? []).filter((x) => x.question !== annotation.id);
    const next: QuestionMatch[] = opts.drop ? rest : [...rest, { question: annotation.id, quote: opts.quote, start: opts.start }];
    return { ...m, question_matches: next.length ? next : undefined };
  });
}
