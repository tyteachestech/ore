import { afterAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// convertFileSrc, as the app's asset protocol answers it.
(globalThis as Record<string, unknown>).window = { __TAURI_INTERNALS__: { convertFileSrc: (p: string) => `asset://${p}` } };
const { ExerciseText } = await import("../src/ExerciseText");
// The stand-in is this file's alone: left behind, the next file to load a module that listens on `window` breaks on it (F422).
afterAll(() => void delete (globalThis as Record<string, unknown>).window);
const html = (text: string, inline = false, dir: string | null = "/lib/items/agents") => renderToStaticMarkup(createElement(ExerciseText, { text, dir: dir ?? undefined, inline }));

// F333: an exercise's question and answer were drawn as plain text, so its formulas,
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
  // One line is drawn inside rows and buttons (a quiz's key point): a link there is its words, code stays code (F732).
  expect(html("See [MDN on `Promise.all`](https://developer.mozilla.org/x)", true)).toBe("See MDN on <code>Promise.all</code>");
});

test("every place an exercise's question or answer is shown draws it with ExerciseText", () => {
  for (const f of ["Review.tsx", "SkillPage.tsx", "Home.tsx"]) {
    const src = readFileSync(join(import.meta.dir, "../src", f), "utf8");
    expect({ f, raw: src.match(/\{[\w.?]+\.(question|answer)\}\s*</g) }).toEqual({ f, raw: null });
  }
});

// Simulated learner run 2026-11-26 (owner): Review's key points and the grader's feedback showed code's backticks raw.
test("Review draws an exercise's key points and the grader's feedback with ExerciseText", () => {
  const src = readFileSync(join(import.meta.dir, "../src/Review.tsx"), "utf8");
  expect(src.match(/className="quiz-point">\{\w+\}|\{grade\??\.feedback\}\s*</g)).toBeNull();
});

// F340 (review of #440): text that looks like a tag was dropped, so "List<T>" read "List".
test("text in an exercise that looks like a tag shows as typed", () => {
  expect(html("What does List<T> return?")).toBe("<p>What does List&lt;T&gt; return?</p>");
  expect(html("Use <br> or <kbd>K</kbd>")).toBe("<p>Use &lt;br&gt; or &lt;kbd&gt;K&lt;/kbd&gt;</p>");
  expect(html("<div>a block</div>")).toContain("&lt;div&gt;a block&lt;/div&gt;");
});

// F341 (review of #440): in a one-line spot its paragraphs ran together ("First part.Second
// part.") and a code block or a formula on its own line was drawn as a block inside the line.
test("in a one-line spot an exercise is one line: blocks joined by a space, code and formulas inline", () => {
  expect(html("First part.\n\nSecond part.", true)).toBe("First part. Second part.");
  const line = html("Run this:\n\n```js\nconst a = 1;\n```\n\n$$x^2$$\n\nThen ![a chart](assets/c.png)", true);
  expect(line).not.toMatch(/<pre|katex-display|<p>|<img/);
  expect(line).toContain("<code>const a = 1;</code>");
  expect(line).toContain("katex");
  expect(line).toContain("a chart");
  expect(html("- one\n- two", true)).toBe("one two");
});

// F342 (review of #440): with no source folder an image got its relative path as src, a broken picture.
test("an image with no source folder to load from shows its alt text", () => {
  expect(html("See ![Workflow patterns](assets/patterns.svg)", false, null)).toBe("<p>See Workflow patterns</p>");
  expect(html("![A web one](https://example.com/a.png)", false, null)).toContain('src="https://example.com/a.png"');
});
