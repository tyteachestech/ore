import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import * as ore from "../src/ore";
import * as lines from "../src/lines";
import { passes, type Filter } from "../src/filters";

// Use each screen's actual adapter; the shared grouping helper is injected when present.
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const phone = readFileSync(new URL("../src/phone/PhoneApp.tsx", import.meta.url), "utf8");
const macBody = app.split("const groups = useMemo((): Line[][] => {")[1]!.split("}, [tabRows, inSkill, status, openCourses, filters]);")[0]!;
const phoneFn = phone.slice(phone.indexOf("function linesOf("), phone.indexOf("/** A course as one row"));
const env = { ...ore, ...lines, passes };
const compile = (code: string) => new Function(...Object.keys(env), new Bun.Transpiler({ loader: "ts" }).transformSync(code))(...Object.values(env));
const mac = compile(`return function(inSkill, tabRows, status, openCourses, filters) {${macBody}}`);
const mobile = compile(`${phoneFn}\nreturn linesOf;`);
const base = { skills: [], captured_at: "2026-11-01T00:00:00Z", dir: "", author: "Teacher" };
const items: ore.Item[] = [
  { ...base, id: "video", title: "Video", type: "youtube", status: "done", course: { id: "c", title: "Course", part: 1 } },
  { ...base, id: "article", title: "Article", type: "article", status: "inbox", course: { id: "c", title: "Course", part: 2 } },
];
for (const filters of [[{ field: "kind", values: ["youtube"] }], [{ field: "author", values: ["Teacher"] }]] as Filter[][]) {
  test(`course ${filters[0]!.field} filters show matching lessons in their own tabs on both devices`, () => {
    const narrowed = items.filter((i) => passes(i, filters));
    for (const status of ["toread", "done"] as const) {
      const expected = narrowed.filter((i) => (i.status === "done") === (status === "done"));
      expect(mac(items, expected, status, [], filters).flat()).toEqual(expected.map((item) => ({ kind: "item", item })));
      expect(mobile(narrowed, status, filters)).toEqual(expected.map((item) => ({ kind: "item", item })));
    }
  });
}
test("unfiltered courses stay grouped until every lesson is done; Archive stays flat", () => {
  expect(mac(items, [items[1]], "toread", [], []).flat()[0]).toMatchObject({ kind: "course", id: "c", next: items[1] });
  expect(mobile(items, "toread")[0]).toMatchObject({ kind: "course", id: "c", next: items[1] });
  expect(mac(items, [items[0]], "done", [], []).flat()).toEqual([]);
  expect(mobile(items, "done")).toEqual([]);
  expect(mac(items, items, "archived", [], []).flat()).toEqual(items.map((item) => ({ kind: "item", item })));
});
