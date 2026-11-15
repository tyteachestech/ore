import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { keyInput } from "../src/input-mode";

// D280: a popup opened with the pointer grows from its trigger; the keyboard never animates one.
test("a key press turns key input on, a pointer press turns it off", () => {
  expect(keyInput(false, { type: "keydown", key: "ArrowDown" })).toBe(true);
  expect(keyInput(true, { type: "pointerdown" })).toBe(false);
  expect(keyInput(true, { type: "keydown", key: "Escape" })).toBe(true);
});

test("a modifier held for a click is not a key press", () => {
  for (const key of ["Meta", "Shift", "Alt", "Control"]) expect(keyInput(false, { type: "keydown", key })).toBe(false);
  expect(keyInput(true, { type: "keydown", key: "Shift" })).toBe(true);
});

const css = readFileSync(join(import.meta.dir, "../src/styles.css"), "utf8");
test("popups grow from their trigger, only for the pointer, and not under Reduce Motion", () => {
  expect(css).toMatch(/\.popover\[data-state\][^{]*\{[^}]*transform-origin: var\(--radix-popper-transform-origin\)/);
  const moving = [...css.matchAll(/([^{}]*)\{[^{}]*animation: pop-[a-z]+[^{}]*\}/g)].map((m) => m[1]!.trim());
  expect(moving.length).toBe(1);
  for (const selector of moving) expect(selector).toStartWith(":root:not([data-keys]) .popover");
  expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.popover\[data-state\] \{ animation: none !important; \} \}/);
});

test("a closing popup has no exit animation to strand it open", () => {
  // Radix keeps a closing popup mounted until its exit animation ends. One gated on data-keys loses its
  // animation when a key is pressed mid-close, so animationend never comes and the popup stays (F200).
  expect(css).not.toMatch(/\.popover\[data-state="closed"\][^{]*\{[^}]*animation: pop/);
});
