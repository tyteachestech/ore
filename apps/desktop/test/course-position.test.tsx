import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import React from "react";
import type { Item } from "../src/ore";

// Render the actual shared component without starting a window or importing the whole Reader.
const reader = readFileSync(new URL("../src/Reader.tsx", import.meta.url), "utf8");
const start = reader.indexOf("function CourseLine(");
const fn = reader.slice(start, reader.indexOf("\n}", start) + 2);
const code = new Bun.Transpiler({ loader: "tsx", tsconfig: { compilerOptions: { jsx: "react" } } }).transformSync(`${fn}\nreturn CourseLine;`);
const pass = ({ children }: { children: React.ReactNode }) => children;
const menu = new Proxy({}, { get: () => pass });
const view = new Function("React", "DropdownMenu", "Hint", "CaretDown", "Check", "CaretLeft", "CaretRight", code)(React, menu, pass, pass, pass, pass, pass);
const lesson = (part: number): Item => ({ id: `lesson-${part}`, title: `Lesson ${part}`, dir: "", captured_at: "2026-11-24", type: "article", status: "inbox", skills: [], course: { id: "c", title: "Course", part } });
function find(node: React.ReactNode, match: (p: Record<string, unknown>) => boolean): React.ReactElement<Record<string, unknown>> | undefined {
  if (!React.isValidElement<Record<string, unknown>>(node)) return;
  if (match(node.props)) return node;
  for (const child of React.Children.toArray(node.props.children as React.ReactNode)) {
    const got = find(child, match);
    if (got) return got;
  }
}
for (const parts of [[1, 2, 3], [2, 3], [1, 3], [4, 9]]) {
  test(`reader course position and navigation use the same visible lessons: ${parts}`, () => {
    const lessons = parts.map(lesson);
    const item = lessons.at(-1)!;
    let opened = "";
    const tree = view({ id: item.id, course: item.course, lessons, onOpen: (id: string) => { opened = id; } });
    const label = React.Children.toArray(find(tree, (p) => p.className === "course-at")!.props.children as React.ReactNode).join("").replace(/\s+/g, " ").trim();
    expect(label).toBe(`Lesson ${lessons.length} of ${lessons.length}`);
    const prev = find(tree, (p) => p["aria-label"] === "Previous lesson")!;
    (prev.props.onClick as () => void)();
    expect(opened).toBe(lessons.at(-2)!.id);
    expect(find(tree, (p) => p["aria-label"] === "Next lesson")!.props.disabled).toBe(true);
  });
}
test("an archived source absent from the active lessons has no course position", () => {
  const item = lesson(1);
  expect(view({ id: item.id, course: item.course, lessons: [lesson(2), lesson(3)], onOpen() {} })).toBeNull();
});
