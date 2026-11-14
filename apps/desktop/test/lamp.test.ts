import { expect, test } from "bun:test";
import { glow, pulse } from "../src/Lamp";
import { MOVES, REST, advance, puppet, start } from "../src/Mole";
import { fineDots } from "../src/mole-fine";

// The lamp (D263): a running thing's dots follow something real, and are dark when nothing runs.

test("lamp: a pulse lights it and it fades to nothing between pulses", () => {
  expect(glow("never")).toBe(0);
  pulse("voice", 1000);
  expect(glow("voice", 400, 1000)).toBe(1);
  expect(glow("voice", 400, 1200)).toBeCloseTo(0.5);
  expect(glow("voice", 400, 5000)).toBe(0);
  pulse("voice", 5000);
  expect(glow("voice", 400, 5000)).toBe(1);
});

test("lamp: the mole's lamp is lit only while he thinks, in motion and still", () => {
  expect(REST.glow).toBe(0);
  expect(MOVES.thinking.to?.glow).toBeGreaterThan(0);
  expect(MOVES.thinking.still.glow).toBeGreaterThan(0);
  for (const [mood, m] of Object.entries(MOVES)) if (mood !== "thinking") expect([mood, m.to?.glow ?? 0, m.still?.glow ?? 0]).toEqual([mood, 0, 0]);
  const s = puppet();
  start(s, "thinking", 0);
  for (let t = 16; t < 1500; t += 16) advance(s, t, 0.016);
  expect(s.v.glow).toBeGreaterThan(0.3);
});

test("lamp: lit, the mole's lamp draws more amber dots, and none of them move the rest of him", () => {
  const amber = (g: number) => fineDots({ ...REST, glow: g }).filter((d) => d[3] === "lamp");
  const off = amber(0), on = amber(1);
  expect(on.length).toBe(off.length + 5);
  const others = (g: number) => fineDots({ ...REST, glow: g }).filter((d) => d[3] !== "lamp");
  expect(others(1)).toEqual(others(0));
});
