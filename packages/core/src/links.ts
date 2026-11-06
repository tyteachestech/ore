import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { subdirs } from "./fsutil.ts";
import { itemDirs, readItemDir } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { skillNotesPath } from "./notes.ts";
import { loadSkills } from "./skills.ts";

// Links between notes (D39): a plain Markdown link whose URL names the target by ID,
// `[Make It Stick](ore:item/01J…)` or `[Learning](ore:skill/learning)`. The text is
// what he sees; the ID keeps the link working when a title changes. A skill link opens
// that skill's note (D41).
export type LinkTarget = { kind: "item" | "skill"; id: string };

const LINK = /\[((?:[^\]\\]|\\.)*)\]\(ore:(item|skill)\/([^)\s]+)\)/g;

export const linkUrl = (t: LinkTarget) => `ore:${t.kind}/${t.id}`;

export function parseLinks(text: string): { text: string; target: LinkTarget; index: number }[] {
  return [...text.matchAll(LINK)].map((m) => ({ text: m[1]!, target: { kind: m[2] as LinkTarget["kind"], id: m[3]! }, index: m.index! }));
}

// The note's lines, with those inside fenced code blocks emptied: a `# comment` or a link
// written there is code, not a heading or a link (the editor shows it as text).
export function proseLines(text: string): string[] {
  let fence: string | null = null;
  return text.split("\n").map((line) => {
    const f = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (f && f[1]![0] === fence[0] && f[1]!.length >= fence.length && !line.slice(f[0].length).trim()) fence = null;
      return "";
    }
    if (f && !(f[1]![0] === "`" && line.slice(f[0].length).includes("`"))) {
      fence = f[1]!;
      return "";
    }
    return line;
  });
}

// A line as he reads it: links shown as their text.
const plainLine = (line: string) => line.replace(LINK, "$1").trim();

export interface NoteFile {
  from: LinkTarget & { title: string };
  path: string;
}

// Every note in the library: each source's My notes, then each skill's note.
export function noteFiles(lib: Library): NoteFile[] {
  const out: NoteFile[] = [];
  for (const dir of itemDirs(lib)) {
    const path = join(dir, "notes.md");
    if (!existsSync(path)) continue;
    const item = readItemDir(dir);
    out.push({ from: { kind: "item", id: item.meta.id, title: item.meta.title }, path });
  }
  const names = new Map(loadSkills(lib).skills.map((s) => [s.id, s.name]));
  const root = paths.skillNotes(lib);
  for (const id of subdirs(root)) {
    const path = skillNotesPath(lib, id);
    if (existsSync(path)) out.push({ from: { kind: "skill", id, title: names.get(id) ?? id }, path });
  }
  return out;
}

export interface Backlink {
  from: LinkTarget & { title: string };
  heading: string | null; // the nearest heading above the link
  line: string; // the line holding the link, links shown as text
}

// "Linked from" (D39): every line in another note that links to target, in note order.
export function backlinks(lib: Library, target: LinkTarget): Backlink[] {
  const out: Backlink[] = [];
  for (const f of noteFiles(lib)) {
    if (f.from.kind === target.kind && f.from.id === target.id) continue;
    let heading: string | null = null;
    for (const line of proseLines(readFileSync(f.path, "utf8"))) {
      const h = line.match(/^#{1,6}\s+(.*)$/);
      if (h) heading = plainLine(h[1]!);
      if (parseLinks(line).some((l) => l.target.kind === target.kind && l.target.id === target.id))
        out.push({ from: f.from, heading: h ? null : heading, line: plainLine(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?|^\s*>\s?/, "")) });
    }
  }
  return out;
}

// Links whose target no longer exists, for `ore doctor`.
export function brokenLinks(lib: Library): { path: string; text: string; target: LinkTarget }[] {
  const items = new Set(itemDirs(lib).map((d) => d.slice(-26)));
  const skills = new Set(loadSkills(lib).skills.map((s) => s.id));
  return noteFiles(lib).flatMap((f) =>
    parseLinks(proseLines(readFileSync(f.path, "utf8")).join("\n"))
      .filter((l) => !(l.target.kind === "item" ? items : skills).has(l.target.id))
      .map((l) => ({ path: f.path, text: l.text, target: l.target })),
  );
}
