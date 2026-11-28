import { expect, test } from "bun:test";
import { Window } from "happy-dom";

const w = new Window();
for (const k of ["window", "document", "KeyboardEvent"] as const) (globalThis as Record<string, unknown>)[k] = (w as unknown as Record<string, unknown>)[k];
const { listenMenu } = await import("../src/menubar");

// Tauri's plain `listen` hears an event sent to any window; a window's own `listen` hears only its own.
test("a window hears only its own menu clicks, so the hidden quick quiz never sends the main window's back to it", async () => {
  const heard: string[] = [];
  const mine = { listen: async (name: string) => (heard.push(name), () => {}) };
  await listenMenu(() => ({}) as never, false, mine as never);
  expect(heard).toEqual(["menu"]);
});
