import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// The UI sprites (icons.tsx, PixelIcon.tsx) as their rows, read from the source like a lint.
const sprites = new Map(
  ["../src/icons.tsx", "../src/PixelIcon.tsx"].flatMap((f) =>
    [...readFileSync(new URL(f, import.meta.url), "utf8").matchAll(/export const (\w+) = sprite\(\[([\s\S]*?)\]\)/g)].map(
      (m) => [m[1]!, [...m[2]!.matchAll(/"([.#]{16})"/g)].map((r) => r[1]!)] as const,
    ),
  ),
);
const box = (rows: string[]) => {
  const xs = rows.flatMap((r) => [...r].flatMap((c, x) => (c === "#" ? [x] : [])));
  const ys = rows.flatMap((r, y) => (r.includes("#") ? [y] : []));
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

test("every sprite is 16 rows of 16", () => {
  expect(sprites.size).toBeGreaterThan(80);
  for (const [name, rows] of sprites) expect(rows.length ? `${name} ${rows.length}` : name).toBe(`${name} 16`);
});

// 2026-11-09 icon pass: a sprite off the centre by a whole pixel sits visibly high or to one side next to its label
// (the note and graduation cap sat a row high, the hand and thumb a column left). An open lock leans on purpose.
test("sprites sit centred on the grid", () => {
  for (const [name, rows] of sprites) {
    if (name === "LockSimpleOpen") continue;
    const b = box(rows);
    expect(Math.abs((b.x0 + b.x1) / 2 - 7.5) > 0.5 || Math.abs((b.y0 + b.y1) / 2 - 7.5) > 0.5 ? name : "centred").toBe("centred");
  }
});

// A single dot out of place on a symmetric subject reads as a flaw at 20px (the gear had one, the keyboard's keys
// were uneven). These mirror left to right about their own box.
test("symmetric sprites mirror left to right", () => {
  for (const name of ["Archive", "Circle", "GearSix", "Globe", "Headphones", "House", "Keyboard", "LockSimple", "Plus", "Square", "Table", "Target", "Trash", "X", "PixelStar"]) {
    const rows = sprites.get(name)!;
    const { x0, x1 } = box(rows);
    for (const r of rows) for (let x = x0; x <= x1; x++) expect(r[x] === r[x0 + x1 - x] ? "mirrored" : `${name}: ${r}`).toBe("mirrored");
  }
});
