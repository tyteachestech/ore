import { describe, expect, test } from "bun:test";
import { lessonsOf, nextLesson, searchFields, type Item } from "../src/ore";
import { rankScore } from "../src/match";

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

  test("filtering the list by a course's title finds its lessons (⌘F), as ⌘K does", () => {
    const finds = (i: Item, q: string) => rankScore(searchFields(i), q) > 0;
    expect(finds(lesson("Lesson 3: Prompts", 3, "inbox"), "ai fluency")).toBe(true);
    expect(finds(lesson("Lesson 3: Prompts", 3, "inbox"), "prompts")).toBe(true);
    expect(finds(source("Other", "inbox"), "ai fluency")).toBe(false);
  });

  test("a site is searched by its name, not its .com, which every web page shares", () => {
    const page = source("Other", "inbox");
    expect(rankScore(searchFields(page, "nytimes.com"), "nytimes")).toBeGreaterThan(0);
    expect(rankScore(searchFields(page, "nytimes.com"), "com")).toBe(0);
  });
});
