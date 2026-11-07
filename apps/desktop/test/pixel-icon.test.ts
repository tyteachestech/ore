import { expect, test } from "bun:test";
import { outline } from "../src/PixelIcon";

// Finish's "Key point" star draws `weight="regular"` when off: the sprite's edge, hollow inside, so on and off differ.
test("a regular-weight sprite is its filled shape's edge", () => {
  expect(outline(["....", ".###", ".###", ".###"])).toEqual(["....", ".###", ".#.#", ".###"]);
});
