import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bigScreen, CHANNELS, clock, grid, hasGlyph, ICONS, powerDown, scene, text } from "../src/ambience-art";

// The ambience radio's screen (D253): what it draws, read off its dot grid.
const lit = (g: ReturnType<typeof grid>, x0 = 0, x1 = g.cols) => {
  let n = 0;
  for (let y = 0; y < g.rows; y++) for (let x = x0; x < x1; x++) if (g.lit[y * g.cols + x]! > 0) n++;
  return n;
};

describe("ambience radio screen", () => {
  test("every word it shows has its letters: each channel, the clock, NO FILE, OFF", () => {
    for (const s of [...CHANNELS.map((c) => c.screen), "0123456789:", "NO FILE", "OFF"]) for (const ch of s) expect(hasGlyph(ch)).toBe(true);
  });

  test("each channel's scene draws inside its own 22 columns at any moment, never over the words", () => {
    for (const c of CHANNELS) for (const t of [0, 0.4, 1.3, 7.9, 61]) {
      const g = grid(59, 22);
      scene(g, c.id, t);
      expect(lit(g, 0, 22)).toBeGreaterThan(5);
      expect(lit(g, 22)).toBe(0);
    }
  });

  test("the big screen fits its channel's name and the clock beside the scene", () => {
    const g = grid(59, 22);
    bigScreen(g, "focus", 1, 125, 0.5);
    // FOCUS is the longest name: 5 letters from column 25 must end inside the grid.
    expect(25 + 5 * 6 - 1).toBeLessThanOrEqual(59);
    expect(lit(g, 25)).toBeGreaterThan(40);
  });

  test("the clock counts minutes and seconds", () => {
    expect(clock(0)).toBe("00:00");
    expect(clock(65.9)).toBe("01:05");
    expect(clock(3599)).toBe("59:59");
    expect(clock(-3)).toBe("00:00");
  });

  test("switching off squeezes the picture to one dot, then nothing", () => {
    const from = grid(59, 22);
    text(from, "RAIN", 1, 1);
    const g = grid(59, 22);
    expect(powerDown(g, from.lit, 0.05)).toBe(true);
    expect(lit(g)).toBeGreaterThan(10);
    g.clear();
    powerDown(g, from.lit, 0.7);
    expect(lit(g)).toBe(1);
    g.clear();
    expect(powerDown(g, from.lit, 1.2)).toBe(false);
    expect(lit(g)).toBe(0);
  });

  test("each icon is drawn on an 11 grid", () => {
    for (const rows of Object.values(ICONS)) {
      expect(rows.length).toBe(11);
      for (const r of rows) expect(r.length).toBe(11);
    }
  });

  test("its sounds never go in the repo: the build takes them from outside it", () => {
    const ignore = readFileSync(join(import.meta.dir, "../../../.gitignore"), "utf8");
    expect(ignore).toContain("apps/desktop/public/sounds/");
    const vite = readFileSync(join(import.meta.dir, "../vite.config.ts"), "utf8");
    expect(vite).toContain("Library/Application Support/Ore/sounds");
  });
});

test("a key pressed on the radio's pads belongs to the radio: 2 there never also rates an exercise under it", async () => {
  const { Window } = await import("happy-dom");
  const { inTextField } = await import("../src/keys");
  const doc = new Window().document;
  const pop = doc.createElement("div");
  pop.setAttribute("data-own-keys", "");
  const pad = doc.createElement("button");
  pop.append(pad);
  doc.body.append(pop);
  const outside = doc.createElement("button");
  doc.body.append(outside);
  expect(inTextField({ target: pad } as unknown as KeyboardEvent)).toBe(true);
  expect(inTextField({ target: outside } as unknown as KeyboardEvent)).toBe(false);
});
