import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The AI writes a prequestion, a quiz's key points and its feedback as Markdown: `await`, $x^2$. Review drew its
// exercises with ExerciseText (F333), but the reader's prequestions, the finish quiz and the recall feedback put the
// same kind of text on screen as typed, backticks and all (F732). ExerciseText's own drawing is
// checked in exercise-text.test.tsx; this checks no AI text in these two screens goes round it.
const src = (f: string) => readFileSync(join(import.meta.dir, "../src", f), "utf8");
const PLAIN = [/>\s*\{q\.q\}\s*</, /^\s*\{q\.q\}\s*$/m, /^\s*\{p\.text\}\s*$/m, /<p>\{(\w+\.)?feedback\.feedback\}<\/p>/, /<li key=\{i\}>\{m\}<\/li>/];

for (const f of ["Finish.tsx", "Reader.tsx"])
  test(`${f}: a question, a key point and feedback the AI wrote are drawn as Markdown, not as typed`, () => {
    for (const re of PLAIN) expect(src(f)).not.toMatch(re);
    expect(src(f)).toContain("<ExerciseText text={q.q} inline />");
  });
