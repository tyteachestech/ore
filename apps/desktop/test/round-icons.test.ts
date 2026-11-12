import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// A round pixel icon with long flat sides reads as a circle cut off at the left and right (Tyler, 2026-11-07, the ?).
// Every round sprite draws the same circle as Circle, so they all read round and match each other.
const sprites = (file: string) =>
  new Map(
    [...readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8").matchAll(/export const (\w+) = sprite\(\[([\s\S]*?)\]\);/g)].map((m) => [
      m[1]!,
      [...m[2]!.matchAll(/"([.#]{16})"/g)].map((r) => r[1]!),
    ]),
  );
const ui = sprites("icons.tsx");
const highlight = sprites("PixelIcon.tsx");
/** Each row's leftmost and rightmost pixel: the silhouette, holes and all inner detail aside. */
const edge = (rows: string[]) => rows.map((r) => (r.includes("#") ? [r.indexOf("#"), r.lastIndexOf("#")] : null));

test.each([
  ["icons.tsx", ["Question", "Minus", "PlayCircle", "CircleHalf", "Compass", "Target", "Globe"]],
  ["PixelIcon.tsx", ["PixelQuestion"]],
] as const)("round icons in %s share Circle's outline", (file, names) => {
  const circle = edge(ui.get("Circle")!);
  for (const n of names) expect([n, edge((file === "icons.tsx" ? ui : highlight).get(n)!)]).toEqual([n, circle]);
});
