import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { byTime, sectionAt, tipX, topLevel } from "../src/sections";

describe("scrubber sections (D285)", () => {
  const parts = byTime([
    { t: 300, title: "Spacing" },
    { t: 0, title: "Intro" },
    { t: 300, title: "Same moment" },
    { t: 90, title: "" },
    { t: 120, title: "Retrieval" },
  ]);

  test("sections are in time order, one per moment, none untitled", () => {
    expect(parts.map((p) => p.title)).toEqual(["Intro", "Retrieval", "Spacing"]);
  });

  test("hovering names the section playing at that time", () => {
    expect(sectionAt(parts, 0)).toBe("Intro");
    expect(sectionAt(parts, 119)).toBe("Intro");
    expect(sectionAt(parts, 120)).toBe("Retrieval");
    expect(sectionAt(parts, 9999)).toBe("Spacing");
    expect(sectionAt([{ t: 30, title: "Late" }], 10)).toBeUndefined();
  });

  test("only the outermost heading level cuts the bar", () => {
    expect(topLevel([3, 2, 4, 2])).toBe(2);
    expect(topLevel([])).toBe(0);
  });

  test("the tip stays whole inside the bar", () => {
    expect(tipX(5, 600, 100)).toBe(50);
    expect(tipX(300, 600, 100)).toBe(300);
    expect(tipX(590, 600, 100)).toBe(550);
  });

  test("the cuts and tip are drawn, and the player passes the sections", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.scrub-cut \{[^}]*background: var\(--bg\)/);
    expect(css).toMatch(/\.scrub-tip \{[^}]*pointer-events: none/);
    const reader = readFileSync(new URL("../src/Reader.tsx", import.meta.url), "utf8");
    expect(reader.match(/sections=\{talkParts\}/g)?.length).toBe(2);
  });
});
