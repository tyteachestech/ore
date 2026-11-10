import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { BINDINGS } from "../src/keys";

// The shortcut-hint rule (AGENTS.md, UI quality bar): a control whose action has a binding shows
// that binding, through <Hint keys=…> or an inline label(keys.<id>). A binding with no on-screen
// control is listed here with the reason; add a control's hint instead whenever one exists.
const NO_CONTROL: Record<string, string> = {
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
  "note-last-color": "puts the colour last picked in the format bar's colour menu on the selection again; nothing on screen to press",
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

// Every icon-only button (an aria-label and no words of its own, only an icon or nothing) says what it does
// on hover through <Hint> (ChatGPT's and Claude's Send, Linear's toolbar): an icon alone is a guess. One
// that can't is listed here, by file and aria-label, with the reason.
const ICON_ONLY_OK: Record<string, string> = {
  "Palette.tsx Close": "phone only (PHONE): a touch screen has no hover",
  "Reader.tsx Find in source": "phone only (PHONE): a touch screen has no hover",
  "phone/PhoneApp.tsx Open menu": "the phone app: a touch screen has no hover",
  "phone/PhoneApp.tsx Search": "the phone app: a touch screen has no hover",
  "phone/PhoneApp.tsx Close menu": "the phone app: a touch screen has no hover",
  "Menu.tsx label": "the phone's action sheet trigger (ActionSheet, PHONE): a touch screen has no hover",
  "editor/KeyboardBar.tsx Hide the keyboard": "the phone's keyboard bar (PHONE): a touch screen has no hover",
  "Video.tsx player.playing ? \"Pause\" : \"Play\"": "the video itself, clicked to play or pause as on YouTube; a hint would sit over the picture",
  "IconPicker.tsx label(icon)": "one of hundreds of cells in the icon grid; the filter field names them, and a tooltip each would cost the grid its speed",
};

/** Index of the `>` that ends the tag opening at `i`, past braces and strings inside it. */
function tagEnd(s: string, i: number): number {
  let depth = 0, quote = "";
  for (; i < s.length; i++) {
    const c = s[i]!;
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "`" || (c === "'" && depth > 0)) quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return i;
  }
  return -1;
}

const inHint = (s: string, at: number) => (s.slice(0, at).match(/<Hint\b/g)?.length ?? 0) > (s.slice(0, at).match(/<\/Hint>/g)?.length ?? 0);

function iconOnly(): string[] {
  const root = join(import.meta.dir, "../src");
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : []));
  const found: string[] = [];
  for (const f of files(root)) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(/<button\b/g)) {
      const end = tagEnd(s, m.index);
      const open = s.slice(m.index, end + 1);
      const label = /aria-label=(?:\{`([^`]*)`\}|"([^"]*)"|\{([^}]*)\})/.exec(open);
      if (!label) continue;
      const inner = open.endsWith("/>") ? "" : s.slice(end + 1, s.indexOf("</button>", end));
      const words = inner
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "") // comments
        .replace(/<[A-Z][\w.]*\b[^<>]*\/>/g, "") // icons
        .replace(/\{[^{}<"'`]*(\?|&&|\|\|)[^{}<"'`]*\}/g, "") // what is left of {on ? <A/> : <B/>}
        .trim()
        .replace(/^[^\p{L}\p{N}{}<>]{1,2}$/u, ""); // a glyph drawn as text, as × or ↗
      if (words) continue;
      // Built once (`const button = (…)`) and wrapped in a Hint where it is used.
      const built = /const (\w+) = \(\s*$/.exec(s.slice(0, m.index))?.[1];
      const used = built ? [...s.matchAll(new RegExp(`\\{${built}\\}`, "g"))].some((u) => inHint(s, u.index)) : false;
      if (inHint(s, m.index) || used) continue;
      found.push(`${relative(root, f)} ${label[1] ?? label[2] ?? label[3]}`);
    }
  }
  return found;
}

describe("icon-only buttons", () => {
  const found = iconOnly();
  test("every one shows a hint on hover, or is listed with the reason it can't", () => {
    expect(found.filter((b) => !(b in ICON_ONLY_OK))).toEqual([]);
  });
  test("the list holds only icon-only buttons with no hint", () => {
    expect(Object.keys(ICON_ONLY_OK).filter((b) => !found.includes(b))).toEqual([]);
  });
});
