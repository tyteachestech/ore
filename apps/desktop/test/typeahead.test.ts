import { expect, test } from "bun:test";
import { typeJump, typesTitle } from "../src/typeahead";

const titles = ["Atomic Habits", "Deep Work", "Désirable difficulties", "Make It Stick", "make it count", "Spacing effect", "Sleep and memory", "Spaced repetition"];

test("type-select: a prefix picks the first title that starts with it, ignoring case and accents", () => {
  expect(typeJump(titles, "make", 0)).toBe(3);
  expect(typeJump(titles, "make it c", 3)).toBe(4);
  expect(typeJump(titles, "des", 0)).toBe(2);
  expect(typeJump(titles, "spaced", 0)).toBe(7);
});

test("type-select: the same letter again steps to the next title starting with it, round to the top", () => {
  expect(typeJump(titles, "s", 0)).toBe(5);
  expect(typeJump(titles, "s", 5)).toBe(6);
  expect(typeJump(titles, "s", 7)).toBe(5);
  expect(typeJump(titles, "ss", 6)).toBe(7);
});

test("type-select: no match leaves the selection where it is", () => {
  expect(typeJump(titles, "zz", 2)).toBe(-1);
  expect(typeJump(titles, "deep q", 1)).toBe(-1);
  expect(typeJump([], "a", -1)).toBe(-1);
});

test("type-select: a longer prefix keeps the selected row while it still matches", () => {
  expect(typeJump(titles, "sp", 7)).toBe(7);
});

test("type-select: only plain printable keys type, and Space only once a prefix has begun", () => {
  const k = (key: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}) => ({ key, metaKey: false, ctrlKey: false, altKey: false, ...mods });
  expect(typesTitle(k("a"), false)).toBe(true);
  expect(typesTitle(k("a", { metaKey: true }), false)).toBe(false);
  expect(typesTitle(k("ArrowDown"), false)).toBe(false);
  expect(typesTitle(k(" "), false)).toBe(false);
  expect(typesTitle(k(" "), true)).toBe(true);
  expect(typesTitle(k("é"), false)).toBe(true);
});

test("type-select: a doubled letter a title starts with picks it; with nothing selected, a repeat still steps", () => {
  const l = ["Lambda", "Lisp", "Llama"];
  expect(typeJump(l, "l", -1)).toBe(0);
  expect(typeJump(l, "ll", 0)).toBe(2);
  expect(typeJump(titles, "ss", -1)).toBe(5);
});
