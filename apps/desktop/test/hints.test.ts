import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BINDINGS } from "../src/keys";

// The shortcut-hint rule (AGENTS.md, UI quality bar): a control whose action has a binding shows
// that binding, through <Hint keys=…> or an inline label(keys.<id>). A binding with no on-screen
// control is listed here with the reason; add a control's hint instead whenever one exists.
const NO_CONTROL: Record<string, string> = {
  palette: "opens the palette, which shows every other action's binding",
  "go-toread": "label(keys[v.key]) in the sources view menu (ViewMenu, TABS)",
  "go-done": "label(keys[v.key]) in the sources view menu (ViewMenu, TABS)",
  questions: "opens the Collected tab with the open passage as his answer's quote; the tab itself shows C (collected)",
  keep: "Hint keys={i} on the highlight popup's intent buttons",
  question: "Hint keys={i} on the highlight popup's intent buttons",
  apply: "Hint keys={i} on the highlight popup's intent buttons",
  "mark-read": "label(keys[\"mark-read\"]) on the Feed row menu's Mark read / unread item",
  note: "no control; Tab moves into the popup's note field",
  "block-up": "label(keymap[\"block-up\"]) beside Move up in the note's ⋮⋮ block menu (editor/BlockHandle.tsx)",
  "block-down": "label(keymap[\"block-down\"]) beside Move down in the note's ⋮⋮ block menu (editor/BlockHandle.tsx)",
  "block-duplicate": "label(keymap[\"block-duplicate\"]) beside Duplicate in the note's ⋮⋮ block menu (editor/BlockHandle.tsx)",
  "quick-quiz": "system-wide (D76): registered with macOS, works in any app; shown and set in Settings › Review › Quick quiz",
};

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [readFileSync(join(dir, e.name), "utf8")] : [],
  );
}

const code = sources(join(import.meta.dir, "../src")).join("\n");
const shown = new Set<string>();
for (const m of code.matchAll(/keys=(?:"([\w-]+)"|\{\[([^\]]*)\]\})/g)) {
  if (m[1]) shown.add(m[1]);
  for (const id of m[2]?.match(/[\w-]+/g) ?? []) shown.add(id);
}
for (const m of code.matchAll(/label\(keys\.([\w]+)\)/g)) shown.add(m[1]!);
// The diagram editor's tools and commands carry their binding as `key: "d-…"`: the toolbar hints it, and
// the / command list and the right-click menu show it beside each command (draw/Editor.tsx).
for (const m of sources(join(import.meta.dir, "../src/draw")).join("\n").matchAll(/\bkey: "(d-[\w-]+)"/g)) shown.add(m[1]!);

describe("shortcut hints", () => {
  test("every binding is shown on its control, or listed as having none", () => {
    const missing = BINDINGS.filter((b) => !shown.has(b.id) && !(b.id in NO_CONTROL)).map((b) => b.id);
    expect(missing).toEqual([]);
  });

  test("the no-control list holds only real, unhinted bindings", () => {
    const ids = new Set<string>(BINDINGS.map((b) => b.id));
    expect(Object.keys(NO_CONTROL).filter((id) => !ids.has(id) || shown.has(id))).toEqual([]);
  });
});
