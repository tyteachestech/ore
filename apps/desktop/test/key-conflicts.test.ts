import { afterEach, expect, test } from "bun:test";
import { BINDINGS, clash, is, rebind, resetKeys, restore, saved } from "../src/keys";

afterEach(() => resetKeys());

test("KEYS-02 Replace clears every live conflict and Undo restores the sound/silent defaults", () => {
  resetKeys();
  const before = saved();
  expect(clash("prev-post", "KeyK")).toBeNull();
  expect(rebind("section", "KeyK")).not.toBeNull();
  expect(saved()).toEqual(before);
  expect(rebind("section", "KeyK", true)).toBeNull();
  const key = { key: "k", code: "KeyK" } as KeyboardEvent;
  expect(BINDINGS.filter((b) => is(key, b.id)).map((b) => b.id)).toEqual(["section"]);
  expect(clash("section", "KeyK")).toBeNull();
  const replaced = saved();
  restore(before);
  expect(BINDINGS.filter((b) => is(key, b.id)).map((b) => b.id)).toEqual(["prev-post", "play-alt"]);
  restore(replaced);
  expect(clash("section", "KeyK")).toBeNull();
});

test("KEYS-02 Replace leaves a binding in a disjoint scope assigned", () => {
  resetKeys();
  expect(rebind("back-alt", "KeyK", true)).toBeNull();
  const key = { key: "k", code: "KeyK" } as KeyboardEvent;
  expect(is(key, "prev-post")).toBe(true);
  expect(is(key, "play-alt")).toBe(false);
  expect(is(key, "back-alt")).toBe(true);
});
