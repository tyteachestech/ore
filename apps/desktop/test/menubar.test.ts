import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const w = new Window();
for (const k of ["window", "document", "KeyboardEvent"] as const) (globalThis as Record<string, unknown>)[k] = (w as unknown as Record<string, unknown>)[k];
const { BINDINGS, comboOf } = await import("../src/keys");
const { keydownFor, menuSpec, runMenu } = await import("../src/menubar");

const keymap = Object.fromEntries(BINDINGS.map((b) => [b.id, b.combo])) as Parameters<typeof menuSpec>[0];
type Row = { id?: string; label?: string; accel?: string | null; enabled?: boolean; predef?: string };
const rows = (where = { reader: false, review: false }) => menuSpec(keymap, where).flatMap((m) => m.items as Row[]);
const row = (id: string, where?: { reader: boolean; review: boolean }) => rows(where).find((r) => r.id === `ore:${id}`)!;

describe("menu bar", () => {
  test("shows ⌘ ⌃ ⌥ shortcuts from the keymap, never a plain key or a system-wide one", () => {
    expect(row("palette").accel).toBe("Super+KeyK");
    expect(row("sidebar").accel).toBe("Shift+Super+KeyS");
    expect(row("archive").accel).toBeNull(); // "A" would fire while he types
    expect(row("quick-quiz").accel).toBeNull(); // macOS already runs it
    const rebound = { ...keymap, palette: "Shift+Meta+KeyP" };
    expect((menuSpec(rebound, { reader: false, review: false }).flatMap((m) => m.items as Row[]).find((r) => r.id === "ore:palette")!).accel).toBe("Shift+Super+KeyP");
  });

  test("Source items work only in the reader, Review's card items only in Review", () => {
    expect(row("rename").enabled).toBe(false);
    expect(row("rename", { reader: true, review: false }).enabled).toBe(true);
    expect(row("retire-card").enabled).toBe(false);
    expect(row("retire-card", { reader: false, review: true }).enabled).toBe(true);
    expect(row("review").enabled).toBe(true);
  });

  test("every item names a real binding once", () => {
    const ids = rows().flatMap((r) => (r.id ? [r.id.slice(4)] : []));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(BINDINGS.some((b) => b.id === id)).toBe(true);
  });

  test("a menu click replays the shortcut as the keydown the handlers match", () => {
    for (const b of BINDINGS) expect(comboOf(keydownFor(b.combo) as unknown as KeyboardEvent)).toBe(b.combo);
  });

  test("one key press that reaches both the page and the menu runs once", () => {
    let runs = 0;
    const on = (e: KeyboardEvent) => comboOf(e) === keymap.sidebar && runs++;
    window.addEventListener("keydown", on as unknown as EventListener);
    runMenu("sidebar", keymap, 1000);
    expect(runs).toBe(1);
    runMenu("sidebar", keymap, 2000); // a second click later runs again
    expect(runs).toBe(2);
    window.removeEventListener("keydown", on as unknown as EventListener);
  });

  test("Edit ▸ Undo walks the app history, but a text field undoes its own typing", () => {
    expect(row("undo").accel).toBe("Super+KeyZ");
    expect(rows().some((r) => r.predef === "undo" || r.predef === "redo")).toBe(false);
    let keys = 0;
    const on = (e: KeyboardEvent) => comboOf(e) === keymap.undo && keys++;
    window.addEventListener("keydown", on as unknown as EventListener);
    const native: string[] = [];
    (document as unknown as { execCommand: (c: string) => boolean }).execCommand = (c) => (native.push(c), true);
    runMenu("undo", keymap, 5000);
    expect([keys, native.length]).toEqual([1, 0]);
    const field = document.createElement("textarea");
    document.body.appendChild(field);
    field.focus();
    runMenu("undo", keymap, 6000);
    runMenu("redo", keymap, 7000);
    expect([keys, native]).toEqual([1, ["undo", "redo"]]);
    field.setAttribute("data-app-undo", ""); // Review's empty answer: nothing of its own to undo
    runMenu("undo", keymap, 8000);
    expect(keys).toBe(2);
    field.remove();
    window.removeEventListener("keydown", on as unknown as EventListener);
  });
});
