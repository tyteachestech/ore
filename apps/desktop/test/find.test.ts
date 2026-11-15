import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const w = new Window();
for (const k of ["document", "NodeFilter", "HTMLElement", "Node"] as const) (globalThis as Record<string, unknown>)[k] = (w as unknown as Record<string, unknown>)[k];
const { findAll, findRanges, fold, search } = await import("../src/Find");

describe("find in source", () => {
  test("folding keeps every offset", () => {
    expect(fold("Don’t Stop")).toBe("don't stop");
    expect(fold("İx").length).toBe(2);
    expect(fold("A\tB\u00a0C\n“D”")).toBe('a b c "d"');
  });

  test("matches ignore case and do not overlap", () => {
    expect(findAll("Aaa aa", "aa")).toEqual([0, 4]);
    expect(findAll("Spacing", "  ")).toEqual([]);
    expect(findAll("it’s fine", "it's")).toEqual([0]);
  });

  test("an accent typed as its own mark and one typed with its letter find each other (Codex sweep 4)", () => {
    const hay = "άλφα and α\u0301λφα, cà phê and ca\u0300 phê";
    expect(findRanges(hay, "άλφα")).toEqual([[0, 4], [9, 14]]);
    expect(findRanges(hay, "α\u0301λφα")).toEqual([[0, 4], [9, 14]]);
    expect(findRanges(hay, "cà phê").length).toBe(2);
    const p = document.createElement("div");
    p.innerHTML = "<p>α\u0301λφα</p>";
    document.body.append(p as unknown as Node);
    expect(search([p as unknown as HTMLElement], "άλφα").map((r) => r.toString())).toEqual(["α\u0301λφα"]);
  });

  test("a match runs across inline marks, never across paragraphs, left pane before right", () => {
    const left = document.createElement("div");
    left.innerHTML = "<p>desirable <strong>diff</strong>iculties</p><p>end</p><p>start</p><button>end start</button>";
    const right = document.createElement("div");
    right.innerHTML = "<p>Desirable difficulties again</p>";
    document.body.append(left as unknown as Node, right as unknown as Node);
    const rs = search([left, right] as unknown as HTMLElement[], "desirable difficulties");
    expect(rs.map((r) => r.toString())).toEqual(["desirable difficulties", "Desirable difficulties"]);
    expect(rs[0]!.startContainer.parentNode).toBe(left.querySelector("p") as unknown as Node);
    expect(search([left] as unknown as HTMLElement[], "end start")).toEqual([]);
  });
});
