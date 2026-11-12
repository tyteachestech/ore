import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// A field or popover that stops every key press also stops ⌘Z on its way to the app history: adding two
// skills in the skill picker and pressing ⌘Z did nothing (2026-11-12). Such handlers use keepKeysIn.
// The diagram editor (its sheet too) and the shortcut recorder own every key on purpose.
const OWN_KEYS = ["draw/", "Diagram.tsx", "Shortcuts.tsx"];
const src = join(import.meta.dir, "../src");
const files = (readdirSync(src, { recursive: true }) as string[]).filter((f) => f.endsWith(".tsx") && !OWN_KEYS.some((o) => f.startsWith(o)));

describe("key presses kept in a field or popover", () => {
  test("never stop ⌘Z: a keydown handler that stops every key uses keepKeysIn", () => {
    const blanket = /onKeyDown=\{\(e\) => \{\s*e\.stopPropagation\(\);|onKeyDown=\{\(e\) => e\.stopPropagation\(\)\}|onKeyDown=\{stop\}|\(e: (?:React)?KeyboardEvent(?:<\w+>)?\) => \{\s*e\.stopPropagation\(\);/g;
    const hits = files.flatMap((f) => [...readFileSync(join(src, f), "utf8").matchAll(blanket)].map(() => f));
    expect(hits).toEqual([]);
  });
});
