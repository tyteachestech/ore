import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// Esc out of a menu or popover gives focus back to what opened it (Radix's default, the Mac's menus, ChatGPT's
// and Claude's chat lists); only a pick may send it on, to where the pick takes him. Every onCloseAutoFocus in
// the app changes that, so each one is listed here with where focus goes instead, and a new one fails until it
// is: by file and the layer it is on (its component and class), or else the function that builds it.
const HANDLERS: Record<string, string> = {
  "Tutor.tsx Popover.Content popover menu tutor-chats": "a picked chat puts focus in the field; Esc leaves Radix's default, back to the chat's title",
  "Menu.tsx ContextMenu.Content popover menu-list": "`closed`: Radix's default, back to the row he right-clicked, unless keepFocus (the picked action moves focus itself); after a pick, `keepFocusNear` keeps it on the row, or on its neighbour once the row is gone",
  "Menu.tsx DropdownMenu.Content popover menu-list": "`closed`, as the right-click menu (`keepFocusNear` after a pick); a hover-only ⋯ (which can't hold focus) gives it to its row (`focusRow`)",
  "Skills.tsx Popover.Content popover menu skill-picker": "to `returnFocus` when the caller passes one (the field it was opened from), else Radix's default, its trigger",
  "Peek.tsx Popover.Content popover peek": "nowhere new: a hover preview that never takes focus (onOpenAutoFocus is cancelled too), so there is nothing to give back",
  "draw/Editor.tsx Popover.Content popover draw-colour": "to the diagram itself (onDone, tintDone), where its keys work, not to the swatch",
  "editor/SelectionBar.tsx useToNote": "Esc puts it back in the note, on the words (Notion); a pick puts it there itself; a press outside leaves it where it landed",
  "editor/NoteEditor.tsx Popover.Content popover sel-pop math-field": "an equation's field anchored to the equation, with no trigger; closing it puts the caret back in the note",
};

/** The source with comments blanked, offsets kept. */
const uncommented = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|(?<![:"'`])\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));

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

function handlers(): string[] {
  const root = join(import.meta.dir, "../src");
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
  const found: string[] = [];
  for (const f of files(root)) {
    const s = uncommented(readFileSync(f, "utf8"));
    for (const m of s.matchAll(/\bonCloseAutoFocus\b/g)) {
      const before = s.slice(0, m.index);
      // On a layer's tag: the last tag opened before it, still open where it is.
      const tag = [...before.matchAll(/<([A-Z][\w.]*)\b/g)].at(-1);
      const open = tag && tagEnd(s, tag.index) > m.index ? s.slice(tag.index, tagEnd(s, tag.index)) : null;
      const where = open ? `${tag![1]} ${/className="([^"]*)"/.exec(open)?.[1]}` : [...before.matchAll(/function (\w+)/g)].at(-1)?.[1];
      found.push(`${relative(root, f)} ${where}`);
    }
  }
  return found;
}

describe("focus after a menu closes", () => {
  const found = handlers();
  test("every onCloseAutoFocus is listed with where focus goes", () => {
    expect(found.filter((x) => !(x in HANDLERS))).toEqual([]);
  });
  test("the list holds only handlers still in the app, each once", () => {
    expect(Object.keys(HANDLERS).filter((x) => !found.includes(x))).toEqual([]);
    expect(found.filter((x, i) => found.indexOf(x) !== i)).toEqual([]);
  });
});
