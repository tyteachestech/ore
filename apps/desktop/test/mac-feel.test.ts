import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cutOff, expandAt } from "../src/full-text";
import { snapRate } from "../src/rate";
import { popUpShift } from "../src/pop-up";

// D282: five small things a Mac app does that Ore did not.
const src = (f: string) => readFileSync(join(import.meta.dir, "../src", f), "utf8");

test("a speed dragged near a preset lands on it", () => {
  expect(snapRate(1.03)).toBe(1);
  expect(snapRate(0.97)).toBe(1);
  expect(snapRate(1.27)).toBe(1.25);
  expect(snapRate(1.1)).toBe(1.1); // between presets it moves freely
  expect(snapRate(1.96)).toBe(2);
  // An arrow key steps 0.05 off a preset; the slider snaps only a drag, so the step stays.
  const video = readFileSync(join(import.meta.dir, "../src/Video.tsx"), "utf8");
  expect(video).toContain("onRate(dragging.current ? snapRate(v) : v)");
});

test("a submenu's first row sits level with the row that opened it", () => {
  const menu = src("Menu.tsx");
  for (const m of menu.matchAll(/<(?:Context|Dropdown)Menu\.SubContent [^>]*>/g)) expect(m[0]).toContain("alignOffset={-5}");
  expect(menu.match(/SubContent [^>]*alignOffset/g)?.length).toBe(2);
});

test("text is cut off when it is wider (or, clamped, taller) than its box", () => {
  expect(cutOff({ scrollWidth: 400, clientWidth: 300, scrollHeight: 20, clientHeight: 20 })).toBe(true);
  expect(cutOff({ scrollWidth: 300, clientWidth: 300, scrollHeight: 20, clientHeight: 20 })).toBe(false);
  expect(cutOff({ scrollWidth: 300, clientWidth: 300, scrollHeight: 60, clientHeight: 40 })).toBe(true);
  expect(cutOff({ scrollWidth: 301, clientWidth: 300, scrollHeight: 20, clientHeight: 20 })).toBe(false); // subpixel
});

test("the full text lays over the cut one, kept inside the window", () => {
  expect(expandAt({ left: 100, top: 50 }, { width: 200 }, 1280)).toEqual({ left: 100, top: 50 });
  expect(expandAt({ left: 1200, top: 50 }, { width: 200 }, 1280)).toEqual({ left: 1072, top: 50 });
});

test("a pop-up opens with the current choice over the button, never off the top of the window", () => {
  // trigger at 300, list placed below at 336, the ticked row 120 down the list
  expect(popUpShift({ triggerTop: 300, triggerHeight: 30, listTop: 336, rowTop: 456, rowHeight: 28 })).toBe(-155);
  expect(popUpShift({ triggerTop: 60, triggerHeight: 30, listTop: 96, rowTop: 400, rowHeight: 28 })).toBe(-88);
  // Flipped above the button, the row sits above it: the list moves down, but never past the window's foot.
  expect(popUpShift({ triggerTop: 700, triggerHeight: 30, listTop: 420, rowTop: 440, rowHeight: 28, listHeight: 276, viewport: 720 })).toBe(16);
});

test("small buttons take a click a few pixels above and below what they draw", () => {
  const css = src("styles.css");
  // Only the player's one row of controls takes the bigger click: stacked buttons would take each other's.
  expect(css).toMatch(/:where\(\.controls \.ctl\)::after \{[^}]*inset: -4px 0[^}]*\}/);
});

test("a quick click on a Settings pop-up never picks the row moved under the pointer", () => {
  // Radix picks a row on a pointer-up it never saw go down; the shift puts the ticked row under the pointer.
  expect(src("Settings.tsx")).toMatch(/onPointerUp=\{\(e\) => performance\.now\(\) - opened\.current < 300 && e\.preventDefault\(\)\}/);
  expect(src("Settings.tsx")).toContain("box.height / list.current.offsetHeight");
});

test("the full text never shows beside a control's own hint", () => {
  expect(src("styles.css")).toContain("body:has(.hint) .full-text { display: none; }");
});
