import { afterAll, describe, expect, test } from "bun:test";

// Reduce Motion: a turn lands at once, so the test needs no frames.
const g = globalThis as Record<string, unknown>;
const had = g.matchMedia;
g.matchMedia = () => ({ matches: true });
afterAll(() => void (g.matchMedia = had));
const { edgeDir, edgeTurn, turnBy, HOLD, EDGE } = await import("../src/edge-turn");

const band = { top: 100, bottom: 700 };

describe("a selection held at the screen's edge turns the page", () => {
  test("only the bottom and top strips turn, and nothing off the pane (the Mac scrolls that itself)", () => {
    expect(edgeDir(699, band)).toBe(1);
    expect(edgeDir(700 - EDGE, band)).toBe(1);
    expect(edgeDir(700 - EDGE - 1, band)).toBe(0);
    expect(edgeDir(400, band)).toBe(0);
    expect(edgeDir(101, band)).toBe(-1);
    expect(edgeDir(701, band)).toBe(0);
    expect(edgeDir(99, band)).toBe(0);
  });

  test("a turn is a screen less two lines, and stops at the text's end", () => {
    expect(turnBy(1, { scrollTop: 0, scrollHeight: 5000, clientHeight: 600 })).toBe(544);
    expect(turnBy(1, { scrollTop: 4300, scrollHeight: 5000, clientHeight: 600 })).toBe(100);
    expect(turnBy(1, { scrollTop: 4400, scrollHeight: 5000, clientHeight: 600 })).toBe(0);
    expect(turnBy(-1, { scrollTop: 200, scrollHeight: 5000, clientHeight: 600 })).toBe(-200);
  });

  const pane = () => {
    const el = { scrollTop: 0, scrollHeight: 5000, clientHeight: 600, getBoundingClientRect: () => band } as unknown as HTMLElement;
    const extended: [number, number][] = [];
    const turn = edgeTurn({ scroller: el, extend: (x, y) => extended.push([x, y]) });
    return { el, extended, turn };
  };

  test("it waits a moment first, then turns and carries the selection to the words under the pointer, and again after another moment", async () => {
    const { el, extended, turn } = pane();
    turn.aim(300, 690);
    await Bun.sleep(HOLD / 2);
    expect(el.scrollTop).toBe(0); // a highlight that only ends on the last line stays put
    turn.aim(320, 692); // moving along the edge keeps the wait
    await Bun.sleep(HOLD / 2 + 60);
    expect(el.scrollTop).toBe(544);
    expect(extended).toEqual([[320, 692]]);
    await Bun.sleep(HOLD + 60);
    expect(el.scrollTop).toBe(1088);
    turn.stop();
  });

  test("leaving the edge or letting go before the moment turns nothing", async () => {
    const { el, turn } = pane();
    turn.aim(300, 690);
    await Bun.sleep(HOLD / 2);
    turn.aim(300, 400);
    turn.aim(300, 690); // back again: a new wait
    await Bun.sleep(HOLD / 2 + 60);
    expect(el.scrollTop).toBe(0);
    turn.stop();
    await Bun.sleep(HOLD / 2 + 60);
    expect(el.scrollTop).toBe(0);
  });

  test("a selection's end only turns on and its start only back", async () => {
    const { el, turn } = pane();
    el.scrollTop = 1000;
    turn.aim(300, 110, 1); // the end, dragged up to the top: no turn back
    await Bun.sleep(HOLD + 60);
    expect(el.scrollTop).toBe(1000);
    turn.aim(300, 111, -1); // the start held there turns back
    await Bun.sleep(HOLD + 60);
    expect(el.scrollTop).toBe(456);
    turn.stop();
  });
});

test("a page that scrolls by itself while the edge waits (the Mac's own drag scrolling) is left to it", async () => {
  const el = { scrollTop: 0, scrollHeight: 5000, clientHeight: 600, getBoundingClientRect: () => band } as unknown as HTMLElement;
  const turn = edgeTurn({ scroller: el, extend: () => {} });
  turn.aim(300, 690);
  await Bun.sleep(HOLD / 2);
  el.scrollTop = 40;
  await Bun.sleep(HOLD / 2 + 60);
  expect(el.scrollTop).toBe(40);
  await Bun.sleep(HOLD + 60); // it stopped: the wait that began then ends in a turn
  expect(el.scrollTop).toBe(584);
  turn.stop();
});
