import { existsSync, readFileSync, renameSync } from "node:fs";
import { join, relative } from "node:path";
import { writeAtomic } from "./fsutil.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";
import { getNotes, type NoteRef, type NotesResult } from "./notes.ts";

// Diagrams in a note (D40): diagrams/<name>.excalidraw beside My notes or a skill note,
// Excalidraw JSON, linked from notes.md as ![Diagram](diagrams/<name>.excalidraw).
// The app writes them only through `ore diagram` (D30).
export const diagramPath = (noteDir: string, name: string) => join(noteDir, "diagrams", `${name}.excalidraw`);

export type Scene = { type: "excalidraw"; elements: unknown[]; [k: string]: unknown };

export interface DiagramResult {
  item?: string;
  skill?: string;
  name: string;
  path: string; // relative to the library root
  scene: Scene | null; // null until first saved
}

function checkName(name: string): string {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 60) throw new Error(`diagram name must be a kebab-case slug: ${name}`);
  return name;
}

// Minimal schema check: an Excalidraw scene object with an elements array.
export function parseScene(text: string): Scene {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (e) {
    throw new Error(`diagram is not JSON: ${(e as Error).message}`);
  }
  const s = v as Record<string, unknown> | null;
  if (!s || typeof s !== "object" || s.type !== "excalidraw" || !Array.isArray(s.elements))
    throw new Error('diagram must be an Excalidraw scene ({"type":"excalidraw","elements":[…]})');
  return s as Scene;
}

// Compact JSON with one element per line, so a git diff shows only the elements that changed.
export function formatScene(scene: Scene): string {
  const { elements, ...rest } = scene;
  const list = elements.length ? `[\n${elements.map((e) => JSON.stringify(e)).join(",\n")}\n]` : "[]";
  return `${JSON.stringify(rest).slice(0, -1)},"elements":${list}}\n`;
}

const result = (lib: Library, note: NotesResult, name: string, scene: Scene | null): DiagramResult => ({
  ...(note.item ? { item: note.item } : { skill: note.skill }),
  name,
  path: relative(lib.root, diagramPath(note.dir, name)),
  scene,
});

export function getDiagram(lib: Library, ref: NoteRef, name: string): DiagramResult {
  const note = getNotes(lib, ref);
  const p = diagramPath(note.dir, checkName(name));
  return result(lib, note, name, existsSync(p) ? parseScene(readFileSync(p, "utf8")) : null);
}

// The first `diagram-N` with no file and no link in the note. Writes nothing.
export function newDiagram(lib: Library, ref: NoteRef): DiagramResult {
  const note = getNotes(lib, ref);
  let n = 1;
  while (existsSync(diagramPath(note.dir, `diagram-${n}`)) || note.text.includes(`diagrams/diagram-${n}.excalidraw`)) n++;
  return result(lib, note, `diagram-${n}`, null);
}

export async function setDiagram(lib: Library, ref: NoteRef, name: string, text: string): Promise<DiagramResult> {
  const scene = parseScene(text);
  checkName(name);
  return withLock(paths.lock(lib), () => {
    const note = getNotes(lib, ref);
    writeAtomic(diagramPath(note.dir, name), formatScene(scene));
    return result(lib, note, name, scene);
  });
}

// Renames a diagram's file. The link in the note is the caller's to change (the app edits it in the open
// note, which saves through `ore notes`), so two writers never touch the same line.
export async function renameDiagram(lib: Library, ref: NoteRef, from: string, to: string): Promise<DiagramResult> {
  checkName(from);
  checkName(to);
  return withLock(paths.lock(lib), () => {
    const note = getNotes(lib, ref);
    const src = diagramPath(note.dir, from);
    const dest = diagramPath(note.dir, to);
    if (!existsSync(src)) throw new Error(`no diagram named ${from}`);
    if (existsSync(dest) || note.text.includes(`diagrams/${to}.excalidraw`)) throw new Error(`a diagram named ${to} already exists`);
    renameSync(src, dest);
    return result(lib, note, to, parseScene(readFileSync(dest, "utf8")));
  });
}
