import { describe, expect, test } from "bun:test";
import { cue, cueSource, CUE_LEVELS } from "../src/cue";

describe("a fading hint before No idea", () => {
  test("the first hint keeps each word's first letter and its length, nothing more", () => {
    expect(cue("Spacing beats cramming", 1)).toBe("S______ b____ c_______");
  });

  test("the second hint gives the first half of the words whole", () => {
    expect(cue("Spacing beats cramming for long retention", 2)).toBe("Spacing beats cramming f__ l___ r________");
  });

  test("punctuation, numbers and markdown marks stay as they are, so the shape reads", () => {
    expect(cue("**Lower** retention, in 2 days.", 1)).toBe("L____ r________, i_ 2 d___.");
  });

  test("a one-word answer still hides most of itself on the first hint and shows half on the second", () => {
    expect(cue("Retrievability", 1)).toBe("R_____________");
    expect(cue("Retrievability", 2)).toBe("Retriev_______");
  });

  test("an Explain exercise hints its first key point, a Fact its answer", () => {
    expect(cueSource({ kind: "prompt", answer: "Long model answer.", rubric: ["Retrieval strengthens memory", "Spacing"] })).toBe("Retrieval strengthens memory");
    expect(cueSource({ kind: "prompt", answer: "Only an answer.", rubric: [] })).toBe(""); // no key point: no hint
    expect(cueSource({ kind: "card", answer: "Hippocampus", rubric: [] })).toBe("Hippocampus");
    expect(cueSource({ kind: "card", answer: "7", rubric: [] })).toBe(""); // its first letter is all of it: no hint
  });

  test("a number is masked like a word, so a point that turns on one doesn't give it away", () => {
    expect(cue("1945", 1)).toBe("1___");
    expect(cue("Ended in 1945", 1)).toBe("E____ i_ 1___");
  });

  test("an underscore inside a word stays part of it, so snake_case keeps its length", () => {
    expect(cue("use snake_case names", 1)).toBe("u__ s_________ n____");
  });

  test("there are two hints, then No idea", () => expect(CUE_LEVELS).toBe(2));
});
