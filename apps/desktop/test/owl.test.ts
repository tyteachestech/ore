import { expect, test } from "bun:test";
import { OWL, OWL_BLINK, owlTurned } from "../src/Owl";

// D160: every frame stays a 16-grid sprite, so the owl never leaves the pixel icons' grid while it moves.
const frames = { front: OWL, blink: OWL_BLINK, left: owlTurned(-1), right: owlTurned(1) };

test("every owl frame is 16 by 16 in the five tones", () => {
  for (const rows of Object.values(frames)) {
    expect(rows).toHaveLength(16);
    for (const r of rows) expect(r).toMatch(/^[.#+oPB]{16}$/);
  }
});

test("frames keep the silhouette: only the face rows change", () => {
  // Outside the face rows (4–9) every frame is the front sprite.
  for (const rows of Object.values(frames)) {
    expect([...rows.slice(0, 4), ...rows.slice(10)]).toEqual([...OWL.slice(0, 4), ...OWL.slice(10)]);
    // The face slides inside the head: the outer columns stay empty and the head's sides stay filled.
    for (const r of rows.slice(4, 10)) expect(r[0]! + r[1]! + r[14]! + r[15]!).toMatch(/^\.[#+]{2}\.$/);
  }
});

test("a blink shuts both eyes and a turn moves the eyes a column", () => {
  expect(OWL_BLINK.join("")).not.toContain("P");
  const pupils = (rows: readonly string[]) => rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === "P" ? [[x, y]] : [])));
  expect(pupils(owlTurned(-1))).toEqual(pupils(OWL).map(([x, y]) => [x! - 1, y!]));
  expect(pupils(owlTurned(1))).toEqual(pupils(OWL).map(([x, y]) => [x! + 1, y!]));
});
