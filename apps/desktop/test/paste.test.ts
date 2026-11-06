import { describe, expect, test } from "bun:test";
import { addArgs, copiedEntry, copiedWhat, dropPoint, entries, fileKind, manyAdded } from "../src/paste";

test("a list's toast counts only what went in", () => {
  expect(manyAdded(3, 0)).toBe("Added 3 sources");
  expect(manyAdded(2, 1)).toBe("Added 1 source; 1 was already here");
  expect(manyAdded(2, 2)).toBe("All 2 are already here");
  expect(fileKind("/a/notes.text")).toBe("note");
});

describe("add box entries", () => {
  test("links, bare domains and file paths", () => {
    expect(entries("  https://example.com/a?b=1 ")).toEqual([{ kind: "link", url: "https://example.com/a?b=1" }]);
    expect(entries("www.nytimes.com/2026/story")).toEqual([{ kind: "link", url: "https://www.nytimes.com/2026/story" }]);
    expect(entries("/Users/t/Books/Story Genius.epub")).toEqual([{ kind: "file", path: "/Users/t/Books/Story Genius.epub" }]);
    expect(entries("file:///Users/t/My%20Essay.pdf")).toEqual([{ kind: "file", path: "/Users/t/My Essay.pdf" }]);
  });

  test("a list of links is one source each; anything mixed is text", () => {
    expect(entries("https://a.com\n\nwww.b.org\n")).toHaveLength(2);
    expect(entries("Read this: https://a.com")).toEqual([{ kind: "text", text: "Read this: https://a.com" }]);
    expect(entries("https://a.com\nwhy it matters")).toEqual([{ kind: "text", text: "https://a.com\nwhy it matters" }]);
    expect(entries("Hello.")).toEqual([{ kind: "text", text: "Hello." }]);
    expect(entries("notes.docx")).toEqual([{ kind: "text", text: "notes.docx" }]);
    expect(entries(" \n ")).toEqual([]);
  });

  test("text goes to ore add on stdin", () => {
    expect(addArgs({ kind: "text", text: "x" })).toEqual({ args: ["add", "--stdin"], stdin: "x" });
    expect(addArgs({ kind: "file", path: "/a.pdf" })).toEqual({ args: ["add", "/a.pdf"], stdin: null });
    expect(addArgs({ kind: "tab" })).toEqual({ args: ["add", "--tab"], stdin: null });
  });
});

describe("file drop position", () => {
  test("macOS reports CSS points already, even on a 2x Retina screen", () => {
    expect(dropPoint({ x: 120, y: 340 }, true, 2)).toEqual({ x: 120, y: 340 });
  });
  test("other platforms report device pixels", () => {
    expect(dropPoint({ x: 240, y: 680 }, false, 2)).toEqual({ x: 120, y: 340 });
  });
});

describe("course links (D79)", () => {
  test("a Claude Academy course or lesson and a YouTube playlist add every lesson; a video or other page adds one source", () => {
    expect(addArgs({ kind: "link", url: "https://academy.claude.com/courses/ai-fluency-framework-foundations" }).args).toEqual(["add", "https://academy.claude.com/courses/ai-fluency-framework-foundations", "--course"]);
    expect(addArgs({ kind: "link", url: "https://academy.claude.com/courses/ai-fluency-framework-foundations/the-4d-framework" }).args).toContain("--course");
    expect(addArgs({ kind: "link", url: "https://www.youtube.com/playlist?list=PL123" }).args).toContain("--course");
    expect(addArgs({ kind: "link", url: "https://www.youtube.com/watch?v=W4Ua6XFfX9w&list=PL123" }).args).not.toContain("--course");
    expect(addArgs({ kind: "link", url: "https://academy.claude.com/" }).args).not.toContain("--course");
  });
});

test("fileKind names what a dropped file becomes", () => {
  expect(["/a/b.PDF", "/a/b.epub", "/a/b.md", "/a/b.txt", "/a/b.htm", "/a/b.docx", "/a/b.pptx", "/a/b.ipynb", "/a/b.png", "/a/b.MOV", "/a/noext"].map(fileKind)).toEqual(["pdf", "book", "note", "note", "page", "note", "page", "note", "image", "video", null]);
});

describe("copied link offered in the add box", () => {
  test("one link or a file Ore reads", () => {
    expect(copiedEntry("https://www.youtube.com/watch?v=abc", [])).toEqual({ kind: "link", url: "https://www.youtube.com/watch?v=abc" });
    expect(copiedEntry("file:///Users/t/Downloads/paper.pdf", [])).toEqual({ kind: "file", path: "/Users/t/Downloads/paper.pdf" });
  });
  test("never text, a list, a file it can't read, or nothing", () => {
    expect(copiedEntry("remember to buy milk", [])).toBeNull();
    expect(copiedEntry("https://a.com\nhttps://b.com", [])).toBeNull();
    expect(copiedEntry("file:///Users/t/app.dmg", [])).toBeNull();
    expect(copiedEntry(null, [])).toBeNull();
    expect(copiedEntry("", [])).toBeNull();
  });
  test("not a link already in the library, nor one core refuses", () => {
    expect(copiedEntry("https://example.com/post", ["https://example.com/post"])).toBeNull();
    expect(copiedEntry("https://x.com/someone/status/123", [])).toBeNull();
    expect(copiedEntry("https://podcasts.apple.com/us/podcast/show/id123", [])).toBeNull();
    expect(copiedEntry("https://podcasts.apple.com/us/podcast/ep/id123?i=456", [])).not.toBeNull();
  });
  test("says what it is", () => {
    expect(copiedWhat({ kind: "link", url: "https://youtu.be/abc" })).toBe("video");
    expect(copiedWhat({ kind: "link", url: "https://www.youtube.com/playlist?list=PL1" })).toBe("course");
    expect(copiedWhat({ kind: "link", url: "https://arxiv.org/pdf/2401.1.pdf" })).toBe("PDF");
    expect(copiedWhat({ kind: "link", url: "https://example.com" })).toBe("link");
    expect(copiedWhat({ kind: "file", path: "/a/b.epub" })).toBe("book");
  });
});
