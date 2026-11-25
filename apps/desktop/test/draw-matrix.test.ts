import { expect, test } from "bun:test";
import { addMatrix, cellOf, clone, DEFAULT_STYLE, duplicate, layoutMatrix, setLabel, fromScene, growMatrix, remove, toScene } from "../src/draw/model";

for (const missing of [0, 1, 2, 3]) {
  for (const direction of ["row", "col"] as const) {
    test(`growing a matrix ${direction} after deleting corner ${missing} keeps valid saved cells`, () => {
      const original = addMatrix([], [100, 200], 2, 2, DEFAULT_STYLE).els;
      const mid = cellOf(original[0]!)!.matrix;
      const kept = remove(original, new Set([original[missing]!.id]));
      const grown = growMatrix(kept, mid, direction);
      expect(grown).toHaveLength(5);
      for (const cell of grown) {
        expect(cell.type).toBe("rectangle");
        expect([cell.x, cell.y, cell.width, cell.height].every(Number.isFinite)).toBe(true);
        expect(cell.width).toBeGreaterThan(0);
        expect(cell.height).toBeGreaterThan(0);
      }
      const reopened = fromScene(JSON.parse(JSON.stringify(toScene(grown, null))));
      expect(reopened.map((cell) => cell.id)).toEqual(grown.map((cell) => cell.id));
      expect(reopened.map(cellOf)).toEqual(grown.map(cellOf));
    });
  }
}

for (const partial of [false, true]) {
  test(`a ${partial ? "partial" : "whole"} matrix copy has its own layout identity`, () => {
    const original = addMatrix([], [0, 0], 2, 2, DEFAULT_STYLE).els;
    const selected = partial ? original.slice(0, 2) : original;
    const copied = duplicate(original, new Set(selected.map((e) => e.id)), 500, 300);
    const copy = copied.els.find((e) => copied.ids.includes(e.id))!;
    const mid = cellOf(copy)!.matrix;
    expect(mid).not.toBe(cellOf(original[0]!)!.matrix);
    expect(mid).toBe(copy.groupIds[0]!);
    expect(new Set(copied.els.filter((e) => copied.ids.includes(e.id)).map((e) => cellOf(e)!.matrix)).size).toBe(1);
    const edited = layoutMatrix(setLabel(copied.els, copy.id, "Copied notes", DEFAULT_STYLE), mid);
    expect(edited.find((e) => e.id === copy.id)).toMatchObject({ x: 500, y: 300 });
    expect(edited.filter((e) => original.some((o) => o.id === e.id))).toEqual(original);
    const reopened = fromScene(JSON.parse(JSON.stringify(toScene(edited, null))));
    expect(reopened.find((e) => e.id === copy.id)).toMatchObject({ x: 500, y: 300 });
    expect(cellOf(reopened.find((e) => e.id === copy.id)!)!.matrix).toBe(mid);
  });
}

test("cloning two ungrouped matrices keeps their identities separate and preserves custom data", () => {
  const originals = addMatrix(addMatrix([], [0, 0], 2, 2, DEFAULT_STYLE).els, [500, 0], 2, 2, DEFAULT_STYLE).els
    .map((e) => ({ ...e, groupIds: [], customData: { ...e.customData, other: "keep" } }));
  const copied = clone(originals, 0, 300);
  const originalIds = new Set(originals.map((e) => cellOf(e)!.matrix));
  expect(new Set(copied.map((e) => cellOf(e)!.matrix)).size).toBe(2);
  for (const cell of copied) {
    expect(originalIds.has(cellOf(cell)!.matrix)).toBe(false);
    expect(cell.customData?.other).toBe("keep");
    expect(cell.groupIds).toEqual([]);
  }
});
