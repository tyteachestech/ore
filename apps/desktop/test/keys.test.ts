import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const w = new Window();
for (const k of ["window", "document", "KeyboardEvent"] as const) (globalThis as Record<string, unknown>)[k] = (w as unknown as Record<string, unknown>)[k];
const { BINDINGS, clash, is, isCustom, rebind, resetKeys, restore, saved } = await import("../src/keys");
const { keydownFor, runMenu } = await import("../src/menubar");

const press = (combo: string) => keydownFor(combo);

describe("shortcut editor (Settings › Keyboard shortcuts)", () => {
  test("a combo another command has is refused, then taken with replace, leaving that one not assigned", () => {
    resetKeys();
    expect(rebind("add", "Meta+KeyK")).toBe("⌘K is used by Command palette");
    expect(clash("add", "Meta+KeyK")?.id).toBe("palette");
    expect(rebind("add", "Meta+KeyK", true)).toBeNull();
    expect(is(press("Meta+KeyK"), "add")).toBe(true);
    expect(is(press("Meta+KeyK"), "palette")).toBe(false);
    expect(isCustom("palette")).toBe(true);
  });

  test("the diagram editor's keys only clash with each other", () => {
    resetKeys();
    expect(clash("d-select", "Meta+KeyK")).toBeNull();
  });

  test("Review's own keys clash only with the keys that work in Review", () => {
    resetKeys();
    // Edit card's E works only on a card in Review, where Rename source's keys are off.
    expect(clash("rename", "KeyE")).toBeNull();
    expect(clash("edit-card", "KeyR")).toBeNull();
    // Inside Review they still meet each other, ⌘↵, the passage arrows' keys and the system-wide quick quiz.
    expect(clash("edit-card", "KeyB")?.id).toBe("bad-version");
    expect(clash("edit-card", "Meta+Enter")?.id).toBe("finish");
    expect(clash("finish", "KeyE")?.id).toBe("edit-card");
    expect(clash("ask", "Ctrl+Alt+KeyQ")?.id).toBe("quick-quiz");
  });

  test("any shortcut can be removed, and a menu click still runs it", () => {
    resetKeys();
    expect(rebind("palette", "")).toBeNull();
    let ran = false;
    const on = (e: Event) => (ran = is(e as KeyboardEvent, "palette"));
    document.body.addEventListener("keydown", on);
    runMenu("palette", { palette: "" } as Parameters<typeof runMenu>[1], 1e9);
    document.body.removeEventListener("keydown", on);
    expect(ran).toBe(true);
    // An unrelated keydown with no code never matches a removed shortcut.
    expect(is(press(""), "palette")).toBe(false);
  });

  test("undo puts back the keymap as it was", () => {
    resetKeys();
    rebind("add", "Meta+KeyY");
    const before = saved();
    resetKeys();
    expect(isCustom("add")).toBe(false);
    restore(before);
    expect(is(press("Meta+KeyY"), "add")).toBe(true);
    resetKeys();
  });

  test("reserved and modifier rules still hold", () => {
    expect(rebind("palette", "KeyK")).toBe("Needs ⌘, ⌃ or ⌥");
    expect(rebind("archive", "Escape")).toBe("Esc is reserved");
  });

  test("the Mac's own keys and the app's fixed ones are refused, so a global shortcut never takes paste or select-all from a field", () => {
    resetKeys();
    expect(rebind("palette", "Meta+KeyA")).toBe("⌘A is the Mac's Select All");
    expect(rebind("palette", "Meta+KeyV")).toBe("⌘V is the Mac's Paste");
    expect(rebind("add", "Shift+Meta+KeyZ")).toBe("⇧⌘Z is the Mac's Redo");
    expect(rebind("add", "Meta+KeyQ")).toBe("⌘Q is the Mac's Quit");
    expect(rebind("rename", "Meta+KeyG")).toBe("⌘G is Find's next match");
    expect(rebind("rename", "Shift+Meta+KeyN")).toBe("⇧⌘N is Toggle source note");
    expect(isCustom("palette") || isCustom("add") || isCustom("rename")).toBe(false);
    // Their own defaults stay theirs, and the diagram's ⌘G is its Group.
    expect(rebind("undo", "Meta+KeyZ")).toBeNull();
    expect(rebind("d-all", "Meta+KeyA")).toBeNull();
    expect(rebind("d-group", "Meta+KeyG")).toBeNull();
  });
});

describe("shortcut editor: Review's keys", () => {
  test("Undo and Redo work in Review too, so Review's own keys meet them", () => {
    resetKeys();
    expect(clash("undo", "KeyE")?.id).toBe("edit-card");
    expect(clash("edit-card", "Meta+KeyZ")?.id).toBe("undo");
  });

  test("Review's rating and confidence digits are taken for every key that works in Review", () => {
    resetKeys();
    expect(rebind("edit-card", "Digit1")).toBe("1 rates the exercise in Review");
    expect(rebind("ask", "Digit4")).toBe("4 rates the exercise in Review");
    expect(rebind("undo", "Digit2")).toBe("2 rates the exercise in Review");
    expect(isCustom("edit-card") || isCustom("ask") || isCustom("undo")).toBe(false);
    expect(rebind("edit-card", "Digit5")).toBeNull();
    resetKeys();
  });
});

describe("shortcut editor: the player's second keys (YouTube's K J L)", () => {
  test("K, J and L are second keys for play, back and forward, and L stays Listen", () => {
    resetKeys();
    expect(is(press("KeyK"), "play-alt")).toBe(true);
    expect(is(press("KeyJ"), "back-alt")).toBe(true);
    expect(is(press("KeyL"), "forward-alt")).toBe(true);
    expect(is(press("KeyL"), "listen")).toBe(true);
  });

  test("Listen works only on a source with no sound of its own, so it never meets the keys that need one", () => {
    resetKeys();
    expect(clash("forward-alt", "KeyL")).toBeNull();
    expect(clash("listen", "KeyL")).toBeNull();
    expect(clash("listen", "KeyJ")).toBeNull();
    expect(rebind("listen", "KeyK")).toBeNull();
    resetKeys();
  });

  test("they still meet every key that works on a playing source, and read-aloud's own keys meet Listen", () => {
    resetKeys();
    expect(clash("forward-alt", "KeyA")?.id).toBe("archive");
    expect(clash("back-alt", "KeyH")?.id).toBe("highlight");
    expect(clash("play-alt", "KeyL")?.id).toBe("forward-alt");
    expect(clash("forward", "KeyJ")?.id).toBe("back-alt");
    // Space and [ ] drive read-aloud on an article too, where L is Listen.
    expect(clash("listen", "Space")?.id).toBe("play");
    expect(clash("play", "KeyL")?.id).toBe("listen");
    expect(rebind("forward-alt", "ArrowLeft")).toBe("← is reserved");
    resetKeys();
  });
});

test("every shortcut has its own name, so the editor's messages say which one", () => {
  const names = BINDINGS.map((b) => b.label);
  expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  expect(BINDINGS.find((b) => b.id === "play-alt")!.label).toBe("Play / pause (second key)");
});

test("a key he saved on a command wins over a new default on the same key, which loads not assigned", async () => {
  (globalThis as Record<string, unknown>).localStorage = w.localStorage;
  // J was free when he gave it to Recall this chapter; K on Listen never meets the player's K.
  w.localStorage.setItem("ore.keys", JSON.stringify({ section: "KeyJ", listen: "KeyK" }));
  const fresh = (await import("../src/keys.ts?ownkey")) as typeof import("../src/keys");
  expect(fresh.is(press("KeyJ"), "section")).toBe(true);
  expect(fresh.is(press("KeyJ"), "back-alt")).toBe(false);
  expect(fresh.clash("back-alt", "KeyJ")?.id).toBe("section");
  expect(fresh.is(press("KeyK"), "listen")).toBe(true);
  expect(fresh.is(press("KeyK"), "play-alt")).toBe(true);
  expect(fresh.isCustom("back-alt")).toBe(true);
  delete (globalThis as Record<string, unknown>).localStorage;
});

test("a saved shortcut the rules now refuse is dropped when the keymap loads", async () => {
  (globalThis as Record<string, unknown>).localStorage = w.localStorage;
  w.localStorage.setItem("ore.keys", JSON.stringify({ palette: "Meta+KeyA", "edit-card": "Digit1", add: "Meta+KeyY", gone: "Meta+KeyU" }));
  const fresh = (await import("../src/keys.ts?stored")) as typeof import("../src/keys");
  expect(fresh.is(press("Meta+KeyA"), "palette")).toBe(false);
  expect(fresh.is(press("Meta+KeyK"), "palette")).toBe(true);
  expect(fresh.is(press("KeyE"), "edit-card")).toBe(true);
  expect(fresh.is(press("Meta+KeyY"), "add")).toBe(true);
  expect(Object.keys(fresh.saved())).toEqual(["add"]);
  delete (globalThis as Record<string, unknown>).localStorage;
});
