import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { subdirs } from "./fsutil.ts";
import { ID_END, itemDirs, readable, readItemDir } from "./items.ts";
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

type MdNode = { type: string; url?: string; identifier?: string; value?: string; children?: MdNode[]; position?: { start: { line: number } } };
// Markdown has already parsed the destination (including <...> around spaces). Keep the ID
// verbatim: hand-written skill IDs may contain spaces, and trimming would change the target.
const ORE_URL = /^ore:(item|skill)\/(.+)$/;
const textOf = (n: MdNode): string => n.value ?? (n.children ?? []).map(textOf).join("");

/** The Ore links a note shows as links, as Markdown renders it: none in code or after an escaped bracket,
 *  and a reference-style one (`[Text][t]` with `[t]: ore:item/…`) too. `line` is where each starts, 0-based. */
export function renderedLinks(text: string): { text: string; target: LinkTarget; line: number }[] {
  if (!text.includes("ore:")) return [];
  const nodes: MdNode[] = [];
  const walk = (n: MdNode) => {
    nodes.push(n);
    n.children?.forEach(walk);
  };
  // Loaded on first use, as `yaml` is: every command loads this file, few read links.
  const { fromMarkdown } = require("mdast-util-from-markdown") as typeof import("mdast-util-from-markdown");
  walk(fromMarkdown(text) as MdNode);
  const defs = new Map<string, string>();
  for (const n of nodes) if (n.type === "definition" && !defs.has(n.identifier!)) defs.set(n.identifier!, n.url!);
  return nodes.flatMap((n) => {
    const url = n.type === "link" ? n.url : n.type === "linkReference" ? defs.get(n.identifier!) : undefined;
    const m = url?.match(ORE_URL);
    return m ? [{ text: textOf(n), target: { kind: m[1] as LinkTarget["kind"], id: m[2]! }, line: n.position!.start.line - 1 }] : [];
  });
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

// A line as he reads it: links, reference-style ones too, shown as their text.
const plainLine = (line: string) => line.replace(LINK, "$1").replace(/\[((?:[^\]\\]|\\.)*)\]\[[^\]]*\]/g, "$1").trim();

export interface NoteFile {
  from: LinkTarget & { title: string };
  path: string;
}

// Every note in the library: each source's My notes, then each skill's note. A deleted skill's note stays on disk
// but has no skill to open it from, so it is left out (of backlinks and `ore doctor`) until the skill comes back.
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
    const title = names.get(id);
    if (title !== undefined && existsSync(path)) out.push({ from: { kind: "skill", id, title }, path });
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
    const text = readFileSync(f.path, "utf8");
    const at = new Set(renderedLinks(text).filter((l) => l.target.kind === target.kind && l.target.id === target.id).map((l) => l.line));
    if (!at.size) continue;
    let heading: string | null = null;
    for (const [n, line] of proseLines(text).entries()) {
      const h = line.match(/^#{1,6}\s+(.*)$/);
      if (h) heading = plainLine(h[1]!);
      if (at.has(n))
        out.push({ from: f.from, heading: h ? null : heading, line: plainLine(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?|^\s*>\s?/, "")) });
    }
  }
  return out;
}

// Links whose target no longer exists, for `ore doctor`.
export function brokenLinks(lib: Library): { path: string; text: string; target: LinkTarget }[] {
  // Each source's id as its folder ends in it, or as its doc.md names it when Finder renamed the folder (as findItem).
  const dirs = itemDirs(lib);
  const items = new Set([...dirs.filter((d) => ID_END.test(d)).map((d) => d.slice(-26)), ...readable(dirs.filter((d) => !ID_END.test(d)), readItemDir).map((i) => i.meta.id)]);
  const skills = new Set(loadSkills(lib).skills.map((s) => s.id));
  return noteFiles(lib).flatMap((f) =>
    renderedLinks(readFileSync(f.path, "utf8"))
      .filter((l) => !(l.target.kind === "item" ? items : skills).has(l.target.id))
      .map((l) => ({ path: f.path, text: l.text, target: l.target })),
  );
}
