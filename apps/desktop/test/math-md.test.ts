import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { aiMath, reply } from "../src/math-md";

// F-new-raw-latex: an AI writes its formulas as $x$, \(x\) or \[x\]; a reply draws them as the reader does ($$x$$).
test("an AI's $x$, \\(x\\) and \\[x\\] become $$x$$; prices, $$x$$ and code stay as written", () => {
  expect(aiMath("Inline $E=mc^2$ here.")).toBe("Inline $$E=mc^2$$ here.");
  expect(aiMath("So \\(a^2+b^2\\) and")).toBe("So $$a^2+b^2$$ and");
  expect(aiMath("Then \\[\\frac{1}{2}\\] done").replace(/\s*\n+\s*/g, "|")).toBe("Then|$$\\frac{1}{2}$$|done");
  expect(aiMath("It costs $5 and $10, or $5-$10.")).toBe("It costs $5 and $10, or $5-$10.");
  expect(aiMath("Already $$x$$ and\n\n$$\ny\n$$")).toBe("Already $$x$$ and\n\n$$\ny\n$$");
  expect(aiMath("Run `echo $HOME$` or\n\n```sh\necho $a$\n```")).toBe("Run `echo $HOME$` or\n\n```sh\necho $a$\n```");
});

test("shell variables, a block still being written and a$b$c are not formulas", () => {
  expect(aiMath("Add `bin` to $HOME/$USER/bin and $PATH.")).toBe("Add `bin` to $HOME/$USER/bin and $PATH.");
  expect(aiMath("Set $A and $B, then a$b$c.")).toBe("Set $A and $B, then a$b$c.");
  expect(aiMath("Run:\n\n```sh\necho $a$ and")).toBe("Run:\n\n```sh\necho $a$ and");
});

test("a formula alone in its paragraph is drawn on its own line in a list and a quote too; in a table cell it stays inline", () => {
  const html = (md: string) => renderToStaticMarkup(createElement(ReactMarkdown, reply, md));
  expect(html("- step one\n\n  $$x^2$$\n")).toMatch(/<li>[\s\S]*katex-display/);
  expect(html("> $$x^2$$\n")).toMatch(/<blockquote>[\s\S]*katex-display/);
  expect(html("| a |\n|---|\n| $$x^2$$ |\n")).not.toContain("katex-display");
  expect(html("$$x^2$$")).toContain("katex-display");
});
