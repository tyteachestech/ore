import { expect, test } from "bun:test";
import { veilFrom } from "../src/HideVeil";

test("the blur starts at the middle of the eye, measured from the source's corner", () => {
  expect(veilFrom({ left: 216, top: 38, width: 684, height: 762 }, { left: 768, top: 8, width: 26, height: 24 })).toEqual({ x: 565, y: -18 });
});

test("with no eye (the iPhone) it starts at the source's top right corner", () => {
  expect(veilFrom({ left: 0, top: 50, width: 390, height: 700 }, null)).toEqual({ x: 390, y: 0 });
});
