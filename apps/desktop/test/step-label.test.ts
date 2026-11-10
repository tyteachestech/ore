import { expect, test } from "bun:test";
import { stepLabel } from "../src/util";

test("the quiz's progress, read aloud, never passes its last step", () => {
  expect(stepLabel(["now", "", ""])).toBe("Step 1 of 3");
  expect(stepLabel(["done", "now", ""])).toBe("Step 2 of 3");
  expect(stepLabel(["done", "done"])).toBe("Step 2 of 2");
});
