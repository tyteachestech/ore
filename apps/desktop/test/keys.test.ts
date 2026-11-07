import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const w = new Window();
for (const k of ["window", "document", "KeyboardEvent"] as const) (globalThis as Record<string, unknown>)[k] = (w as unknown as Record<string, unknown>)[k];
const { clash, is, isCustom, rebind, resetKeys, restore, saved } = await import("../src/keys");
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
});
