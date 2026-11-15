import { expect, test } from "bun:test";
import type { CollisionDetection } from "@dnd-kit/core";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dropWithin } from "../src/drag";

// F308: a skill let go over the blank page still reordered, since closestCenter always finds
// the nearest row. A drop with the pointer outside the list must find nothing, so the drag cancels.
type Args = Parameters<CollisionDetection>[0];
const box = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 200, bottom: 600 }) } as unknown as Element;
const nearest: CollisionDetection = () => [{ id: "nearest" }];

test("a drop let go outside the list finds no target, so it cancels", () => {
  const detect = dropWithin(() => box, nearest);
  expect(detect({ pointerCoordinates: { x: 900, y: 300 } } as Args)).toEqual([]);
  expect(detect({ pointerCoordinates: { x: 100, y: 300 } } as Args)).toEqual([{ id: "nearest" }]);
  // A drag from the keyboard has no pointer: it goes where the arrows took it.
  expect(detect({ pointerCoordinates: null } as Args)).toEqual([{ id: "nearest" }]);
});

test("no sortable list falls back to the nearest row wherever the pointer is let go", () => {
  const src = join(import.meta.dir, "../src");
  const files = readdirSync(src, { recursive: true }).map(String).filter((f) => /\.tsx?$/.test(f));
  expect(files.filter((f) => /collisionDetection=\{closest(Center|Corners)\}/.test(readFileSync(join(src, f), "utf8")))).toEqual([]);
});
