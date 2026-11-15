import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { MAX_TYPE, scaleFontSizes, typeScale } from "../src/phone/dynamic-type";

// F70: the phone app follows the iPhone's text size. Its CSS sizes text times --type, set from iOS's body size.
describe("the iPhone's text size", () => {
  test("every fixed font size and line height follows --type; relative ones are left alone", () => {
    const css = `.a { font-size: 13px; } .b { font: 600 13px/18px var(--font); } .c { line-height: 20px }
      .d { font-size: 0.9em; line-height: 1.6 } .e { --note-size: 14px; font-size: var(--note-size) } .f { --th: 1.4em }
      .g { font-size: var(--read-size, 17px) } .h { font-size: 11px !important }`;
    expect(scaleFontSizes(css)).toBe(`.a { font-size: calc(13px * var(--type, 1)); } .b { font: 600 calc(13px * var(--type, 1))/calc(18px * var(--type, 1)) var(--font); } .c { line-height: calc(20px * var(--type, 1)) }
      .d { font-size: 0.9em; line-height: 1.6 } .e { --note-size: calc(14px * var(--type, 1)); font-size: var(--note-size) } .f { --th: 1.4em }
      .g { font-size: calc(var(--read-size, 17px) * var(--type, 1)) } .h { font-size: calc(11px * var(--type, 1)) !important }`);
  });

  test("the app's own CSS has no fixed font size left over", () => {
    for (const f of ["styles.css", "retro.css"]) {
      const out = scaleFontSizes(readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8"));
      const fixed = [...out.matchAll(/(?:font-size|line-height)\s*:\s*([^;}]*\d(?:px|pt)\b[^;}]*)/g)].map((m) => m[1]).filter((v) => !v.includes("var(--type"));
      expect({ f, fixed }).toEqual({ f, fixed: [] });
      expect(scaleFontSizes(out)).toBe(out); // twice changes nothing
    }
  });

  test("a title grows less than body text, as iOS's Large Title does", () => {
    expect(scaleFontSizes(".m { font-size: max(30px, 2em) }")).toContain("* 0.47");
    expect(scaleFontSizes(".i { --icon-size: 20px }")).toBe(".i { --icon-size: 20px }");
    expect(scaleFontSizes(".t { font-size: 34px }")).toBe(".t { font-size: calc(34px * (1 + (var(--type, 1) - 1) * 0.47)) }");
    const at = (type: number) => 34 * (1 + (type - 1) * 0.47);
    expect(Math.round(at(23 / 17))).toBe(40);
    expect(Math.round(at(28 / 17))).toBe(44);
  });

  test("the scale is iOS's body size over 17pt, up to the first accessibility size", () => {
    expect(typeScale(17)).toBe(1);
    expect(typeScale(14)).toBe(0.824);
    expect(typeScale(23)).toBe(1.353);
    expect(typeScale(53)).toBe(Math.round(MAX_TYPE * 1000) / 1000);
    expect(typeScale(undefined)).toBe(1);
  });
  // F310: the phone read a source in the Mac's 17px, about 43 letters a line, smaller and longer than Books.
  test("a source on the iPhone reads at 20px on 24px margins, and at every iOS text size no smaller than iOS's own body", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    const [, base, share] = css.match(/\.phone \.doc \{ font-size: calc\(var\(--read-size, (\d+)px\) \* \(1 \+ \(var\(--type, 1\) - 1\) \* ([\d.]+)\)\)/) ?? [];
    const [, gutter, floor, give] = css.match(/\.phone \{ --gutter: (\d+)px; --gutter-min: (\d+)px; --read-gutter: max\(var\(--gutter-min\), calc\(var\(--gutter\) - \(var\(--type, 1\) - 1\) \* (\d+)px\)\)/) ?? [];
    expect({ base, gutter }).toEqual({ base: "20", gutter: "24" });
    const size = (type: number) => Number(base) * (1 + (type - 1) * Number(share));
    const column = (type: number, phone: number) => phone - 2 * Math.max(Number(floor), Number(gutter) - (type - 1) * Number(give));
    for (const body of [14, 15, 16, 17, 19, 21, 23, 28]) expect(size(typeScale(body))).toBeGreaterThanOrEqual(body);
    // Charter sets about 0.455 of its size a letter on iOS: 30 to 40 letters fill a line at the default size, and
    // the largest size still fits 25 (Dyson & Haselgrove 2001: lines of 25 read slowest).
    const letters = (type: number, phone: number) => column(type, phone) / (size(type) * 0.455);
    for (const phone of [390, 402]) {
      expect(letters(1, phone)).toBeGreaterThan(30);
      expect(letters(1, phone)).toBeLessThan(40);
      expect(letters(MAX_TYPE, phone)).toBeGreaterThan(25);
    }
  });
});
