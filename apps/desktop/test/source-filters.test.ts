import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { kindLabel, NO_SKILL, options, passes, settled, summary, toggle, type Filter } from "../src/filters";
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

  test("All sources shows the Filter word and the tags in its search, and the empty list says so", () => {
    const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
    expect(app).toContain("<FilterButton items={tabAll}");
    expect(app).toContain("<FilterTags items={tabAll}");
    expect(app).toContain("matches these filters");
  });
});

describe("filters after review (D286)", () => {
  const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
  test("unticking a chip's last value keeps its list open until it closes", () => {
    const f = toggle([{ field: "author", values: ["Ana"] }], "author", "Ana", true);
    expect(f).toEqual([{ field: "author", values: [] }]);
    expect(summary(f[0]!, String)).toBe("any");
    expect(items.every((i) => passes(i, f))).toBe(true);
    expect(settled(f)).toEqual([]);
    expect(src("FilterBar.tsx")).toContain("onChange(toggle(filters, field!, o.value, true))");
  });
  test("an open course lists only its lessons the filters keep", () => {
    expect(src("App.tsx")).toContain("lessons.filter((l) => passes(l, filters))");
  });
  test("a filter that hides picked sources lets go of the pick", () => {
    expect(src("App.tsx")).toContain("}, [status, skill, q, openId, place, filters]);");
  });
  test("a closed chip builds no option list", () => {
    expect(src("FilterBar.tsx")).toContain("const opts = open && field ? options(");
  });
});

// Codex UX sweep 6: a deck, a spreadsheet, a notebook and an RTF file all read "Article", in the rows and in Kind.
test("a file that imports as an article shows and filters as what its kept original is", () => {
  const f = (id: string, file?: string) => ({ ...item(id, "article", []), source_file: file ? `/lib/items/${id}/source.${file}` : undefined }) as unknown as Item;
  const files = [f("deck", "pptx"), f("sheet", "csv"), f("nb", "ipynb"), f("doc", "rtf"), f("page", "html"), f("web")];
  expect(options(files, "kind", (s) => s).map((o) => o.label).sort()).toEqual(["Article", "Document", "Notebook", "Slides", "Spreadsheet"]);
  expect(files.filter((i) => passes(i, [{ field: "kind", values: ["slides"] }])).map((i) => i.id)).toEqual(["deck"]);
  expect(files.filter((i) => passes(i, [{ field: "kind", values: ["article"] }])).map((i) => i.id)).toEqual(["page", "web"]);
});
