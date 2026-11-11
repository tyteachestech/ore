import { type Card, cardStates, listCards, writeNewCard } from "./cards.ts";
import { findItem } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";

/** What a cell card asks: the row and the column that meet at the cell he recalls. */
export const cellQuestion = (row: string, column: string) => `${row} · ${column}?`;

/** Letters and digits only, lower-cased: a cell as the reader shows it against the Markdown that wrote it. */
const bare = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** A Fact card from one cell of a table (D200): the question names its row and column, the answer is what
 *  the cell says. The source must have a table row that holds both the row's name and the answer, and
 *  a cell makes one exercise. */
export async function addCellCard(lib: Library, ref: string, f: { row: string; column: string; answer: string }): Promise<Card> {
  const [row, column, answer] = [f.row, f.column, f.answer].map((s) => s.trim().replace(/\s+/g, " ")) as [string, string, string];
  if (!answer) throw new Error("the cell is empty: there is nothing to recall");
  if (!row || !column) throw new Error("name the cell’s row and column: they are the exercise’s question");
  return withLock(paths.lock(lib), () => {
    const item = findItem(lib, ref);
    const lines = item.body.split("\n").filter((l) => l.trimStart().startsWith("|")).map(bare);
    if (!lines.some((l) => l.includes(bare(row)) && l.includes(bare(answer)))) throw new Error(`“${row}” and “${answer}” aren’t in one row of a table in ${item.meta.title}`);
    const question = cellQuestion(row, column);
    const state = cardStates(lib);
    if (listCards(lib).some((c) => c.meta.item === item.meta.id && c.question === question && state(c) !== "retired")) throw new Error("that cell already has an exercise");
    return writeNewCard(lib, { kind: "card", item: item.meta.id, skills: item.meta.skills, topics: item.meta.topics.slice(0, 1), content_type: "fact", question, answer, rubric: [] });
  });
}
