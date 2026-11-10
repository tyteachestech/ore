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
/** The source with comments blanked, offsets kept: a `<Hint` in a comment must not count as one. */
const uncommented = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|(?<![:"'`])\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));

/** One file's icon-only buttons with no hint, and whether its <Hint>s balance (one in a string would not). */
function scan(name: string, raw: string): { found: string[]; balanced: boolean } {
  const s = uncommented(raw);
  const found: string[] = [];
  for (const m of s.matchAll(/<button\b/g)) {
    const end = tagEnd(s, m.index);
    const open = s.slice(m.index, end + 1);
    const label = /aria-label=(?:\{`([^`]*)`\}|"([^"]*)"|\{([^}]*)\})/.exec(open);
    if (!label) continue;
    const inner = open.endsWith("/>") ? "" : s.slice(end + 1, s.indexOf("</button>", end));
    const words = inner
      .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}|\{\s+\}/g, "") // comments
      .replace(/<[A-Z][\w.]*\b[^<>]*\/>/g, "") // icons
      .replace(/\{[^{}<"'`]*(\?|&&|\|\|)[^{}<"'`]*\}/g, "") // what is left of {on ? <A/> : <B/>}
      .trim()
      .replace(/^[^\p{L}\p{N}{}<>]{1,2}$/u, ""); // a glyph drawn as text, as × or ↗
    if (words) continue;
    // Built once (`const button = (…)`) and wrapped in a Hint where it is used.
    const built = /const (\w+) = \(\s*$/.exec(s.slice(0, m.index))?.[1];
    const used = built ? [...s.matchAll(new RegExp(`\\{${built}\\}`, "g"))].some((u) => inHint(s, u.index)) : false;
    if (inHint(s, m.index) || used) continue;
    found.push(`${name} ${label[1] ?? label[2] ?? label[3]}`);
  }
  return { found, balanced: (s.match(/<Hint\b/g)?.length ?? 0) === (s.match(/<\/Hint>/g)?.length ?? 0) };
}

function iconOnly(): { found: string[]; unbalanced: string[] } {
  const root = join(import.meta.dir, "../src");
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : []));
  const found: string[] = [], unbalanced: string[] = [];
  for (const f of files(root)) {
    const r = scan(relative(root, f), readFileSync(f, "utf8"));
    found.push(...r.found);
    if (!r.balanced) unbalanced.push(relative(root, f));
  }
  return { found, unbalanced };
}

describe("icon-only buttons", () => {
  const { found, unbalanced } = iconOnly();
  test("every one shows a hint on hover, or is listed with the reason it can't", () => {
    expect(found.filter((b) => !(b in ICON_ONLY_OK))).toEqual([]);
  });
  test("the list holds only icon-only buttons with no hint", () => {
    expect(Object.keys(ICON_ONLY_OK).filter((b) => !found.includes(b))).toEqual([]);
  });
  // The scan counts <Hint> and </Hint> before a button, so a stray one (in a string) would exempt the rest.
  test("every file's hints balance, so the count can be trusted", () => {
    expect(unbalanced).toEqual([]);
  });
  test("a <Hint in a comment doesn't hint the buttons after it", () => {
    const src = `// wrap it in <Hint text="…"> later\n/* or <Hint> */\nconst a = <button aria-label="Close"><X /></button>;`;
    expect(scan("x.tsx", src)).toEqual({ found: ["x.tsx Close"], balanced: true });
  });
});

// A button labelled only Cancel, Close, Done or Back is one Esc usually runs too (a Mac sheet's Cancel, Linear's
// dialogs), so it shows Esc: a <kbd>Esc</kbd> in its label, or a <Hint> around it whose text shows it. The scan
// can't see what Esc runs, so one whose action Esc doesn't run, or whose own key is shown instead, is listed
// here, by file and label, with the reason.
const DISMISS_OK: Record<string, string> = {
  "Review.tsx Done": "the end screen's default button: its hint shows ↵, its key, as a Mac sheet's default button shows Return",
  "Finish.tsx Done": "its hint shows its key, finish (⌘↵); Esc leaves the panel, which runs Keep reading unless the source is already done",
  "Tables.tsx Cancel": "stops the 2 GB reader download (in a PDF and in Settings); Esc doesn't, so a stray Esc never throws the download away",
  "Toast.tsx Cancel": "stops a long job from its progress toast; Esc doesn't reach a toast, so a stray Esc never stops one",
};

/** The <Hint …> tag open around offset `at`, or "" when none is. */
function hintAround(s: string, at: number): string {
  const open: number[] = [];
  for (const m of s.slice(0, at).matchAll(/<Hint\b|<\/Hint>/g)) m[0] === "</Hint>" ? open.pop() : open.push(m.index);
  const i = open.at(-1);
  return i === undefined ? "" : s.slice(i, tagEnd(s, i) + 1);
}

/** One file's dismiss buttons that don't show Esc. */
function dismissScan(name: string, raw: string): string[] {
  const s = uncommented(raw);
  const found: string[] = [];
  for (const m of s.matchAll(/<button\b/g)) {
    const end = tagEnd(s, m.index);
    if (s[end - 1] === "/") continue;
    const inner = s.slice(end + 1, s.indexOf("</button>", end));
    const word = inner.replace(/<kbd>[^<]*<\/kbd>|<[^<>]*>|\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "").trim();
    if (!/^(Cancel|Close|Done|Back)$/.test(word)) continue;
    if (/<kbd>Esc<\/kbd>/.test(inner) || /\bEsc\b/.test(hintAround(s, m.index))) continue;
    found.push(`${name} ${word}`);
  }
  return found;
}

describe("dismiss buttons", () => {
  const root = join(import.meta.dir, "../src");
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : []));
  const found = files(root).flatMap((f) => dismissScan(relative(root, f), readFileSync(f, "utf8")));
  test("a Cancel, Close, Done or Back that Esc runs shows Esc, or is listed with the reason it doesn't", () => {
    expect(found.filter((b) => !(b in DISMISS_OK))).toEqual([]);
  });
  test("the list holds only dismiss buttons that don't show Esc", () => {
    expect(Object.keys(DISMISS_OK).filter((b) => !found.includes(b))).toEqual([]);
  });
  test("Esc in the label or in the hint around it counts; Esc anywhere else doesn't", () => {
    const src = `<Hint text="Save" keys="finish"><button>Save</button></Hint>
<button>Cancel <kbd>Esc</kbd></button>
<Hint text={<>Close <kbd>Esc</kbd></>}><button>Close</button></Hint>
<Hint text="Esc closes it"></Hint><button>Done</button>
<button aria-label="Close"><X /></button>`;
    expect(dismissScan("x.tsx", src)).toEqual(["x.tsx Done"]);
  });
});
