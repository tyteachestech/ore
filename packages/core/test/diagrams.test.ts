import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatScene, getDiagram, linkDiagram, newDiagram, parseScene, renameDiagram, setDiagram } from "../src/diagrams.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { getNotes, setNotes } from "../src/notes.ts";
import { tempLibrary } from "./helpers.ts";

const scene = (n: number) =>
  JSON.stringify({ type: "excalidraw", version: 2, source: "test", elements: Array.from({ length: n }, (_, i) => ({ id: `e${i}`, type: "rectangle" })), appState: {}, files: {} }, null, 2);

describe("diagrams in My notes (D40)", () => {
  test("rename moves the file and refuses a name in use (D103)", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Spacing beats massing." });
    await setDiagram(lib, item.meta.id, "diagram-1", scene(1));
    await setDiagram(lib, item.meta.id, "diagram-2", scene(1));
    const r = await renameDiagram(lib, item.meta.id, "diagram-1", "spacing-map");
    expect(r.path).toEndWith("/diagrams/spacing-map.excalidraw");
    expect(getDiagram(lib, item.meta.id, "diagram-1").scene).toBeNull();
    expect(renameDiagram(lib, item.meta.id, "spacing-map", "diagram-2")).rejects.toThrow("already exists");
  });

  test("link adds the diagram at the note's end once, and a note save from before it merges it in", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "x" });
    await setNotes(lib, item.meta.id, "Idea.\n");
    expect(linkDiagram(lib, item.meta.id, "diagram-1")).rejects.toThrow("no diagram named diagram-1");
    await setDiagram(lib, item.meta.id, "diagram-1", scene(1));
    await linkDiagram(lib, item.meta.id, "diagram-1");
    const r = await linkDiagram(lib, item.meta.id, "diagram-1");
    expect(r.text).toBe("Idea.\n\n![Diagram](diagrams/diagram-1.excalidraw)\n");
    // The note he left saves its last words, edited from the text before the link.
    await setNotes(lib, item.meta.id, "Idea. More.\n", "Idea.\n");
    expect(getNotes(lib, item.meta.id).text.match(/diagram-1\.excalidraw/g)).toHaveLength(1);
  });

  test("an undone rename moves the file back onto the name the note links again", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "x" });
    await setDiagram(lib, item.meta.id, "diagram-1", scene(2));
    await setNotes(lib, item.meta.id, "![Diagram](diagrams/diagram-1.excalidraw)\n");
    await renameDiagram(lib, item.meta.id, "diagram-1", "map");
    // The note still links diagram-1 (its save is behind, or the undo already reached it).
    expect(renameDiagram(lib, item.meta.id, "map", "diagram-1")).rejects.toThrow("already exists");
    await renameDiagram(lib, item.meta.id, "map", "diagram-1", { followLink: true });
    expect(getDiagram(lib, item.meta.id, "diagram-1").scene?.elements).toHaveLength(2);
    expect(getDiagram(lib, item.meta.id, "map").scene).toBeNull();
  });

  test("round-trips a scene under diagrams/, written one element per line", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Spacing beats massing." });
    expect(getDiagram(lib, item.meta.id, "diagram-1").scene).toBeNull();
    const r = await setDiagram(lib, item.meta.id, "diagram-1", scene(2));
    expect(r.path).toEndWith("/diagrams/diagram-1.excalidraw");
    const file = readFileSync(join(lib.root, r.path), "utf8");
    expect(file.split("\n")).toEqual([
      '{"type":"excalidraw","version":2,"source":"test","appState":{},"files":{},"elements":[',
      '{"id":"e0","type":"rectangle"},',
      '{"id":"e1","type":"rectangle"}',
      "]}",
      "",
    ]);
    expect(parseScene(file)).toEqual(JSON.parse(scene(2)));
    expect(getDiagram(lib, item.meta.id, "diagram-1").scene?.elements).toHaveLength(2);
  });

  test("an empty scene stays valid JSON", () => {
    const s = parseScene(scene(0));
    expect(parseScene(formatScene(s))).toEqual(s);
  });

  test("--new skips names that have a file or a link in notes.md", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "x" });
    expect(newDiagram(lib, item.meta.id).name).toBe("diagram-1");
    await setDiagram(lib, item.meta.id, "diagram-1", scene(1));
    await setNotes(lib, item.meta.id, "Idea.\n\n![Diagram](diagrams/diagram-2.excalidraw)\n");
    const r = newDiagram(lib, item.meta.id);
    expect(r).toMatchObject({ name: "diagram-3", scene: null });
    expect(getDiagram(lib, item.meta.id, "diagram-3").scene).toBeNull();
  });

  test("a skill note keeps its diagrams beside it (D41)", async () => {
    const lib = await tempLibrary();
    const r = await setDiagram(lib, { skill: "learning" }, "diagram-1", scene(1));
    expect(r).toMatchObject({ skill: "learning", path: "skills/learning/diagrams/diagram-1.excalidraw" });
    expect(getDiagram(lib, { skill: "learning" }, "diagram-1").scene?.elements).toHaveLength(1);
    expect(newDiagram(lib, { skill: "learning" }).name).toBe("diagram-2");
    expect(() => newDiagram(lib, { skill: "nope" })).toThrow("unknown skill");
  });

  test("rejects bad names, non-JSON and non-scene input", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "x" });
    await expect(setDiagram(lib, item.meta.id, "../notes", scene(1))).rejects.toThrow("kebab-case");
    await expect(setDiagram(lib, item.meta.id, "d", "nope")).rejects.toThrow("not JSON");
    await expect(setDiagram(lib, item.meta.id, "d", '{"type":"other","elements":[]}')).rejects.toThrow("Excalidraw scene");
  });
});
