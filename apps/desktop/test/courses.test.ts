import { describe, expect, test } from "bun:test";
import { lessonsOf, nextLesson, tabCount, type Item } from "../src/ore";

const lesson = (id: string, part: number, status: Item["status"], course = "c1"): Item => ({
  id, type: "youtube", title: id, dir: "", captured_at: "2026-10-28T00:00:00Z", status, skills: ["ai"], course: { id: course, title: "AI Fluency", part },
});
const source = (id: string, status: Item["status"]): Item => ({ id, type: "article", title: id, dir: "", captured_at: "2026-10-28T00:00:00Z", status, skills: [] });

describe("courses in lists (D79)", () => {
  test("lessons sort by part, and the next one is the first not done", () => {
    const items = [lesson("c", 3, "inbox"), lesson("a", 1, "done"), lesson("b", 2, "reading"), lesson("x", 1, "inbox", "c2")];
    expect(lessonsOf(items, "c1").map((l) => l.id)).toEqual(["a", "b", "c"]);
    expect(nextLesson(lessonsOf(items, "c1"))?.id).toBe("b");
    expect(nextLesson([lesson("a", 1, "done")])).toBeNull();
  });

  test("a course counts once: in To read while a lesson is left, in Done once all are", () => {
    const open = [lesson("a", 1, "done"), lesson("b", 2, "inbox"), source("s", "reading"), source("t", "done")];
    expect(tabCount(open, "toread")).toBe(2);
    expect(tabCount(open, "done")).toBe(1);
    const finished = [lesson("a", 1, "done"), lesson("b", 2, "done")];
    expect(tabCount(finished, "toread")).toBe(0);
    expect(tabCount(finished, "done")).toBe(1);
  });
});
