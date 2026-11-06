import { describe, expect, test } from "bun:test";
import { snap } from "../src/Grab";

const T = "Start with the simplest solution, then grow it.";

describe("dragged highlight edges snap to whole words", () => {
  test("an end mid-word goes on to the word's end, its punctuation with it", () => {
    expect(T.slice(0, snap(T, T.indexOf("solution") + 3, "end"))).toBe("Start with the simplest solution,");
  });
  test("an end just past a word stays at that word, without the space", () => {
    expect(T.slice(0, snap(T, T.indexOf(" then"), "end"))).toBe("Start with the simplest solution,");
    expect("a  b".slice(0, snap("a  b", 2, "end"))).toBe("a");
  });
  test("a start mid-word goes back to the word's start", () => {
    expect(T.slice(snap(T, T.indexOf("simplest") + 4, "start"))).toBe("simplest solution, then grow it.");
  });
  test("a start in a run of spaces goes on to the next word", () => {
    expect("a  b".slice(snap("a  b", 2, "start"))).toBe("b");
  });
});
