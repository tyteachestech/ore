import { expect, test } from "bun:test";
import { MOLE, MOLE_BLINK, moleTurned } from "../src/Mole";

// D160, D168: every frame stays a 16-grid sprite, so the mole never leaves the pixel icons' grid while it moves.
const frames = { front: MOLE, blink: MOLE_BLINK, left: moleTurned(-1), right: moleTurned(1) };

test("every mole frame is 16 by 16 in its four tones", () => {
  for (const rows of Object.values(frames)) {
    expect(rows).toHaveLength(16);
    for (const r of rows) expect(r).toMatch(/^[.#+oP]{16}$/);
  }
});

test("frames keep the silhouette: only the face rows change, inside the head", () => {
  for (const rows of Object.values(frames)) {
    expect([...rows.slice(0, 4), ...rows.slice(9)]).toEqual([...MOLE.slice(0, 4), ...MOLE.slice(9)]);
    for (const [y, r] of rows.entries()) expect(r.replace(/[^.]/g, "#")).toBe(MOLE[y]!.replace(/[^.]/g, "#"));
  }
});

test("a blink shuts both eyes and a glance moves eyes, snout and nose a column", () => {
  const lit = (rows: readonly string[], from = 4, to = 8) => rows.slice(from, to + 1).flatMap((r, i) => [...r].flatMap((c, x) => (c === "P" ? [[x, i]] : [])));
  expect(MOLE_BLINK[4]).not.toContain("P");
  expect(lit(MOLE_BLINK, 5)).toEqual(lit(MOLE, 5));
  expect(lit(moleTurned(-1))).toEqual(lit(MOLE).map(([x, y]) => [x! - 1, y!]));
  expect(lit(moleTurned(1))).toEqual(lit(MOLE).map(([x, y]) => [x! + 1, y!]));
});
