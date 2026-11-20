import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { boldFontWeights } from "../src/phone/dynamic-type";

// Codex verify 2026-11-20 (F409 failed): Ore ran one setting behind Bold Text, and a title never got heavier.

test("Bold Text turned on in the Settings app shows in Ore once it is back, not one return later", async () => {
  // Back from the Settings app, the first answer is still the old setting; iOS hands over the new one a moment later.
  let bold = false;
  const root = { style: new Map<string, string>() };
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible", documentElement: { dataset: {}, style: { setProperty: (k: string, v: string) => root.style.set(k, v) } } });
  const was = (globalThis as any).document;
  (globalThis as any).document = doc;
  const { followAppearance } = await import("../src/phone/appearance");
  // Only Bold Text answers here; the light/dark question is left unanswered.
  followAppearance((async (cmd: string) => (cmd === "bold_text" ? bold : Promise.reject())) as never, true);
  await Bun.sleep(10);
  expect(root.style.get("--bold")).toBe("0");
  doc.dispatchEvent(new Event("visibilitychange")); // asked at once: still the old answer
  await Bun.sleep(10);
  bold = true; // iOS's new setting arrives
  await Bun.sleep(2000);
  (globalThis as any).document = was;
  expect(root.style.get("--bold")).toBe("1");
});

test("every Geist weight has a heavier face to step up to, so a bold title gets bolder too", () => {
  const faces = [...readFileSync(new URL("../src/retro.css", import.meta.url), "utf8").matchAll(/@font-face \{ font-family: "Geist"; src: url\("([^"]+)"\)[^}]*font-weight: (\d+)(?: (\d+))?;/g)].map((m) => ({ file: m[1], lo: Number(m[2]), hi: Number(m[3] ?? m[2]) }));
  const face = (w: number) => faces.find((f) => w >= f.lo && w <= f.hi)?.file;
  for (const w of [400, 500, 600, 700]) {
    const step = Number(boldFontWeights(`.a { font-weight: ${w} }`).match(/\* (\d+)\)/)![1]);
    expect({ w, bold: face(w + step) }).not.toEqual({ w, bold: face(w) });
  }
});
