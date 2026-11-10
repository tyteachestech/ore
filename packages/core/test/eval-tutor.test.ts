import { describe, expect, test } from "bun:test";
import { asSeen, failures, loadTutorCases, summary, tally, unblind, type TutorResult } from "../eval/tutor.ts";
import { loadPrompt, usePromptText } from "../src/ai/prompts.ts";
import { withSteps } from "../src/ai/tutor.ts";

const reply = (over: object = {}) => ({ reply: "Think about which box the hard cards go to?", hint: true, exercise: false, steps: 0, cited: 0, searched: false, ...over });

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

  test("a worked answer is checked with its steps, where Show me puts the answer (D142)", () => {
    const show = loadTutorCases().find((c) => c.id === "flashcard-show-me")!.expect;
    const said = withSteps({ reply: "Here's how it works.", steps: ["A card you miss drops a box.", "It goes back to the first box [1]."] });
    expect(said).toBe("Here's how it works.\n1. A card you miss drops a box.\n2. It goes back to the first box [1].");
    expect(failures(show, reply({ reply: said, hint: false, cited: 1 }))).toEqual([]);
    const worked = loadTutorCases().find((c) => c.id === "worked-example-show-me")!.expect;
    expect(failures(worked, reply({ reply: withSteps({ reply: "Here's the working.", steps: ["You remembered it, so the gap is multiplied: 4 × 2.5.", "That makes the next gap 10 days."] }), hint: false, steps: 2 }))).toEqual([]);
    expect(failures(worked, reply({ reply: "The next gap is 10 days.", hint: false }))).toEqual(["no steps"]);
  });

  // The app shows a tell apart's cases under the reply (D163), so the reply alone no longer holds them.
  test("what the judge reads holds a tell apart's two cases, as he sees them", () => {
    expect(asSeen({ reply: "Which idea fits each?", steps: [], exercise: { cases: ["Ana rereads her notes.", "Ben quizzes himself."] } })).toBe("Which idea fits each?\nCase A: Ana rereads her notes.\nCase B: Ben quizzes himself.");
    expect(asSeen({ reply: "Explain why.", steps: [], exercise: { cases: null } })).toBe("Explain why.");
  });

  test("exercise feedback that found a miss offers the committed card; the exercise turn carries it (D158)", () => {
    const c = loadTutorCases().find((c) => c.id === "exercise-feedback")!;
    expect(c.earlier?.[0]?.exercise?.card.rubric.length).toBe(3);
    const fb = reply({ reply: "Right that it shows what you don't know [1]. Missing: each recall makes the path easier. What happens on the second recall?", hint: false, cited: 1 });
    expect(failures(c.expect, { ...fb, card: true })).toEqual([]);
    expect(failures(c.expect, { ...fb, card: false })).toEqual(["no card"]);
    expect(failures({ card: false }, { ...fb, card: true })).toEqual(["a card"]);
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

  test("repeated runs pool into one rate and name the cases that passed only some runs", () => {
    const r = (id: string, ok: boolean): TutorResult => ({ id, ok, failed: ok ? [] : ["x"], ms: 1 });
    const s = summary([[r("a", true), r("b", true)], [r("a", true), r("b", false)], [r("a", true), r("b", true)]]);
    expect(s).toMatchObject({ passed: "5/6", flaky: ["b 2/3"] });
    expect(summary([[r("a", false)]]).flaky).toEqual([]);
  });

  test("judge checks are sentences about the reply", () => {
    for (const c of loadTutorCases()) for (const j of c.expect.judge ?? []) expect(j).toMatch(/^It .+\.$/);
  });

  test("a blind comparison maps the judge's A or B back to new or old, whichever side each was shown on", () => {
    expect([unblind("A", false), unblind("B", false), unblind("A", true), unblind("B", true), unblind("same", true)]).toEqual(["new", "old", "old", "new", "same"]);
    expect(tally([{ id: "a", pick: "new" }, { id: "b", pick: "old" }, { id: "b", pick: "old" }, { id: "c", pick: "same" }])).toEqual({ new: 1, old: 2, same: 1, old_won: ["b"] });
  });

  test("an older tutor prompt stands in for the comparison, then today's comes back", () => {
    const today = loadPrompt("tutor").version;
    usePromptText("tutor", "---\nname: tutor\nversion: 1\n---\nOld rules.");
    expect(loadPrompt("tutor")).toMatchObject({ version: "tutor@1", text: "Old rules." });
    usePromptText("tutor");
    expect(loadPrompt("tutor").version).toBe(today);
  });
});
