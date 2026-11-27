import { afterAll, expect, test } from "bun:test";

// F737: a long book mounted 16 slices a pass, passes back to back; the paint waited for the run to stop, so its first
// scroll caught on frames of 100 to 250 ms. Now one pass a frame, sized by how long a slice took.
const frames: (() => void)[] = [];
const was = { raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
Object.assign(globalThis, {
  requestAnimationFrame: (f: () => void) => frames.push(f),
  cancelAnimationFrame: (i: number) => void (frames[i - 1] = () => {}),
});
afterAll(() => Object.assign(globalThis, { requestAnimationFrame: was.raf, cancelAnimationFrame: was.caf }));
const { afterPaint, slicesFor } = await import("../src/pace");

test("pace (F737): as many slices as fit in a frame by the last one's time, never none", () => {
  expect(slicesFor(2)).toBe(4);
  expect(slicesFor(10)).toBe(1);
  expect(slicesFor(0)).toBe(80);
  expect(slicesFor(Number.NaN)).toBe(1);
});

test("pace (F737): the next pass waits for a frame to be drawn, and still runs when no frame comes (a hidden window)", async () => {
  frames.length = 0;
  let ran = 0;
  afterPaint(() => ran++, 30);
  await Bun.sleep(5);
  expect(ran).toBe(0); // not straight after the last pass: the page draws first
  frames.shift()!();
  await Bun.sleep(5);
  expect(ran).toBe(1);
  await Bun.sleep(40);
  expect(ran).toBe(1); // the late timer is gone once the frame came
  afterPaint(() => ran++, 20); // no frame drawn
  await Bun.sleep(40);
  expect(ran).toBe(2);
  const stop = afterPaint(() => ran++, 10);
  stop();
  await Bun.sleep(30);
  expect(ran).toBe(2);
});
