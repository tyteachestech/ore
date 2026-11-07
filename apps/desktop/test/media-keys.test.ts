import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { ownsMediaKey } from "../src/media-keys";

// Space on a focused video control presses it instead of playing or pausing (bug sweep 36).
describe("video keys on a focused control", () => {
  const doc = new Window().document;
  doc.body.innerHTML = `<div class="video"><button id="preset">1.5×</button><span role="slider" id="scrub"></span><p id="text">words</p></div>`;
  const el = (id: string) => doc.getElementById(id) as unknown as Element;
  test("a button keeps Space, the player keeps its other keys", () => {
    expect(ownsMediaKey(el("preset"), " ")).toBe(true);
    expect(ownsMediaKey(el("preset"), "ArrowRight")).toBe(false);
  });
  test("a slider keeps every key; text leaves them all to the player", () => {
    expect(ownsMediaKey(el("scrub"), "ArrowRight")).toBe(true);
    expect(ownsMediaKey(el("text"), " ")).toBe(false);
  });
});
