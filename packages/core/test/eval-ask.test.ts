import { describe, expect, test } from "bun:test";
import { retrieve } from "../src/ai/ask.ts";
import { findItem } from "../src/items.ts";
import { addGolden, loadAskCases, scoreAnswer } from "../eval/ask.ts";
import { tempLibrary } from "./helpers.ts";

describe("ask-your-library eval", () => {
  test("20 questions answered by the golden docs, 5 that none answer; ids unique, patterns valid", () => {
    const { cases, absent } = loadAskCases();
    expect(cases).toHaveLength(20);
    expect(absent.length).toBeGreaterThanOrEqual(5);
    expect(new Set([...cases, ...absent].map((c) => c.id)).size).toBe(cases.length + absent.length);
    for (const c of cases) for (const p of [...c.answer, c.evidence]) expect(() => new RegExp(p)).not.toThrow();
  });

  test("retrieval puts each question's evidence in front of the AI (the eval then measures the AI, not the search)", async () => {
    const lib = await tempLibrary();
    const names = await addGolden(lib);
    for (const c of loadAskCases().cases) {
      const ps = retrieve(lib, c.question);
      expect({ id: c.id, found: ps.some((p) => c.sources.includes(names.get(p.item)!) && new RegExp(c.evidence, "i").test(p.text)) }).toEqual({ id: c.id, found: true });
    }
  });

  test("scoring: the answer must hold every pattern; a citation must be real and one must hold the evidence; an absent question must say so", async () => {
    const lib = await tempLibrary();
    const names = await addGolden(lib);
    const wiki = [...names].find(([, n]) => n === "web-wikipedia")![0];
    const body = (id: string) => findItem(lib, id).body;
    const at = body(wiki).indexOf("return to the first box");
    const cite = { n: 1, item: wiki, title: "Spaced repetition", heading: "", quote: "return to the first box", text: "return to the first box", start: at, end: at + 23 };
    const c = loadAskCases().cases.find((x) => x.id === "wiki-leitner-wrong")!;
    const r = (over: object) => ({ question: c.question, found: true, answer: "It goes back to the first box [1].", citations: [cite], ai: null, usage: null, ...over });
    expect(scoreAnswer(c, r({}), names, body)).toEqual({ answer_ok: true, citation_ok: true });
    expect(scoreAnswer(c, r({ answer: "It moves up a box [1]." }), names, body)).toEqual({ answer_ok: false, citation_ok: true });
    expect(scoreAnswer(c, r({ citations: [{ ...cite, start: at + 1 }] }), names, body).citation_ok).toBe(false); // not where it says
    expect(scoreAnswer(c, r({ citations: [] }), names, body).citation_ok).toBe(false);
    const absent = loadAskCases().absent[0]!;
    expect(scoreAnswer(absent, r({ found: false, citations: [] }), names, body)).toEqual({ answer_ok: true, citation_ok: true });
    expect(scoreAnswer(absent, r({}), names, body).answer_ok).toBe(false);
  });
});
