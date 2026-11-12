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
/** Each row's leftmost and rightmost pixel: the silhouette, holes and all inner detail aside. */
const edge = (rows: string[]) => rows.map((r) => (r.includes("#") ? [r.indexOf("#"), r.lastIndexOf("#")] : null));

// The highlight popup's ? (PixelIcon.tsx) is a bare mark since D229, no longer cut from a coin.
test("round icons in icons.tsx share Circle's outline", () => {
  const circle = edge(ui.get("Circle")!);
  for (const n of ["Question", "Minus", "PlayCircle", "CircleHalf", "Compass", "Target", "Globe"]) expect([n, edge(ui.get(n)!)]).toEqual([n, circle]);
});
