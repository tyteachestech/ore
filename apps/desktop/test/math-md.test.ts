import { expect, test } from "bun:test";
import { aiMath } from "../src/math-md";

// F-new-raw-latex: an AI writes its formulas as $x$, \(x\) or \[x\]; a reply draws them as the reader does ($$x$$).
test("an AI's $x$, \\(x\\) and \\[x\\] become $$x$$; prices, $$x$$ and code stay as written", () => {
  expect(aiMath("Inline $E=mc^2$ here.")).toBe("Inline $$E=mc^2$$ here.");
  expect(aiMath("So \\(a^2+b^2\\) and")).toBe("So $$a^2+b^2$$ and");
  expect(aiMath("Then \\[\\frac{1}{2}\\] done").replace(/\s*\n+\s*/g, "|")).toBe("Then|$$\\frac{1}{2}$$|done");
  expect(aiMath("It costs $5 and $10, or $5-$10.")).toBe("It costs $5 and $10, or $5-$10.");
  expect(aiMath("Already $$x$$ and\n\n$$\ny\n$$")).toBe("Already $$x$$ and\n\n$$\ny\n$$");
  expect(aiMath("Run `echo $HOME$` or\n\n```sh\necho $a$\n```")).toBe("Run `echo $HOME$` or\n\n```sh\necho $a$\n```");
});
