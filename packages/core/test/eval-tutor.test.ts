import { describe, expect, test } from "bun:test";
import { failures, loadTutorCases } from "../eval/tutor.ts";

const reply = (over: object = {}) => ({ reply: "Think about which box the hard cards go to?", hint: true, exercise: false, cited: 0, searched: false, ...over });

describe("tutor pedagogy eval", () => {
  test("cases load with unique ids and valid patterns; each checks something", () => {
    const cases = loadTutorCases();
    expect(cases.length).toBeGreaterThanOrEqual(12);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) {
      for (const p of [...(c.expect.gives ?? []), ...(c.expect.withholds ?? [])]) expect(() => new RegExp(p)).not.toThrow();
      expect(Object.keys(c.expect).length).toBeGreaterThan(0);
    }
  });

  test("a hint that holds the answer back passes; one that gives it away, or searches, fails", () => {
    const e = { hint: true, withholds: ["first (box|group)"], no_search: true };
    expect(failures(e, reply())).toEqual([]);
    expect(failures(e, reply({ reply: "It goes back to the first box." }))).toEqual(["gave /first (box|group)/"]);
    expect(failures(e, reply({ hint: false, searched: true }))).toEqual(["not a hint", "searched the web"]);
  });

  test("feedback must ask him something and never score him; a worked example's own numbers aren't the answer", () => {
    expect(failures({ asks: true, no_score: true }, reply({ reply: "Not quite: it's 25% [1]. Next: which review matters most?" }))).toEqual([]);
    expect(failures({ asks: true, no_score: true }, reply({ reply: "Good answer, 7/10." }))).toEqual(["doesn't ask", "a score"]);
    const withholds = loadTutorCases().find((c) => c.id === "no-idea-worked-example")!.expect;
    expect(failures(withholds, reply({ reply: "Say a gap of 10 days: you get 10 × 2.5 = 25. Now yours?" }))).toEqual([]);
    expect(failures(withholds, reply({ reply: "The next gap is 10." }))).toEqual(["gave /" + withholds.withholds![0] + "/"]);
  });

  test("the checks read what the reply means: a fraction isn't a score, a quoted question isn't asking, a rejection isn't a yes", () => {
    expect(failures({ no_score: true }, reply({ reply: "Not quite: about 1/4 (25%) is recalled after 7 days [1]." }))).toEqual([]);
    expect(failures({ no_score: true }, reply({ reply: "I'd give that 8 out of 10." }))).toEqual(["a score"]);
    expect(failures({ asks: true }, reply({ reply: 'You said half to "how much is recalled after 7 days?": it is 25% [1].' }))).toEqual(["doesn't ask"]);
    const right = loadTutorCases().find((c) => c.id === "quiz-right-answer")!.expect;
    expect(failures(right, reply({ reply: "Exactly right: 25% [1]." }))).toEqual([]);
    expect(failures(right, reply({ reply: "Not quite right: 25% is incorrect, it's 21% [1]." })).length).toBeGreaterThan(0);
    const worked = loadTutorCases().find((c) => c.id === "no-idea-worked-example")!.expect;
    expect(failures(worked, reply({ reply: "Try this 10-second check on a gap of 2 days first." }))).toEqual([]);
    expect(failures(worked, reply({ reply: "So you'd wait 10 days next." })).length).toBe(1);
  });
});
