import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

// Esc out of a menu or popover gives focus back to what opened it (Radix's default, the Mac's menus, ChatGPT's
// and Claude's chat lists); only a pick may send it on, to where the pick takes him. An onCloseAutoFocus that
// cancels that on every close leaves focus on nothing after Esc, so each one is listed here, by file and the
// content's class, with where focus goes instead.
const KEEPS_FOCUS: Record<string, string> = {
  "Peek.tsx popover peek": "a hover preview that never takes focus (onOpenAutoFocus is cancelled too), so there is nothing to give back",
  "draw/Editor.tsx popover draw-colour": "closing it gives focus to the diagram itself (onDone, tintDone), where its keys work, not to the swatch",
  "editor/NoteEditor.tsx popover sel-pop math-field": "an equation's field anchored to the equation, with no trigger; closing it puts the caret back in the note",
};

function cancelled(): string[] {
  const root = join(import.meta.dir, "../src");
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : []));
  const found: string[] = [];
  for (const f of files(root)) {
    const s = readFileSync(f, "utf8");
    // A handler whose first move is preventDefault: `(e) => e.preventDefault()` or `(e) => (e.preventDefault(), …)`.
    for (const m of s.matchAll(/onCloseAutoFocus=\{\(e\)\s*=>\s*\(?\s*e\.preventDefault\(\)/g)) {
      const cls = [...s.slice(0, m.index).matchAll(/className="([^"]*)"/g)].at(-1)?.[1];
      found.push(`${relative(root, f)} ${cls}`);
    }
  }
  return found;
}

describe("focus after a menu closes", () => {
  const found = cancelled();
  test("Esc gives focus back to the menu's trigger, unless the layer is listed with the reason", () => {
    expect(found.filter((x) => !(x in KEEPS_FOCUS))).toEqual([]);
  });
  test("the list holds only layers that still cancel it", () => {
    expect(Object.keys(KEEPS_FOCUS).filter((x) => !found.includes(x))).toEqual([]);
  });
});
