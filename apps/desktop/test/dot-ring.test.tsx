import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Cutting, Gem } from "../src/Gem";
import { DotBar, DotRing, lit, minutes, minutesText, ThumbLine } from "../src/Ring";

// D183: one way of drawing. Gems, rings and icons are round dots; no square pixel is left beside them.

test("any progress lights one dot, and only a whole share lights them all", () => {
  expect(lit(0, 14)).toBe(0);
  expect(lit(0.01, 14)).toBe(1);
  expect(lit(0.5, 14)).toBe(7);
  expect(lit(0.99, 14)).toBe(13);
  expect(lit(1, 14)).toBe(14);
});

test("goal minutes stay below the target until enough time has elapsed (F-new-goal-minutes-rounding)", () => {
  const goal = 600_000;
  expect(minutes(573_084, goal)).toBe(9);
  expect(minutesText(599_999, goal)).toBe("9");
  expect(minutesText(45_000, goal)).toBe("<1");
  expect(minutesText(0, goal)).toBe("0");
  expect(minutesText(goal, goal)).toBe("10");
  expect(minutesText(635_000, goal)).toBe("11");
  expect(minutesText(573_084)).toBe("10");
});

test("a ring shows its lit dots, then today's dimmer ones, then the track", () => {
  const html = renderToStaticMarkup(<DotRing size={56} share={0.25} ghost={0.1} />);
  expect(html.match(/<circle/g)?.length).toBe(20);
  expect(html.match(/class="on"/g)?.length).toBe(5);
  expect(html.match(/class="soon"/g)?.length).toBe(2);
});

test("a bar is whole dots: a sliver of progress lights one, and no dot is ever cut (D184)", () => {
  const bar = (share: number) => renderToStaticMarkup(<DotBar className="home-meter small" share={share} n={10} />);
  expect(bar(0.02).match(/<i/g)?.length).toBe(10);
  expect(bar(0.02).match(/class="on"/g)?.length).toBe(1);
  expect(bar(0.5).match(/class="on"/g)?.length).toBe(5);
  expect(bar(0).includes('class="on"')).toBe(false);
  expect(bar(0.5)).not.toContain("width");
});

test("how far he has read is one line on the picture, as wide as his share, and no dots (D326)", () => {
  const line = (share: number) => renderToStaticMarkup(<ThumbLine share={share} />);
  expect(line(0.62)).toContain("--at:0.62");
  expect(line(0.62)).not.toContain("<i");
  // Never wider than the picture, never negative.
  expect(line(1.4)).toContain("--at:1");
  expect(line(-1)).toContain("--at:0");
});

test("a gem is loose dots until it is cut, then solid pixels, and no state glows (D236)", () => {
  for (const size of [16, 36]) {
    const draw = (kind: Parameters<typeof Gem>[0]["kind"], more = {}) => renderToStaticMarkup(<Gem kind={kind} size={size} {...more} />);
    const count = (html: string, tag: string) => html.match(new RegExp(`<${tag}`, "g"))?.length ?? 0;
    for (const kind of ["rough", "empty"] as const) {
      expect(count(draw(kind), "circle")).toBeGreaterThan(0);
      expect(draw(kind)).not.toContain("<rect");
    }
    // Cut: every cell a full square.
    expect(draw("cut")).not.toContain("<circle");
    expect(draw("cut")).not.toMatch(/rx="0\.[0-9]/);
    // Nearly cut: still the rock, its dots swollen, with one face already cut solid.
    expect(count(draw("ready"), "rect")).toBe(count(draw("rough"), "circle"));
    expect(draw("ready")).toMatch(/<rect[^>]* rx="0\.[0-9]+/);
    expect(draw("ready")).toMatch(/<rect[^>]* rx="0"/);
    // Missed: the gem's outline in its own colour, every cell loose again. No crack: no cell is missing.
    expect(count(draw("dull"), "rect")).toBe(count(draw("cut"), "rect"));
    expect(draw("dull")).not.toMatch(/<rect[^>]* rx="0"/);
    // Won back: the rim gold, and it keeps the gold if it is missed again.
    expect(count(draw("cut", { seam: true }), "rect")).toBe(count(draw("cut"), "rect"));
    expect(draw("cut", { seam: true })).toContain("var(--seam)");
    expect(draw("dull", { seam: true })).toContain("var(--seam)");
    expect(draw("cut")).not.toContain("var(--seam)");
    expect(draw("cut", { polished: true })).toContain("gem-sparkle");
    expect(draw("cut")).not.toContain("gem-sparkle");
    expect(count(draw("empty"), "circle")).toBeLessThan(count(draw("cut"), "rect"));
    for (const kind of ["cut", "ready", "rough", "dull", "empty"] as const) expect(draw(kind)).not.toContain("crispEdges");
  }
});


test("a stone at a session's end waits as loose dots where it landed, and is cut at once when nothing may move (D239)", () => {
  const waiting = renderToStaticMarkup(<Cutting go={false} />);
  expect(waiting).toContain('data-kind="rough"');
  expect(waiting).not.toContain("<rect");
  const cut = renderToStaticMarkup(<Cutting go still seam />);
  expect(cut).toContain('data-kind="cut"');
  expect(cut).not.toContain("<circle");
  expect(cut).toContain("data-gold");
  expect(cut).not.toContain("data-cutting");
});

test("a gem caught mid-cut: its dots are part fused, and the light crossing it brightens only the cells under it", () => {
  const mid = renderToStaticMarkup(<Gem kind="cut" size={36} fuse={0.7} />);
  expect(mid).toContain("rx=");
  const fills = (html: string) => html.match(/white 70%/g)?.length ?? 0;
  expect(fills(renderToStaticMarkup(<Gem kind="cut" size={36} band={8} />))).toBeGreaterThan(fills(renderToStaticMarkup(<Gem kind="cut" size={36} />)));
});

test("the last two square marks are round dots: a question's may-answer lead and the calibration cells (F82, D184)", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const css = readFileSync(`${import.meta.dir}/../src/styles.css`, "utf8");
  for (const sel of [".q-lead::before", ".review-calibration-bar i"]) {
    const rule = css.match(new RegExp(`^${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`, "m"))?.[1] ?? "";
    expect(rule, sel).toContain("border-radius: 50%");
  }
});

test("the small marks are round dots too: the sidebar arrow, the tick and cross, the waiting matrix (D183)", async () => {
  const { Arrow } = await import("../src/SideCursor");
  const { CHECK, CROSS, Matrix, Sprite } = await import("../src/Working");
  const marks = [<Arrow ref={{ current: null }} className="side-cursor" />, <Sprite rows={CHECK} />, <Sprite rows={CROSS} />, <Matrix />];
  for (const mark of marks) {
    const html = renderToStaticMarkup(mark);
    expect(html).toContain("<circle");
    expect(html).not.toContain("<rect");
    expect(html).not.toContain("crispEdges");
  }
});

test("nothing glows but the lamp and a reward (D323): no blurred shadow in a colour elsewhere, and no halo behind a gem", async () => {
  const css = (await Bun.file(new URL("../src/styles.css", import.meta.url)).text()) + (await Bun.file(new URL("../src/retro.css", import.meta.url)).text());
  // The reward glow: the day's goal met (Home's ring, the end screen's) and a to-do ticked.
  const reward = /^(\.home-goal \.ring|@keyframes (goal-glow|ticked)|@media \(prefers-reduced-motion: reduce\) \{ \.home-goal \.ring)/;
  const glows = css.split("\n").filter((l) => /drop-shadow\(|box-shadow:[^;]*(?<!0 )\b0 0 [1-9]\d*px (var\(--c-|var\(--skill|color-mix)/.test(l) && !l.includes("--lamp") && !reward.test(l));
  expect(glows.map((l) => l.slice(0, 40))).toEqual([]);
  expect(/\.gem\[data-polished\][^{]*\{[^}]*gradient/.test(css)).toBe(false);
  expect(/\.quiz-done-badge \{[^}]*box-shadow/.test(css)).toBe(false);
});

test("a source's type is written in sentence case, like every other label", async () => {
  const css = await Bun.file(new URL("../src/styles.css", import.meta.url)).text();
  expect(/\.kind-line \{[^}]*uppercase/.test(css)).toBe(false);
  const filters = await Bun.file(new URL("../src/filters.ts", import.meta.url)).text();
  const kinds = filters.match(/const KINDS[^\n]*/)![0].match(/: "([^"]+)"/g)!.map((k) => k.slice(3, -1));
  for (const k of kinds) expect(k[0]).toBe(k[0]!.toUpperCase());
});

test("a failed feed has one main button: Try again; Unfollow is quiet", async () => {
  const feed = await Bun.file(new URL("../src/Feed.tsx", import.meta.url)).text();
  const line = feed.slice(feed.indexOf('className="feed-error"'), feed.indexOf("</div>", feed.indexOf('className="feed-error"')));
  expect(line.match(/className="pill-btn"/g)?.length).toBe(1);
  expect(line).toContain('className="settings-btn" onClick={() => unfollow(f)}');
});
