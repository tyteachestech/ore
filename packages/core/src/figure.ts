import { join } from "node:path";
import { type Card, writeNewCard } from "./cards.ts";
import { findItem, type Item } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";

export const FIGURE_QUESTION = "What’s under the box?";

/** The images a source's doc.md shows, as it names them (`![…](src)`). */
export function figureSrcs(body: string): string[] {
  return [...body.matchAll(/!\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^)\s]+))(?:\s+"[^"]*")?\s*\)/g)].map((m) => (m[1] ?? m[2])!);
}

const plain = (s: string) => {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
};

/** Where a figure card's image is: a web image as it is, a saved one in its source's folder. */
export function figureFile(item: Item, src: string): string {
  return /^(https?:|data:)/i.test(src) ? src : join(item.dir, plain(src));
}

/** A Fact card from one part of a figure (D166, image occlusion): in review the figure shows with `box`
 *  covered, he recalls what is under it, and the answer is `label`. The figure must be one the source shows,
 *  and the box inside it. */
export async function addFigureCard(lib: Library, ref: string, f: { src: string; box: number[]; label: string }): Promise<Card> {
  const label = f.label.trim();
  if (!label) throw new Error("say what’s under the box: it is the exercise’s answer");
  if (/[\r\n]/.test(label)) throw new Error("what’s under the box is one line");
  const [x, y, w, h] = f.box;
  const ok = (n: number | undefined): n is number => typeof n === "number" && Number.isFinite(n);
  if (f.box.length !== 4 || ![x, y, w, h].every(ok)) throw new Error("the box is four numbers: x,y,w,h as fractions of the figure");
  if (x! < 0 || y! < 0 || w! < 0.01 || h! < 0.01 || x! + w! > 1.001 || y! + h! > 1.001) throw new Error("the box must sit inside the figure");
  const r = (n: number) => Math.round(n * 1e4) / 1e4;
  return withLock(paths.lock(lib), () => {
    const item = findItem(lib, ref);
    // As the doc writes it: the reader hands over the address its Markdown parser made (spaces as %20).
    const src = figureSrcs(item.body).find((s) => plain(s) === plain(f.src));
    if (!src) throw new Error(`“${f.src}” isn’t a figure in ${item.meta.title}`);
    return writeNewCard(lib, {
      kind: "card", item: item.meta.id, skills: item.meta.skills, topics: item.meta.topics.slice(0, 1), content_type: "fact",
      question: FIGURE_QUESTION, answer: label, rubric: [], figure: { src, box: [r(x!), r(y!), r(Math.min(w!, 1 - x!)), r(Math.min(h!, 1 - y!))] },
    });
  });
}
