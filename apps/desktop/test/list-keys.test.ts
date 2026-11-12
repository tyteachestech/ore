import { describe, expect, test } from "bun:test";
import { listBreak } from "../src/list-keys";

/** The value after the edit, with | for the caret. */
function press(withCaret: string) {
  const at = withCaret.indexOf("|");
  const value = withCaret.replace("|", "");
  const e = listBreak(value, at);
  if (!e) return null;
  const out = value.slice(0, e.from) + e.text + value.slice(e.to);
  const caret = e.from + e.text.length;
  return out.slice(0, caret) + "|" + out.slice(caret);
}

describe("a list typed in a highlight's note", () => {
  test("a bullet carries on with the same marker", () => {
    expect(press("- one|")).toBe("- one\n- |");
    expect(press("* one|")).toBe("* one\n* |");
    expect(press("intro\n- one|")).toBe("intro\n- one\n- |");
  });
  test("a number counts up and keeps its punctuation and indent", () => {
    expect(press("1. one|")).toBe("1. one\n2. |");
    expect(press("9) nine|")).toBe("9) nine\n10) |");
    expect(press("  3. three|")).toBe("  3. three\n  4. |");
  });
  test("mid-item, the rest of the line becomes the next item", () => {
    expect(press("- one|two")).toBe("- one\n- |two");
  });
  test("an empty item ends the list and leaves the line empty", () => {
    expect(press("- one\n- |")).toBe("- one\n|");
    expect(press("1. one\n2. |")).toBe("1. one\n|");
  });
  test("anything else is an ordinary new line", () => {
    expect(press("plain|")).toBeNull();
    expect(press("-no space|")).toBeNull();
    expect(press("1.5 is a number|")).toBeNull();
    expect(press("-| one")).toBeNull(); // caret inside the marker
    expect(listBreak("- one", 0, 3)).toBeNull(); // a selection
  });
});
