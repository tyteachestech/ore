import { describe, expect, test } from "bun:test";
import { burstOffsets } from "../src/Burst";

describe("pixel burst (D153)", () => {
  test("fourteen squares, every direction, two radii, the far ones a beat later", () => {
    const o = burstOffsets();
    expect(o).toHaveLength(14);
    const r = o.map((p) => Math.round(Math.hypot(p.dx, p.dy)));
    for (const x of r) expect([72, 92]).toContain(x);
    for (const p of o) expect(Math.round(Math.hypot(p.x0, p.y0))).toBe(36); // starts outside the 32px badge
    expect(new Set(o.map((p) => `${p.dx},${p.dy}`)).size).toBe(14);
    expect(o.filter((p) => p.delay === 280).length).toBe(7);
    expect(o[0]).toEqual({ x0: 0, y0: -36, dx: 0, dy: -72, delay: 220 }); // straight up first
  });
});
