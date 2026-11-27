import { expect, mock, test } from "bun:test";
import { Window } from "happy-dom";

const w = new Window();
for (const k of ["window", "document", "KeyboardEvent"] as const) (globalThis as Record<string, unknown>)[k] = (w as unknown as Record<string, unknown>)[k];

// Tauri's plain `listen` hears an event sent to any window; a window's own `listen` hears only its own.
const heard: string[] = [];
mock.module("@tauri-apps/api/event", () => ({ listen: async (name: string) => (heard.push(`every window: ${name}`), () => {}) }));
mock.module("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ listen: async (name: string) => (heard.push(`this window: ${name}`), () => {}), onFocusChanged: async () => () => {} }) }));
mock.module("@tauri-apps/api/core", () => ({ invoke: async () => {} }));
const { listenMenu } = await import("../src/menubar");

test("a window hears only its own menu clicks, so the hidden quick quiz never sends the main window's back to it", async () => {
  await listenMenu(() => ({}) as never);
  expect(heard).toEqual(["this window: menu"]);
});
