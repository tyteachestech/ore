import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findItem } from "../src/items.ts";
import { addGolden, ask, loadAskCases, passagesFor, retrieved, scoreAnswer } from "../eval/ask.ts";
import { tempLibrary } from "./helpers.ts";

const saved = { path: process.env.PATH, ai: process.env.ORE_AI };
afterEach(() => {
  process.env.PATH = saved.path;
  if (saved.ai === undefined) delete process.env.ORE_AI;
  else process.env.ORE_AI = saved.ai;
});
/** A fake `claude` that always gives this structured output. */
function fakeClaude(out: unknown) {
  const dir = mkdtempSync(join(tmpdir(), "ore-fakebin-"));
  writeFileSync(join(dir, "claude"), `#!/usr/bin/env bun\nconsole.log(JSON.stringify({ is_error: false, structured_output: ${JSON.stringify(out)}, modelUsage: { "claude-fake-1": { outputTokens: 5 } } }));\n`);
  chmodSync(join(dir, "claude"), 0o755);
  process.env.PATH = `${dir}:${saved.path}`;
  process.env.ORE_AI = "claude";
}

describe("ask-your-library eval", () => {
  test("20 questions answered by the golden docs, 9 that none answer; ids unique, patterns valid", () => {
    const { cases, absent } = loadAskCases();
    expect(cases).toHaveLength(20);
    expect(absent.length).toBeGreaterThanOrEqual(9);
    expect(new Set([...cases, ...absent].map((c) => c.id)).size).toBe(cases.length + absent.length);
    for (const c of cases) for (const p of [...c.answer, c.evidence]) expect(() => new RegExp(p)).not.toThrow();
  });

  test("retrieval puts each question's evidence in front of the AI, for both chats (the eval then measures the AI, not the search)", async () => {
    const lib = await tempLibrary();
    const names = await addGolden(lib);
    for (const chat of ["tutor", "ask"] as const)
      for (const c of loadAskCases().cases) expect({ chat, id: c.id, found: retrieved(c, passagesFor(lib, chat, c.question), names) }).toEqual({ chat, id: c.id, found: true });
  });

  test("the tutor is asked as the app asks it; general knowledge with no citation reads as not from his sources", async () => {
    const lib = await tempLibrary();
    await addGolden(lib);
    fakeClaude({ reply: "Ebbinghaus was born in 1850.", citations: [], general: true, hint: false, exercise: null, card: null });
    const r = await ask(lib, "tutor", "In what year was Hermann Ebbinghaus born?");
    expect(r).toMatchObject({ found: false, outside: true, answer: "Ebbinghaus was born in 1850.", citations: [] });
    expect(r.ai?.prompt_version).toMatch(/^tutor@/);
    // A plain refusal counts too; an unlabelled answer with no citation doesn't.
    fakeClaude({ reply: "Your sources don't say when he was born.", citations: [], general: false, hint: false, exercise: null, card: null });
    expect((await ask(lib, "tutor", "In what year was Hermann Ebbinghaus born?")).outside).toBe(true);
    fakeClaude({ reply: "He was born in 1850.", citations: [], general: false, hint: false, exercise: null, card: null });
    expect((await ask(lib, "tutor", "In what year was Hermann Ebbinghaus born?")).outside).toBe(false);
  });

  test("scoring: the answer must hold every pattern; a citation must be real and one must hold the evidence; an absent question must say so", async () => {
    const lib = await tempLibrary();
    const names = await addGolden(lib);
    const wiki = [...names].find(([, n]) => n === "web-wikipedia")![0];
    const body = (id: string) => findItem(lib, id).body;
    const at = body(wiki).indexOf("return to the first box");
    const cite = { n: 1, item: wiki, title: "Spaced repetition", heading: "", quote: "return to the first box", text: "return to the first box", start: at, end: at + 23 };
    const c = loadAskCases().cases.find((x) => x.id === "wiki-leitner-wrong")!;
    const r = (over: object) => ({ found: true, answer: "It goes back to the first box [1].", citations: [cite], outside: false, ...over });
    expect(scoreAnswer(c, r({}), names, body)).toEqual({ answer_ok: true, citation_ok: true });
    expect(scoreAnswer(c, r({ answer: "It moves up a box [1]." }), names, body)).toEqual({ answer_ok: false, citation_ok: true });
    expect(scoreAnswer(c, r({ citations: [{ ...cite, start: at + 1 }] }), names, body).citation_ok).toBe(false); // not where it says
    expect(scoreAnswer(c, r({ citations: [] }), names, body).citation_ok).toBe(false);
    const absent = loadAskCases().absent[0]!;
    expect(scoreAnswer(absent, r({ found: false, citations: [], outside: true }), names, body)).toEqual({ answer_ok: true, citation_ok: true });
    expect(scoreAnswer(absent, r({}), names, body).answer_ok).toBe(false); // cited a passage for a fact the library lacks
    expect(scoreAnswer(absent, r({ found: false, citations: [], outside: false }), names, body).answer_ok).toBe(false); // answered without saying it isn't his sources
  });
});
