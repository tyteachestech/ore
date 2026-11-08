import { expect, test } from "bun:test";
import { lineAfter, lineKey, type Line } from "../src/lines";
import type { Item } from "../src/ore";

const item = (id: string, course?: string): Item => ({
  id, type: "youtube", title: id, dir: "", captured_at: "2026-10-28T00:00:00Z", status: "inbox", skills: [], ...(course && { course: { id: course, title: "AI Fluency", part: 1 } }),
});
const lessons = [item("l1", "c1"), item("l2", "c1")];
const course = (open: boolean): Line => ({ kind: "course", id: "c1", title: "AI Fluency", lessons, next: lessons[0]!, open });
const row = (i: Item, lesson?: boolean): Line => ({ kind: "item", item: i, ...(lesson && { lesson }) });
const open: Line[] = [row(item("a")), course(true), row(lessons[0]!, true), row(lessons[1]!, true), row(item("b"))];

test("a row that leaves the list hands the selection to the row after it", () => {
  const now = open.filter((l) => lineKey(l) !== "a");
  expect(lineKey(lineAfter(open, now, "a")!)).toBe("course:c1");
  expect(lineKey(lineAfter(open, open.filter((l) => lineKey(l) !== "l1"), "l1")!)).toBe("l2");
});

test("a selected lesson whose course is collapsed hands the selection to its course, not past it", () => {
  const shut: Line[] = [row(item("a")), course(false), row(item("b"))];
  expect(lineKey(lineAfter(open, shut, "l1")!)).toBe("course:c1");
  expect(lineKey(lineAfter(open, shut, "l2")!)).toBe("course:c1");
});
