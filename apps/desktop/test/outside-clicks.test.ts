import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// A popover learns of a press outside from the document, so a press stopped on its way there leaves the
// popover open, and one stopped inside it makes the next click outside count as inside (the skill picker
// that wouldn't close, in WebKit where a click moves no focus). A control on a dragging row says
// `data-no-drag` instead (RowSensor in src/drag.ts).
const SRC = join(import.meta.dir, "../src");
const stopsPress = /onPointerDown=\{(stop|\(e\) => e\.stopPropagation\(\))\}|onPointerDown=\{[^}]*stopPropagation|addEventListener\("pointerdown"(?:(?!addEventListener)[\s\S]){0,300}?stopPropagation/;

describe("a press outside reaches the document", () => {
  const files = readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter((f) => /\.tsx?$/.test(f));
  test.each(files)("%s", (f) => {
    expect(readFileSync(join(SRC, f), "utf8").match(stopsPress)?.[0]).toBeUndefined();
  });
});
