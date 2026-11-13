import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { DOT, dots } from "../src/dots";

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

// A single dot out of place on a symmetric subject reads as a flaw at 20px (the gear had one, the keyboard's keys
// were uneven). These mirror left to right about their own box.
test("symmetric sprites mirror left to right", () => {
  for (const name of ["Archive", "Circle", "GearSix", "Globe", "Headphones", "House", "Keyboard", "LockSimple", "Pin", "Plus", "Scissors", "Square", "Table", "Target", "Trash", "User", "X", "PixelGem"]) {
    const rows = sprites.get(name)!;
    const { x0, x1 } = box(rows);
    for (const r of rows) for (let x = x0; x <= x1; x++) expect(r[x] === r[x0 + x1 - x] ? "mirrored" : `${name}: ${r}`).toBe("mirrored");
  }
});

// D171: a drawing that leaves more room on one side sat off its label's line (Tyler: "the AI and terminal sit off").
// dots() centres every sprite by its ink, in whole cells so each dot keeps the same place in the pixel grid.
test("dots centre a sprite by its ink, in whole cells", () => {
  const corner = ["##" + ".".repeat(14), "#." + ".".repeat(14), ...Array(14).fill(".".repeat(16))];
  const centres = [...dots(corner).matchAll(/M([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]) - 0.5, Number(m[2]) + DOT - 0.5]);
  expect(centres).toEqual([[7, 7], [8, 7], [7, 8]]);
  for (const [name, rows] of sprites) {
    const xs = [...dots(rows).matchAll(/M([\d.]+) ([\d.]+)/g)].map((m) => Number(m[1]) - 0.5);
    const ys = [...dots(rows).matchAll(/M([\d.]+) ([\d.]+)/g)].map((m) => Number(m[2]) + DOT - 0.5);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    expect(Math.abs(cx - 7.5) <= 0.5 && Math.abs(cy - 7.5) <= 0.5 && xs.every(Number.isInteger) ? "centred" : name).toBe("centred");
  }
});
