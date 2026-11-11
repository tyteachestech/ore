import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { readdirSync, readFileSync } from "node:fs";

// 2026-11-11: an undone highlight stayed tinted on the Mac, and clicking it cleared it in chunks.
// WebKit repaints only a highlight's new ranges, so paint.ts repaints the blocks a range leaves.
const w = new Window();
const g = globalThis as Record<string, unknown>;
for (const k of ["document", "Node", "Element", "Range", "getComputedStyle"] as const) g[k] = (w as unknown as Record<string, unknown>)[k];
class FakeHighlight extends Set<AbstractRange> {
  priority = 0;
  constructor(...rs: AbstractRange[]) {
    super(rs);
  }
}
g.Highlight = FakeHighlight;
g.CSS = { highlights: new Map<string, FakeHighlight>() };
const frames: FrameRequestCallback[] = [];
g.requestAnimationFrame = (f: FrameRequestCallback) => frames.push(f);
const flush = () => {
  while (frames.length) frames.shift()!(0);
};
const { paint, unpaint } = await import("../src/paint");

document.body.innerHTML = "<article><p id=a>The so-called <strong>logicist</strong> tradition</p><p id=b>within AI</p></article>";
const range = (id: string) => {
  const r = document.createRange();
  r.selectNodeContents(document.querySelector(`#${id} strong`) ?? document.getElementById(id)!);
  return r;
};

test("a range that leaves a highlight repaints its block for a frame; one that stays doesn't", () => {
  const a = range("a");
  const b = range("b");
  paint("hl-keep", [a, b], 1);
  expect(document.querySelectorAll(".repaint").length).toBe(0);
  expect((CSS.highlights.get("hl-keep") as unknown as FakeHighlight).priority).toBe(1);
  paint("hl-keep", [b], 1); // the undo
  expect([...CSS.highlights.get("hl-keep")!]).toEqual([b]);
  // The paragraph, not the <strong> the range sits in: the tint reaches past an inline's box.
  expect([...document.querySelectorAll(".repaint")].map((e) => e.id)).toEqual(["a"]);
  flush();
  expect(document.querySelectorAll(".repaint").length).toBe(0);
});

test("unpaint deletes the highlight and repaints all it covered", () => {
  paint("hl-active", [range("a"), range("b")]);
  unpaint("hl-active");
  expect(CSS.highlights.has("hl-active")).toBe(false);
  expect([...document.querySelectorAll(".repaint")].map((e) => e.id)).toEqual(["a", "b"]);
  flush();
});

test("nothing in the app sets or deletes a highlight except through paint.ts", () => {
  const dir = `${import.meta.dir}/../src`;
  const files = readdirSync(dir, { recursive: true }).map(String).filter((f) => /\.tsx?$/.test(f) && f !== "paint.ts");
  const direct = files.filter((f) => /CSS\.highlights\.(set|delete|clear)\(/.test(readFileSync(`${dir}/${f}`, "utf8")));
  expect(direct).toEqual([]);
});
