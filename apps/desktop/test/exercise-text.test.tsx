import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// convertFileSrc, as the app's asset protocol answers it.
(globalThis as Record<string, unknown>).window = { __TAURI_INTERNALS__: { convertFileSrc: (p: string) => `asset://${p}` } };
const { ExerciseText } = await import("../src/ExerciseText");
const html = (text: string, inline = false) => renderToStaticMarkup(createElement(ExerciseText, { text, dir: "/lib/items/agents", inline }));

// F-new-exercise-markdown: an exercise's question and answer were drawn as plain text, so its formulas,
// code and images showed raw.
test("an exercise's math, code and source images are drawn; plain text stays as it was", () => {
  expect(html("What does $$E=mc^2$$ mean in this diagram?")).toContain("katex");
  const answer = html("![Workflow patterns](assets/patterns.svg)\n\n$$E=mc^2$$\n\n```js\nconst e = m * c ** 2;\n```");
  expect(answer).toContain('src="asset:///lib/items/agents/assets/patterns.svg"');
  expect(answer).toContain("katex-display");
  expect(answer).toMatch(/<pre><code class="language-js">const e = m \* c \*\* 2;/);
  // An AI's own $x$ is a formula too, as in a tutor reply (F320); a price is not.
  expect(html("So $x^2$ costs $5.")).toContain("katex");
  expect(html("It costs $5 and $10.")).not.toContain("katex");
  // A line break he typed stays a line break; a blank, still a blank.
  expect(html("line one\nline two")).toBe("<p>line one\nline two</p>");
  expect(html("The ____ effect")).toBe("<p>The ____ effect</p>");
  // In a one-line list (a skill's fan, "You can now explain") no paragraph wraps it.
  expect(html("Why $$x$$?", true)).not.toContain("<p>");
});

test("every place an exercise's question or answer is shown draws it with ExerciseText", () => {
  for (const f of ["Review.tsx", "SkillPage.tsx", "Home.tsx"]) {
    const src = readFileSync(join(import.meta.dir, "../src", f), "utf8");
    expect({ f, raw: src.match(/\{[\w.?]+\.(question|answer)\}\s*</g) }).toEqual({ f, raw: null });
  }
});
