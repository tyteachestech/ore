import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findItem } from "../src/items.ts";
import { addGolden, ask, loadAskCases, passagesFor, retrieved, saysNotThere, scoreAnswer } from "../eval/ask.ts";
import { tempLibrary } from "./helpers.ts";

const saved = { path: process.env.PATH, ai: process.env.ORE_AI };
afterEach(() => {
  process.env.PATH = saved.path;
  if (saved.ai === undefined) delete process.env.ORE_AI;
  else process.env.ORE_AI = saved.ai;
});
/** A fake `claude` that always gives this structured output, after these stream-json events (a web search's). */
function fakeClaude(out: unknown, events: unknown[] = []) {
  const dir = mkdtempSync(join(tmpdir(), "ore-fakebin-"));
  writeFileSync(join(dir, "claude"), `#!/usr/bin/env bun\n${events.map((e) => `console.log(${JSON.stringify(JSON.stringify(e))});\n`).join("")}console.log(JSON.stringify({ type: "result", is_error: false, structured_output: ${JSON.stringify(out)}, modelUsage: { "claude-fake-1": { outputTokens: 5 } } }));\n`);
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
    // A web page's link says so too: it is plainly not one of his sources.
    const page = { url: "https://www.britannica.com/biography/Hermann-Ebbinghaus", title: "Hermann Ebbinghaus" };
    fakeClaude({ reply: "He was born in 1850 [1].", citations: [{ passage: page.url, quote: "born on January 24, 1850" }], general: false, hint: false, exercise: null, card: null }, [
      { type: "assistant", message: { content: [{ type: "tool_use", id: "t1", name: "WebSearch", input: { query: "q" } }] } },
      { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "Hermann Ebbinghaus was born on January 24, 1850." }] }, tool_use_result: { results: [{ content: [page] }] } },
    ]);
    expect(await ask(lib, "tutor", "In what year was Hermann Ebbinghaus born?")).toMatchObject({ found: false, outside: true, searched: true, citations: [], web: [{ url: page.url, site: "britannica.com" }] });
  });

  test("a reply says the answer isn't in his sources in words, even when it cites what is there nearby", () => {
    for (const t of ["Your passages don't give his birth year. They do say he devised it in 1973 [1].", "Your notes only say that consolidation happens during sleep [1]. They don't give a number of hours.",
      "Your source says consolidation happens during sleep, but gives no number of hours.[1]", "That date isn’t in the passages you shared.", "It's none of your sources, so this is general knowledge."])
      expect({ t, says: saysNotThere(t) }).toEqual({ t, says: true });
    for (const t of ["FSRS defaults to 90% retention [1].", "Your source says consolidation happens during sleep [1].", "Sebastian Leitner was born in 1919."])
      expect({ t, says: saysNotThere(t) }).toEqual({ t, says: false });
  });

  test("scoring: the answer must hold every pattern; a citation must be real and one must hold the evidence; an absent question must say so", async () => {
    const lib = await tempLibrary();
    const names = await addGolden(lib);
    const wiki = [...names].find(([, n]) => n === "web-wikipedia")![0];
    const body = (id: string) => findItem(lib, id).body;
    const at = body(wiki).indexOf("return to the first box");
    const cite = { n: 1, item: wiki, title: "Spaced repetition", heading: "", quote: "return to the first box", text: "return to the first box", start: at, end: at + 23 };
    const c = loadAskCases().cases.find((x) => x.id === "wiki-leitner-wrong")!;
    const r = (over: object) => ({ found: true, answer: "It goes back to the first box [1].", citations: [cite], web: [], outside: false, ...over });
    expect(scoreAnswer(c, r({}), names, body)).toEqual({ answer_ok: true, citation_ok: true });
    expect(scoreAnswer(c, r({ answer: "It moves up a box [1]." }), names, body)).toEqual({ answer_ok: false, citation_ok: true });
    expect(scoreAnswer(c, r({ citations: [{ ...cite, start: at + 1 }] }), names, body).citation_ok).toBe(false); // not where it says
    expect(scoreAnswer(c, r({ citations: [] }), names, body).citation_ok).toBe(false);
    const absent = loadAskCases().absent.find((x) => !x.outside)!; // no settled answer to get right
    expect(scoreAnswer(absent, r({ found: false, citations: [], outside: true }), names, body)).toEqual({ answer_ok: true, citation_ok: true });
    expect(scoreAnswer(absent, r({}), names, body).answer_ok).toBe(false); // cited a passage as if it held the answer
    expect(scoreAnswer(absent, r({ outside: true }), names, body)).toEqual({ answer_ok: true, citation_ok: true }); // said so, and cited what is there nearby
    expect(scoreAnswer(absent, r({ found: false, citations: [], outside: false }), names, body).answer_ok).toBe(false); // answered without saying it isn't his sources
    // Where the fact is settled, the answer from outside his library must also be right.
    const born = loadAskCases().absent.find((x) => x.id === "absent-ebbinghaus-born")!;
    expect(scoreAnswer(born, r({ found: false, citations: [], outside: true, answer: "Your sources don't say; he was born in 1850 [1]." }), names, body).answer_ok).toBe(true);
    expect(scoreAnswer(born, r({ found: false, citations: [], outside: true, answer: "Your sources don't say; he was born in 1856." }), names, body).answer_ok).toBe(false);
  });
});
