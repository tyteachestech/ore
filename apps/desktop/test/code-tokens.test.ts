import { describe, expect, test } from "bun:test";
import { common, createLowlight } from "lowlight";
import { languageOf, tokens } from "../src/code-tokens";

const low = createLowlight(common);
const kinds = (lang: string, code: string) => tokens(low.highlight(lang, code)).map((t) => `${t.kind}:${code.slice(t.from, t.to)}`);

describe("code in a source is coloured by what each part is (D300)", () => {
  test("a keyword, a name, a string, a number and a comment each get their kind, by offsets into the text", () => {
    const got = kinds("python", 'def area(r):\n    # circle\n    return 3.14 * r, "ok"\n');
    expect(got).toContain("keyword:def");
    expect(got).toContain("name:area");
    expect(got).toContain("comment:# circle");
    expect(got).toContain("number:3.14");
    expect(got).toContain('string:"ok"');
  });
  test("offsets cover the text once and in order, so a Range can be laid on each", () => {
    const code = "const greet = (name) => `hi ${name}`; // say hi\n";
    const t = tokens(low.highlight("javascript", code));
    for (let i = 1; i < t.length; i++) expect(t[i]!.from).toBeGreaterThanOrEqual(t[i - 1]!.to);
    expect(t.at(-1)!.to).toBeLessThanOrEqual(code.length);
  });
  test("the language comes from the fence", () => {
    expect(languageOf("language-TypeScript")).toBe("typescript");
    expect(languageOf("language-c++")).toBe("c++");
    expect(languageOf(undefined)).toBeUndefined();
  });
});
