import { expect, test } from "bun:test";
import { rowLine } from "../src/Home";

// The iPhone's list rows (Tyler, 2026-11-23): one line under the title says how long is left and who made it.
test("a list row's line: its length before he opens it, what is left once he has, only who made it once done", () => {
  const item = { words: 2300, type: "article", video: undefined, status: "inbox", author: " Ana Ruiz " } as const;
  expect(rowLine(item, 0)).toBe("10 min · Ana Ruiz");
  expect(rowLine({ ...item, status: "reading" }, 0.5)).toBe("5 min left · Ana Ruiz");
  expect(rowLine({ ...item, status: "done" }, 1)).toBe("Ana Ruiz");
  expect(rowLine({ ...item, author: undefined }, 0)).toBe("10 min");
  expect(rowLine({ ...item, words: 0, author: "" }, 0)).toBe("");
});
