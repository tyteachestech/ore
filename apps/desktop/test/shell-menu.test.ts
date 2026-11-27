import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

// Native AppKit focus cannot run in Bun. Keep the native delivery contract here and exercise
// the receiving page below; an actual menu click still needs a Mac shell check.
test("native menu commands reach the focused webview without raising main first", () => {
  const rust = source("../src-tauri/src/main.rs");
  const route = rust.slice(rust.indexOf(".on_menu_event(|app, e|"), rust.indexOf("// Images in notes"));
  expect(route).toContain("is_focused()");
  expect(route).toContain('app.emit_to(w.label(), "menu", id)');
  expect(route).not.toContain('.emit("menu",');
  expect(route).not.toContain('app.emit_to("main", "menu", id)');
  const setter = rust.slice(rust.indexOf("fn set_app_menu("), rust.indexOf("/// Red underlines"));
  // The focused window's menu stands; with none focused (Ore opened behind another app), the main window's.
  expect(setter).toContain("find(|w| w.is_focused()");
  expect(setter).toContain('None => window.label() == "main"');
});

test("both webviews install the shared menu lifecycle, including focus refresh", () => {
  expect(source("../src/App.tsx")).toContain("useMenu(");
  expect(source("../src/QuickQuiz.tsx")).toContain("useMenu(");
  const menu = source("../src/menubar.ts");
  expect(menu).toContain("onFocusChanged");
});

test("quiz menu Undo stays in its history and app navigation is handed to main", async () => {
  const before = { window: globalThis.window, document: globalThis.document, KeyboardEvent: globalThis.KeyboardEvent };
  const w = new Window();
  Object.assign(globalThis, { window: w, document: w.document, KeyboardEvent: w.KeyboardEvent });
  (w as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
  const callbacks = new Map<number, (event: { payload: string }) => void>();
  const calls: { cmd: string; args: any }[] = [];
  let sequence = 0;
  (w as any).__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "quiz" }, currentWebview: { label: "quiz", windowLabel: "quiz" } },
    transformCallback(fn: (event: { payload: string }) => void) { callbacks.set(++sequence, fn); return sequence; },
    async invoke(cmd: string, args: any) { calls.push({ cmd, args }); return args?.handler; },
  };
  const { listenMenu, menuSpec } = await import("../src/menubar");
  const { BINDINGS, is } = await import("../src/keys");
  const { History } = await import("../src/history");
  const keys = Object.fromEntries(BINDINGS.map((b) => [b.id, b.combo])) as Parameters<typeof menuSpec>[0];
  const disk = { mainArchived: true, quizRated: true };
  const main = new History();
  main.push({ message: "Archived", undo: async () => { disk.mainArchived = false; } });
  const quiz = new History();
  quiz.push({ message: "Rated", undo: async () => { disk.quizRated = false; } });

  window.addEventListener("keydown", (event) => { if (is(event as unknown as KeyboardEvent, "undo")) void quiz.undo(); });
  const unlisten = await listenMenu(() => keys, true);
  try {
    const listener = calls.find((c) => c.cmd === "plugin:event|listen" && c.args.event === "menu")!;
    // Its own clicks only: the plain `listen` (target "Any") heard the main window's too, and handed each back (F767).
    expect(listener.args.target).toEqual({ kind: "Window", label: "quiz" });
    callbacks.get(listener.args.handler)!({ payload: "ore:undo" });
    await Promise.resolve();
    expect(disk).toEqual({ mainArchived: true, quizRated: false });
    const later = menuSpec(keys, { reader: false, review: true }).flatMap((m) => m.items).find((i) => "id" in i && i.id === "ore:later");
    expect(later).toMatchObject({ enabled: true });
    callbacks.get(listener.args.handler)!({ payload: "ore:settings" });
    expect(calls).toContainEqual({ cmd: "menu_main", args: { id: "ore:settings" } });
  } finally { unlisten(); await w.happyDOM.abort(); Object.assign(globalThis, before); }
});
