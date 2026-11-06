import { expect, test } from "bun:test";
import { pathOf } from "../src/original";

test("Copy path gives the original file, else the saved text", () => {
  expect(pathOf({ dir: "/Users/t/Ore/items/a", source_file: "/Users/t/Ore/items/a/source.pdf" })).toBe("/Users/t/Ore/items/a/source.pdf");
  expect(pathOf({ dir: "/Users/t/Ore/items/b/" })).toBe("/Users/t/Ore/items/b/doc.md");
});
