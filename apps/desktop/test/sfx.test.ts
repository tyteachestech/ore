import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inOrder, newSession, rated, setPlayer, setSounds, sfx, SFX, take } from "../src/sfx";

// Review's sounds (D277): which moment plays what, read off the player in place of the speakers.
let heard: [string, number][] = [];
beforeEach(() => {
  heard = [];
  setSounds(true);
  newSession();
  setPlayer((id, o) => heard.push([id, Math.round(Math.log2(o.rate) * 12)]));
});
afterEach(() => setPlayer(null));

describe("review sounds", () => {
  test("Again is the miss; Hard, Good and Easy are the recall", () => {
    for (const r of [1, 2, 3, 4]) (newSession(), rated(r));
    expect(heard.map((h) => h[0])).toEqual(["missed", "right", "right", "right"]);
  });

  test("recalls in a row climb a semitone each, up to four; Hard holds the note and a miss starts over", () => {
    for (const r of [3, 4, 3, 2, 3, 3, 3, 1, 3]) rated(r);
    expect(heard).toEqual([["right", 0], ["right", 1], ["right", 2], ["right", 3], ["right", 3], ["right", 4], ["right", 4], ["missed", 0], ["right", 0]]);
  });

  test("a new session starts the climb again", () => {
    rated(3);
    rated(3);
    newSession();
    rated(3);
    expect(heard.at(-1)).toEqual(["right", 0]);
  });

  test("turned off in Settings, nothing plays, and the climb still starts over on a miss", () => {
    setSounds(false);
    for (const id of SFX) sfx(id);
    rated(3);
    rated(1);
    expect(heard).toEqual([]);
    setSounds(true);
    rated(3);
    expect(heard).toEqual([["right", 0]]);
  });

  test("only the key moments have a sound: none for undo, Later or an edit", () => {
    expect([...SFX]).toEqual(["tap", "right", "missed", "goal", "cart", "pop", "done"]);
    const review = readFileSync(join(import.meta.dir, "../src/Review.tsx"), "utf8");
    // Every call in Review, by the sound it plays.
    expect([...review.matchAll(/\b(?:sfx|once)\("(\w+)"/g)].map((m) => m[1]).sort()).toEqual(["cart", "done", "goal", "pop", "tap", "tap", "tap"]);
    expect(review.match(/\brated\(/g)?.length).toBe(1);
  });

  test("the build takes every sound from the Mac's folder, never from git", () => {
    const config = readFileSync(join(import.meta.dir, "../vite.config.ts"), "utf8");
    for (const id of SFX) expect(config).toContain(`"${id}"`);
    expect(readFileSync(join(import.meta.dir, "../../../.gitignore"), "utf8")).toContain("apps/desktop/public/sounds/");
  });

  // F304: fast ratings stacked up to four sounds, and the goal's chime rang over the rating's.
  test("one review sound at a time: a new one cuts the one still playing, and the goal's chime waits for it to end", () => {
    const cuts: [string, number][] = [];
    const cut = (name: string) => (at: number) => void cuts.push([name, at]);
    // The answer's tick (0.55 s), then a rating 0.08 s in: the tick stops where the rating starts.
    expect(take(100, 0.55, false, cut("tap"))).toBe(100);
    expect(take(100.08, 0.85, false, cut("right"))).toBe(100.08);
    expect(cuts).toEqual([["tap", 100.08]]);
    // The goal asked for half a second after the rating: it starts once the rating's shine has ended, cutting nothing.
    expect(take(100.58, 1, true, cut("goal"))).toBeCloseTo(100.93);
    expect(cuts).toEqual([["tap", 100.08]]);
    // A sound that has ended is not cut.
    take(200, 0.5, false, cut("tap"));
    take(201, 0.5, false, cut("missed"));
    expect(cuts).toEqual([["tap", 100.08]]);
  });

  test("rate again during the goal's wait: the rating cuts the sound still playing, never the chime waiting its turn", () => {
    const cuts: [string, number][] = [];
    const cut = (name: string) => (at: number) => void cuts.push([name, at]);
    take(300, 0.85, false, cut("right"));
    expect(take(300.5, 1, true, cut("goal"))).toBeCloseTo(300.85); // waits for the shine
    // The next answer's tick lands before the chime has started: the shine stops there, the chime still comes.
    take(300.6, 0.55, false, cut("tap"));
    expect(cuts).toEqual([["right", 300.6]]);
    // Once the chime is sounding, the next sound cuts it as any other.
    take(301, 0.85, false, cut("missed"));
    expect(cuts).toEqual([["right", 300.6], ["tap", 301], ["goal", 301]]);
  });

  test("a slow first file still takes its turn first: sounds are placed in the order they were asked for", async () => {
    const placed: string[] = [];
    let load!: (v: string) => void;
    const slow = new Promise<string>((r) => (load = r));
    const a = inOrder(slow, (v) => void placed.push(v));
    const b = inOrder(Promise.resolve("rating"), (v) => void placed.push(v));
    await Promise.resolve();
    expect(placed).toEqual([]);
    load("tick");
    await Promise.all([a, b]);
    expect(placed).toEqual(["tick", "rating"]);
    // One that fails to load never holds up the ones after it.
    await Promise.all([inOrder(Promise.reject(new Error("404")), () => void placed.push("lost")), inOrder(Promise.resolve("next"), (v) => void placed.push(v))]);
    expect(placed).toEqual(["tick", "rating", "next"]);
  });

  // F305: a rating whose save came back after the window was hidden still played.
  test("nothing plays while the page is hidden", () => {
    const g = globalThis as { document?: unknown };
    const was = g.document;
    g.document = { hidden: true };
    try {
      sfx("tap");
      rated(3);
      expect(heard).toEqual([]);
    } finally {
      g.document = was;
    }
    sfx("tap");
    expect(heard.map((h) => h[0])).toEqual(["tap"]);
  });
});
