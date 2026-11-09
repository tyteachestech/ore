// A touch on an iPhone row is a tap, a hold or a swipe, never two (src/phone/drag.ts).
import { expect, test } from "bun:test";
import { HOLD_MS, trackDrag, type Drag } from "../src/phone/drag";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const point = (clientX: number, clientY = 100) => ({ clientX, clientY });
const touch = (el: EventTarget, type: string, ...touches: ReturnType<typeof point>[]) =>
  el.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { touches }));

function setup() {
  const el = new EventTarget();
  const log: string[] = [];
  const drag: Drag = {
    accept: () => true,
    begin: () => void log.push("begin"),
    move: () => void log.push("move"),
    end: (_dx, _flick, cancelled) => void log.push(cancelled ? "cancelled" : "end"),
    hold: () => void log.push("hold"),
  };
  return { el, log, stop: trackDrag(el, () => drag) };
}
const pastHold = () => wait(HOLD_MS + 60);

test("a still touch holds at 500 ms, not before", async () => {
  const { el, log, stop } = setup();
  touch(el, "touchstart", point(100));
  await wait(HOLD_MS - 150);
  expect(log).toEqual([]);
  await wait(210);
  expect(log).toEqual(["hold"]);
  stop();
});

test("sliding after the hold doesn't swipe the row under the menu", async () => {
  const { el, log, stop } = setup();
  touch(el, "touchstart", point(100));
  await pastHold();
  touch(el, "touchmove", point(300));
  touch(el, "touchend");
  expect(log).toEqual(["hold"]);
  stop();
});

test("a swipe that has locked never becomes a hold, even paused at exactly 10 pt", async () => {
  const { el, log, stop } = setup();
  touch(el, "touchstart", point(100));
  touch(el, "touchmove", point(110));
  await pastHold();
  expect(log).toEqual(["begin", "move"]);
  stop();
});

test("a tap ends the hold", async () => {
  const { el, log, stop } = setup();
  touch(el, "touchstart", point(100));
  touch(el, "touchend");
  await pastHold();
  expect(log).toEqual([]);
  stop();
});

test("a second finger cancels a hold", async () => {
  const { el, log, stop } = setup();
  touch(el, "touchstart", point(100));
  touch(el, "touchstart", point(100), point(200));
  await pastHold();
  expect(log).toEqual([]);
  stop();
});

test("a touch the system cancels never commits", () => {
  const { el, log, stop } = setup();
  touch(el, "touchstart", point(100));
  touch(el, "touchmove", point(300));
  touch(el, "touchcancel");
  expect(log).toEqual(["begin", "move", "cancelled"]);
  stop();
});
