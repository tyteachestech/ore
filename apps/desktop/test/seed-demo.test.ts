import { expect, test } from "bun:test";
import { $ } from "bun";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listCards, listItems, localDay, readAnnotations, today } from "../../../packages/core/src/index.ts";

// The library the product video is filmed on (scripts/mock/seed-demo.ts). What the camera needs from it is held
// here, so a change to scheduling or to the seed can't quietly leave a session that cuts no gem.
// Seeded at each of these times of his day: just after midnight the morning's reviews once fell on yesterday,
// and the day stood at 0 minutes (F104).
const clock = (h: number, m: number) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
for (const [name, now] of [["midday", clock(12, 30)], ["just after midnight", clock(0, 4)], ["just before midnight", clock(23, 58)]] as const)
test(`the demo library is set up to film, seeded ${name}: the day nearly done, gems to cut, a level within reach`, async () => {
  const root = join(mkdtempSync(join(tmpdir(), "ore-demo-")), "lib");
  try {
    // In the test's own time zone: bun test runs in UTC, the seed it starts in the Mac's, and their days differ (F-new-seed-demo-tz).
    await $`bun ${join(import.meta.dir, "../scripts/mock/seed-demo.ts")} ${root}`.env({ ...process.env, TZ: Intl.DateTimeFormat().resolvedOptions().timeZone, ORE_SEED_NOW: now.toISOString() }).quiet();
    const lib = { root };
    // It never writes over a library.
    expect((await $`bun ${join(import.meta.dir, "../scripts/mock/seed-demo.ts")} ${root}`.quiet().nothrow()).exitCode).not.toBe(0);
    const t = today(lib, now);
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
    const past = t.week.filter((d) => d.date < localDay(now));
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
