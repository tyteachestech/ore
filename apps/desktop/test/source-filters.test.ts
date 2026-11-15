import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { kindLabel, NO_SKILL, options, passes, summary, toggle, type Filter } from "../src/filters";
import type { Item } from "../src/ore";

const item = (id: string, type: string, skills: string[], author?: string) => ({ id, type, skills, author, title: id, dir: "", captured_at: "", status: "inbox" }) as unknown as Item;
const items = [item("a", "youtube", ["ai"], "Ana"), item("b", "pdf", ["ai", "learning"], "Sam"), item("c", "pdf", [], " Sam "), item("d", "article", ["learning"])];

describe("All sources filters (D286)", () => {
  test("values in a field widen, fields narrow together", () => {
    const f: Filter[] = [{ field: "kind", values: ["pdf", "youtube"] }];
    expect(items.filter((i) => passes(i, f)).map((i) => i.id)).toEqual(["a", "b", "c"]);
    const g: Filter[] = [...f, { field: "author", values: ["Sam"] }];
    expect(items.filter((i) => passes(i, g)).map((i) => i.id)).toEqual(["b", "c"]);
  });

  test("unfiled sources are found under No skill", () => {
    expect(items.filter((i) => passes(i, [{ field: "skill", values: [NO_SKILL] }])).map((i) => i.id)).toEqual(["c"]);
    expect(options(items, "skill", (id) => id.toUpperCase()).map((o) => `${o.label} ${o.n}`)).toEqual(["AI 2", "LEARNING 2", "No skill 1"]);
  });

  test("a field's values list most sources first, an author without one left out", () => {
    expect(options(items, "author", String).map((o) => `${o.label} ${o.n}`)).toEqual(["Sam 2", "Ana 1"]);
    expect(options(items, "kind", String).map((o) => o.label)).toEqual(["PDF", "Article", "Video"]);
    expect(kindLabel("epub")).toBe("Book");
  });

  test("picking toggles, and a field with nothing picked goes", () => {
    let f = toggle([], "kind", "pdf");
    f = toggle(f, "kind", "epub");
    expect(f).toEqual([{ field: "kind", values: ["pdf", "epub"] }]);
    expect(summary(f[0]!, kindLabel)).toBe("2 kinds");
    f = toggle(toggle(f, "kind", "pdf"), "kind", "epub");
    expect(f).toEqual([]);
    expect(summary({ field: "kind", values: ["epub"] }, kindLabel)).toBe("Book");
  });

  test("All sources shows the button and the chips, and the empty list says so", () => {
    const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    expect(app).toContain("<FilterButton items={tabAll}");
    expect(app).toContain("<FilterChips items={tabAll}");
    expect(app).toContain("matches these filters");
  });
});
