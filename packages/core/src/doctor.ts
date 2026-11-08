import { existsSync, statSync, unlinkSync } from "node:fs";
import { join, relative } from "node:path";
import { AnnotationSchema, anchorAnnotations, annotationRevs, annotationsPath, reanchorItem } from "./annotations.ts";
import { cardFiles, readCardFile } from "./cards.ts";
import { syncIndex } from "./db.ts";
import { errorLine, logFiles, readJsonlLines, sha256, visible } from "./fsutil.ts";
import { ID_END, itemDirs, readItemDir, type Item } from "./items.ts";
import { brokenLinks } from "./links.ts";
import { lockStale } from "./lock.ts";
import { paths, type Library } from "./library.ts";
import { reviewLogFiles, ReviewSchema, UndoSchema } from "./reviews.ts";
import { loadParams } from "./scheduler.ts";
import { loadSkills, skillsFileProblems } from "./skills.ts";
import { readTopic } from "./topics.ts";

const CUT = "cut off or not JSON (a crash mid-write leaves this), so it is skipped; delete that line in a text editor";

export interface Issue {
  level: "error" | "warn";
  path: string;
  message: string;
}

export interface DoctorReport {
  ok: boolean;
  errors: number;
  warnings: number;
  issues: Issue[];
  fixed: string[];
}

// Validate files, anchors and references. With fix: re-anchor edited docs
// (new annotation revs + text_sha256) and clear a stale lock. Nothing else
// is changed automatically.
export async function doctor(lib: Library, opts: { fix?: boolean } = {}): Promise<DoctorReport> {
  const issues: Issue[] = [];
  const fixed: string[] = [];
  const rel = (p: string) => relative(lib.root, p);
  const add = (level: Issue["level"], path: string, message: string) => issues.push({ level, path: rel(path), message });

  let skillIds = new Set<string>();
  let skillsOk = true;
  try {
    const skills = loadSkills(lib).skills;
    skillIds = new Set(skills.map((s) => s.id));
    for (const p of skillsFileProblems(lib)) add("warn", paths.skills(lib), `${p}; fix it in a text editor`);
    // Two entries with one id (a hand merge): every write finds only the first. macOS file names ignore case, so "AI" and "ai" share skills/ai/.
    const ids = skills.map((s) => s.id.toLowerCase());
    for (const id of new Set(ids.filter((id, n) => ids.indexOf(id) !== n))) add("error", paths.skills(lib), `two skills have the id "${id}"; give one of them another id, or merge them`);
  } catch (e) {
    skillsOk = false;
    add("error", paths.skills(lib), errorLine(e));
  }
  if (existsSync(paths.fsrsParams(lib)) && !loadParams(lib)) add("warn", paths.fsrsParams(lib), "can't be read, so the default review weights are used; delete it, or run ore optimize to write it again");
  const topicSlugs = new Set<string>();
  const topicDir = paths.topics(lib);
  for (const f of visible(topicDir).filter((f) => f.endsWith(".md"))) {
    try {
      if (readTopic(lib, f.slice(0, -3))) topicSlugs.add(f.slice(0, -3));
    } catch (e) {
      add("error", join(topicDir, f), `topic frontmatter invalid: ${errorLine(e)}`);
    }
  }
  const checkRefs = (path: string, skills: string[], topics: string[]) => {
    if (skillsOk) for (const s of skills) if (!skillIds.has(s)) add("warn", path, `unknown skill "${s}"`);
    for (const t of topics) if (!topicSlugs.has(t)) add("warn", path, `topic "${t}" has no topics/${t}.md`);
  };

  const items = new Map<string, Item>();
  // Folders named as Ore names them first, so a copy is the one called a copy (Ore shows the other, oncePerId).
  for (const dir of itemDirs(lib).sort((a, b) => Number(!ID_END.test(a)) - Number(!ID_END.test(b)))) {
    const doc = join(dir, "doc.md");
    let item: Item;
    try {
      item = readItemDir(dir);
    } catch (e) {
      add("error", doc, `doc.md frontmatter invalid: ${errorLine(e)}`);
      continue;
    }
    const twin = items.get(item.meta.id);
    if (twin) {
      // iCloud's "… 2" or Finder's "… copy".
      add("error", doc, `a copy of ${rel(twin.dir)} (same id); Ore shows that one, so delete this copy once you've checked nothing in it is newer`);
      continue;
    }
    items.set(item.meta.id, item);
    if (!ID_END.test(dir)) add("error", doc, `the folder name doesn't end in its id, so search skips it: rename it back to end in -${item.meta.id}`);
    else if (!dir.endsWith(item.meta.id)) add("error", doc, `id ${item.meta.id} does not match folder name`);
    checkRefs(doc, item.meta.skills, item.meta.topics);
    const annPath = annotationsPath(dir);
    for (const f of logFiles(annPath))
      for (const l of readJsonlLines(f)) {
        if (l.error) add("error", f, `line ${l.line}: ${CUT}`);
        else if (!AnnotationSchema.safeParse(l.value).success) add("error", f, `line ${l.line}: not a valid highlight, so it is skipped; fix or delete that line`);
      }
    if (sha256(item.body) !== item.meta.text_sha256) {
      if (opts.fix) {
        const r = await reanchorItem(lib, item);
        fixed.push(`${rel(doc)}: re-anchored ${r.moved.length}, hash updated`);
        for (const id of r.orphaned) add("warn", annPath, `annotation ${id} is orphaned (quote not found)`);
      } else {
        const anchored = anchorAnnotations(item);
        const moved = anchored.filter((a) => a.anchor && a.anchor.method !== "position").length;
        add("warn", doc, `body changed since capture (text_sha256); ${moved} highlight(s) need re-anchoring — run ore doctor --fix`);
        for (const a of anchored) if (!a.anchor) add("warn", annPath, `annotation ${a.id} is orphaned (quote not found)`);
      }
    } else {
      // After --fix updates the hash, an orphan would otherwise never be reported again.
      for (const a of anchorAnnotations(item)) if (!a.anchor) add("warn", annPath, `annotation ${a.id} is orphaned (quote not found)`);
    }
  }

  const cardIds = new Set<string>();
  for (const path of cardFiles(lib)) {
    try {
      const c = readCardFile(path);
      cardIds.add(c.meta.id);
      if (!path.endsWith(`${c.meta.id}.md`)) add("error", path, `id ${c.meta.id} does not match file name`);
      const item = items.get(c.meta.item);
      if (!item) add("error", path, `its source ${c.meta.item} is missing or can't be read: restore the source's folder, or retire the card (ore card retire ${c.meta.id})`);
      else if (c.meta.annotation && !annotationRevs(item.dir).some((a) => a.id === c.meta.annotation)) add("warn", path, `annotation ${c.meta.annotation} not found`);
      if (c.meta.kind === "prompt" && (c.rubric.length < 2 || c.rubric.length > 4)) add("warn", path, `prompt has ${c.rubric.length} rubric points (want 2–4)`);
      checkRefs(path, c.meta.skills, c.meta.topics);
    } catch (e) {
      add("error", path, errorLine(e).replace(`${path}: `, ""));
    }
  }

  for (const f of reviewLogFiles(lib)) {
    for (const l of readJsonlLines(f)) {
      if (l.error) add("error", f, `line ${l.line}: ${CUT}`);
      else {
        if (UndoSchema.safeParse(l.value).success) continue;
        const r = ReviewSchema.safeParse(l.value);
        if (!r.success) add("error", f, `line ${l.line}: not a valid review (${errorLine(r.error)}), so it is skipped; fix or delete that line`);
        else if (!cardIds.has(r.data.card)) add("warn", f, `line ${l.line}: card ${r.data.card} not found`);
      }
    }
  }

  // Logs no other check reads line by line: a crash mid-write leaves a cut-off last line.
  const jsonl = (dir: string) => visible(dir).filter((f) => f.endsWith(".jsonl")).map((f) => join(dir, f));
  for (const f of [...jsonl(paths.sessions(lib)), ...jsonl(paths.cards(lib))]) for (const l of readJsonlLines(f)) if (l.error) add("error", f, `line ${l.line}: ${CUT}`);

  if (skillIds.size)
    try {
      for (const l of brokenLinks(lib)) add("warn", l.path, `link "${l.text}" points to a missing ${l.target.kind === "item" ? "source" : "skill"} (${l.target.id})`);
    } catch (e) {
      add("error", lib.root, `links couldn't be checked: ${errorLine(e)}`);
    }

  // A git killed mid-snapshot leaves index.lock, and every later snapshot (D5) quietly fails.
  const gitLock = join(lib.root, ".git", "index.lock");
  if (existsSync(gitLock) && Date.now() - statSync(gitLock).mtimeMs > 60_000) {
    if (opts.fix) { unlinkSync(gitLock); fixed.push(".git/index.lock: removed stale lock, so library history saves again"); }
    else add("warn", gitLock, "library history has stopped saving: a git run was cut off and left this lock — run ore doctor --fix");
  }

  const lock = paths.lock(lib);
  // An empty lock (a crash between create and write) read as pid 0, which kill() takes as our own group.
  if (existsSync(lock)) {
    if (lockStale(lock)) {
      if (opts.fix) { unlinkSync(lock); fixed.push(".ore/lock: removed stale lock"); }
      else add("warn", lock, "stale lock (its process is gone, or it is over a minute old) — run ore doctor --fix");
    }
  }
  const session = paths.openSession(lib);
  if (existsSync(session) && Date.now() - statSync(session).mtimeMs > 86_400_000) {
    add("warn", session, "a review session has been open for over a day (ore session end)");
  }

  // The index reads skills.yaml for every card's retention, so it waits until that file reads.
  if (skillsOk) {
    try {
      const { index, report } = syncIndex(lib);
      index.close();
      for (const e of report.errors) issues.push({ level: "error", path: e.path, message: `index: ${e.error}` });
    } catch (e) {
      add("error", paths.index(lib), `the search index couldn't be updated: ${errorLine(e)} (ore reindex builds it again)`);
    }
  }

  const unique = issues.filter((i, n) => issues.findIndex((j) => j.path === i.path && j.message === i.message) === n);
  const errors = unique.filter((i) => i.level === "error").length;
  return { ok: errors === 0, errors, warnings: unique.length - errors, issues: unique, fixed };
}
