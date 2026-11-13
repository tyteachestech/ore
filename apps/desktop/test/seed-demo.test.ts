import { expect, test } from "bun:test";
import { $ } from "bun";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listCards, listItems, readAnnotations, today } from "../../../packages/core/src/index.ts";

// The library the product video is filmed on (scripts/mock/seed-demo.ts). What the camera needs from it is held
// here, so a change to scheduling or to the seed can't quietly leave a session that cuts no gem.
test("the demo library is set up to film: the day nearly done, gems to cut, a level within reach", async () => {
  const root = join(mkdtempSync(join(tmpdir(), "ore-demo-")), "lib");
  try {
    await $`bun ${join(import.meta.dir, "../scripts/mock/seed-demo.ts")} ${root}`.quiet();
    const lib = { root };
    // It never writes over a library.
    expect((await $`bun ${join(import.meta.dir, "../scripts/mock/seed-demo.ts")} ${root}`.quiet().nothrow()).exitCode).not.toBe(0);
    const t = today(lib);
    // Most of today's ten minutes are done, so a short session closes the day on camera.
    expect(t.met).toBe(false);
    expect(t.active_ms).toBeGreaterThan(t.goal_ms * 0.7);
    // A session short enough to film to its end, with gems one Good from cut.
    expect(t.due).toBeGreaterThanOrEqual(8);
    expect(t.due).toBeLessThanOrEqual(20);
    const ready = t.skills.reduce((n, s) => n + s.ready_today, 0);
    expect(ready).toBeGreaterThanOrEqual(5);
    // AI reaches level 2 in that session.
    const ai = t.skills.find((s) => s.skill === "ai")!;
    expect(ai.level).toBe(1);
    expect(ai.solid + ai.ready_today).toBeGreaterThanOrEqual(ai.next_level_at);
    // Every kind of gem is on show somewhere: won back and polished among the cut.
    expect(t.skills.some((s) => s.mended > 0)).toBe(true);
    expect(t.skills.some((s) => s.polished > 0)).toBe(true);
    // The week reads as a kept habit, with a miss in it.
    const past = t.week.filter((d) => d.date < new Date().toISOString().slice(0, 10));
    if (past.length >= 3) expect(past.some((d) => d.status === "met")).toBe(true);
    // Every exercise opens at its passage: its highlight is in its source.
    const marks = new Set(listItems(lib).flatMap((i) => readAnnotations(i).map((a) => a.id)));
    const cards = listCards(lib);
    expect(cards.length).toBeGreaterThanOrEqual(80);
    for (const c of cards) expect(marks.has(c.meta.annotation!)).toBe(true);
    // No skill stands empty on Home.
    for (const s of t.skills) expect(s.solid + s.growing).toBeGreaterThan(0);
  } finally {
    rmSync(join(root, ".."), { recursive: true, force: true });
  }
}, 30_000);

// Inspect the saved sources, the same Markdown the reader receives.
test("demo source bodies contain no single-dollar math (F105)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ore-demo-math-"));
  const root = join(dir, "lib");
  try {
    await $`bun ${join(import.meta.dir, "../scripts/mock/seed-demo.ts")} ${root}`.quiet();
    const items = listItems({ root });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.body).not.toMatch(/(?<!\$)\$(?!\$)/);
    const fsrs = items.find((i) => i.meta.title === "How FSRS schedules a memory")!;
    expect(fsrs.body).toContain("Here $$t$$");
    expect(fsrs.body).toContain("$$t = S$$");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 30_000);

// Sample both straight segments and the original cubic SVG paths, so the guard measures the
// drawing rather than requiring one path encoding. Each cubic is sampled at 100 positions.
function sampleCurve(path: string): [number, number][] {
  const tokens = path.match(/[MLCS]|-?\d+(?:\.\d+)?/g)!;
  const points: [number, number][] = [];
  let at = 0, x = 0, y = 0, cx = 0, cy = 0;
  const number = () => Number(tokens[at++]);
  while (at < tokens.length) {
    const command = tokens[at++];
    if (command === "M" || command === "L") {
      x = number(); y = number();
      points.push([x, y]);
    } else if (command === "C" || command === "S") {
      const x1 = command === "S" ? 2 * x - cx : number();
      const y1 = command === "S" ? 2 * y - cy : number();
      cx = number(); cy = number();
      const endX = number(), endY = number();
      for (let i = 1; i <= 100; i++) {
        const t = i / 100, u = 1 - t;
        points.push([u ** 3 * x + 3 * u * u * t * x1 + 3 * u * t * t * cx + t ** 3 * endX,
          u ** 3 * y + 3 * u * u * t * y1 + 3 * u * t * t * cy + t ** 3 * endY]);
      }
      x = endX; y = endY;
    } else throw new Error(`Unsupported curve command ${command}`);
  }
  return points;
}

test("demo forgetting curves fall monotonically above the axis and match their stability (F106)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ore-demo-curves-"));
  const root = join(dir, "lib");
  try {
    await $`bun ${join(import.meta.dir, "../scripts/mock/seed-demo.ts")} ${root}`.quiet();
    const item = listItems({ root }).find((i) => i.meta.title === "How FSRS schedules a memory")!;
    const svg = readFileSync(join(item.dir, "assets/curves.svg"), "utf8");
    expect(svg).toContain('viewBox="0 0 960 420"');
    const paths = [...svg.matchAll(/<path d="([^"]+)"[^>]*stroke="([^"]+)"/g)];
    expect(paths).toHaveLength(2);
    for (const [, path, color] of paths) {
      const points = sampleCurve(path!);
      expect(points[0]).toEqual([80, 50]);
      expect(points.at(-1)![0]).toBe(900);
      for (let i = 1; i < points.length; i++) {
        expect(points[i]![0]).toBeGreaterThan(points[i - 1]![0]);
        expect(points[i]![1]).toBeGreaterThanOrEqual(points[i - 1]![1]);
        expect(points[i]![1]).toBeLessThan(350);
      }
      // Worked examples of R(t) = (1 + t/(9S))^-1 on a 0–180 day axis:
      // at S, 90%; at 9S, 50%; at 3S, 75%. 100% is y=50, zero is y=350.
      const examples = color === "#d6457a" ? [[3, 80], [27, 200]] : [[60, 80], [180, 125]];
      for (const [day, expectedY] of examples) {
        const targetX = 80 + day! / 180 * 820;
        const index = points.findIndex(([x]) => x >= targetX - 0.01);
        const [x1, y1] = points[index - 1]!, [x2, y2] = points[index]!;
        const y = y1 + (y2 - y1) * (targetX - x1) / (x2 - x1);
        expect(y).toBeCloseTo(expectedY!, 1);
      }
    }
    expect(svg).toContain('y1="80" x2="900" y2="80"'); // 90% guide matches the plotted scale.
    expect(item.body).toContain(String.raw`\frac{t}{9S}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 30_000);
