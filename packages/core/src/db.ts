import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { annotationsPath, readAnnotations } from "./annotations.ts";
import { errorLine, logFiles, subdirs, visible } from "./fsutil.ts";
import { readCardFile } from "./cards.ts";
import { parseFrontmatter } from "./frontmatter.ts";
import { ID_END, readItemDir } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { readReviews, type FsrsState, type Review } from "./reviews.ts";
import { loadParams, replay } from "./scheduler.ts";
import { desiredRetention, loadSkills } from "./skills.ts";

// .index/library.sqlite is a disposable cache of the files: FTS5 search plus
// card states replayed from the review log. Every open syncs it by comparing
// file mtimes and sizes, so direct file edits by agents are picked up.
const SCHEMA_VERSION = "7"; // 5: card_state.sig, so a new review replays only its own card; 6: rebuilt once to drop doubled search rows; 7: again, for rows from copied folders

const SCHEMA = `
create table meta(key text primary key, value text);
create table files(path text primary key, kind text, mtime real, size integer);
create table items(id text primary key, path text, title text, type text, status text, skills text, topics text, finished_at text, enriched_at text, archived integer);
create table cards(id text primary key, path text, kind text, state text, item text, annotation text, from_notes integer, content_type text, skills text, topics text, question text, created text);
create table card_state(id text primary key, retention real, fsrs text, due text, reps integer, sig text);
create virtual table fts using fts5(kind unindexed, ref unindexed, item unindexed, title, body);
`;

type FileKind = "doc" | "ann" | "notes" | "skill-notes" | "card" | "topic" | "review" | "config";
interface FileStat { path: string; kind: FileKind; mtime: number; size: number }

function scan(lib: Library): FileStat[] {
  const out: FileStat[] = [];
  const add = (path: string, kind: FileKind) => {
    if (!existsSync(path)) return;
    const s = statSync(path);
    out.push({ path, kind, mtime: s.mtimeMs, size: s.size });
  };
  const ls = visible;
  for (const y of subdirs(paths.items(lib))) {
    // Only folders named as Ore names them (`<slug>-<id>`): a Finder or iCloud copy ("… 2") would show
    // every hit twice, and the index drops a folder's rows by the id its name ends in. `ore doctor` names the rest.
    for (const d of subdirs(join(paths.items(lib), y)).filter((d) => ID_END.test(d))) {
      add(join(paths.items(lib), y, d, "doc.md"), "doc");
      // One entry for a source's highlight log however many device files it spans (they are indexed together).
      const logs = logFiles(annotationsPath(join(paths.items(lib), y, d))).map((f) => statSync(f));
      if (logs.length) out.push({ path: annotationsPath(join(paths.items(lib), y, d)), kind: "ann", mtime: Math.max(...logs.map((s) => s.mtimeMs)), size: logs.reduce((t, s) => t + s.size, 0) });
      add(join(paths.items(lib), y, d, "notes.md"), "notes");
    }
  }
  for (const s of subdirs(paths.skillNotes(lib))) add(join(paths.skillNotes(lib), s, "notes.md"), "skill-notes");
  for (const f of ls(paths.cards(lib))) if (/^[0-9A-HJKMNP-TV-Z]{26}\.md$/.test(f)) add(join(paths.cards(lib), f), "card");
  for (const f of ls(paths.topics(lib))) if (f.endsWith(".md")) add(join(paths.topics(lib), f), "topic");
  for (const f of ls(paths.reviews(lib))) if (f.endsWith(".jsonl")) add(join(paths.reviews(lib), f), "review");
  add(paths.skills(lib), "config");
  add(paths.fsrsParams(lib), "config");
  return out;
}

export interface CardRow {
  id: string;
  path: string;
  kind: "card" | "prompt";
  state: "draft" | "live" | "retired";
  item: string;
  annotation: string | null;
  from_notes: boolean;
  content_type: "definition" | "concept" | "procedure" | "fact";
  skills: string[];
  topics: string[];
  question: string;
  created: string;
  retention: number;
  fsrs: FsrsState | null;
}

export interface ItemRow {
  id: string;
  path: string;
  title: string;
  type: string;
  status: string;
  skills: string[];
  topics: string[];
  finished_at: string | null;
  enriched_at: string | null;
}

export interface SearchHit {
  kind: "item" | "annotation" | "notes" | "skill-notes" | "card" | "topic";
  ref: string;
  item: string | null;
  title: string;
  snippet: string;
  /** A card's: the highlight it was made from, where ⌘K lands. */
  annotation?: string;
}

export class LibraryIndex {
  constructor(readonly db: Database, readonly lib: Library) {}

  cards(): CardRow[] {
    return this.db
      // A reviewed draft is live: its finishing review is in the log, not the card file (D20).
      .query<Record<string, unknown>, []>("select c.*, case when c.state = 'draft' and s.reps > 0 then 'live' else c.state end as state, s.retention, s.fsrs from cards c left join card_state s on s.id = c.id")
      .all()
      .map((r) => ({
        ...(r as unknown as CardRow),
        from_notes: Boolean(r.from_notes),
        skills: JSON.parse(r.skills as string),
        topics: JSON.parse(r.topics as string),
        fsrs: r.fsrs ? JSON.parse(r.fsrs as string) : null,
        retention: (r.retention as number) ?? 0.9,
      }));
  }

  items(): ItemRow[] {
    return this.db
      .query<Record<string, unknown>, []>("select * from items")
      .all()
      .map((r) => ({ ...(r as unknown as ItemRow), skills: JSON.parse(r.skills as string), topics: JSON.parse(r.topics as string) }));
  }

  search(query: string, limit = 20): SearchHit[] {
    // FTS5 drops "+" and "#" from words, so "c++" would find every word starting with c. A term that ends
    // in them ("c++", "c#", "f#") asks the index for the bare word and keeps only rows that spell it out.
    const terms = query.match(/[\p{L}\p{N}_]+[+#]*/gu) ?? [];
    if (!terms.length) return [];
    const literal = terms.filter((t) => /[+#]$/.test(t));
    const match = terms.map((t) => (/[+#]$/.test(t) ? `"${t.replace(/[+#]+$/, "")}"` : `"${t}"*`)).join(" ");
    const spelled = literal.map((t) => new RegExp(`(?<![\\p{L}\\p{N}_])${t.replace(/\+/g, "\\+")}(?![+#])`, "iu"));
    // A hit in the title counts five times one in the body (bm25 weights by column). Archived sources,
    // and everything in them, stay out.
    const rows = this.db
      .query<SearchHit & { body: string; annotation: string | null }, [string, number]>(
        "select kind, ref, item, title, body, snippet(fts, -1, '[', ']', '…', 12) as snippet, case when kind = 'card' then (select annotation from cards where cards.id = fts.ref) end as annotation from fts where fts match ? and (item is null or item not in (select id from items where archived = 1)) order by bm25(fts, 0, 0, 0, 5, 1) limit ?",
      )
      .all(match, spelled.length ? -1 : limit);
    return rows
      .filter((r) => spelled.every((re) => re.test(r.title) || re.test(r.body)))
      .slice(0, limit)
      .map(({ body: _, annotation, ...hit }) => (annotation ? { ...hit, annotation } : hit));
  }

  /** Sources (not archived) whose title or text holds any of these word stems, best first (Ask your library). */
  sourcesMatching(stems: string[], limit: number): string[] {
    const match = stems.map((t) => `"${t.replace(/"/g, "")}"*`).join(" OR ");
    return this.db
      .query<{ item: string }, [string, number]>("select item from fts where fts match ? and kind = 'item' and item not in (select id from items where archived = 1) order by bm25(fts, 0, 0, 0, 5, 1) limit ?")
      .all(match, limit)
      .map((r) => r.item);
  }

  close(): void {
    this.db.close();
  }
}

function openDb(lib: Library): Database {
  const path = paths.index(lib);
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
  // The app runs several `ore` processes at once (Home, a review, a background enrich): wait for a lock instead of failing.
  db.exec("pragma busy_timeout = 5000");
  // Switching a new file to WAL doesn't wait on busy_timeout (2 of 8 processes opening a fresh index at
  // once failed here on Tyler's Mac), so it waits as long by hand.
  for (const until = Date.now() + 5000; ; ) {
    try {
      db.exec("pragma journal_mode = wal");
      break;
    } catch (e) {
      if ((e as { code?: string }).code !== "SQLITE_BUSY" || Date.now() > until) throw e;
      Bun.sleepSync(20);
    }
  }
  const version = () => {
    try {
      return db.query<{ value: string }, []>("select value from meta where key = 'schema'").get()?.value;
    } catch {
      return undefined;
    }
  };
  if (version() !== SCHEMA_VERSION) {
    // A new or outdated index is rebuilt in place under a write lock, checked again once held: deleting
    // the file instead pulled it from under another process opening it at the same moment (first launch,
    // or the first after an update), which failed with "disk I/O error" or "database is locked".
    db.exec("begin immediate");
    try {
      if (version() !== SCHEMA_VERSION) {
        const tables = db.query<{ name: string }, []>("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like 'fts_%'").all();
        for (const { name } of tables) db.exec(`drop table if exists "${name}"`);
        db.exec(SCHEMA);
        db.run("insert into meta values ('schema', ?)", [SCHEMA_VERSION]);
      }
      db.exec("commit");
    } catch (e) {
      db.exec("rollback");
      throw e;
    }
  }
  return db;
}

function indexFile(db: Database, lib: Library, f: FileStat): void {
  const dir = dirname(f.path);
  if (f.kind === "doc") {
    const item = readItemDir(dir);
    const m = item.meta;
    db.run("insert or replace into items values (?,?,?,?,?,?,?,?,?,?)", [
      m.id, relative(lib.root, f.path), m.title, m.type, m.status, JSON.stringify(m.skills), JSON.stringify(m.topics), m.finished_at ?? null, m.enriched_at ?? null, m.archived_at ? 1 : 0,
    ]);
    db.run("insert into fts values ('item', ?, ?, ?, ?)", [m.id, m.id, m.title, item.body]);
  } else if (f.kind === "ann") {
    const item = readItemDir(dir);
    for (const a of readAnnotations(item)) {
      db.run("insert into fts values ('annotation', ?, ?, ?, ?)", [a.id, item.meta.id, `${a.intent}: ${item.meta.title}`, [a.exact, a.note].filter(Boolean).join("\n")]);
    }
  } else if (f.kind === "notes") {
    const item = readItemDir(dir);
    db.run("insert into fts values ('notes', ?, ?, ?, ?)", [item.meta.id, item.meta.id, `My notes: ${item.meta.title}`, readFileSync(f.path, "utf8")]);
  } else if (f.kind === "skill-notes") {
    const id = basename(dir);
    const name = loadSkills(lib).skills.find((s) => s.id === id)?.name ?? id;
    db.run("insert into fts values ('skill-notes', ?, null, ?, ?)", [id, `Notes: ${name}`, readFileSync(f.path, "utf8")]);
  } else if (f.kind === "card") {
    const c = readCardFile(f.path);
    const m = c.meta;
    db.run("insert or replace into cards values (?,?,?,?,?,?,?,?,?,?,?,?)", [
      m.id, relative(lib.root, f.path), m.kind, m.state, m.item, m.annotation ?? null, m.from === "notes" ? 1 : 0, m.content_type, JSON.stringify(m.skills), JSON.stringify(m.topics), c.question, m.created,
    ]);
    db.run("insert into fts values ('card', ?, ?, ?, ?)", [m.id, m.item, c.question, [c.answer, ...c.rubric].join("\n")]);
  } else if (f.kind === "topic") {
    const { data, body } = parseFrontmatter<{ name?: string; aliases?: string[] }>(readFileSync(f.path, "utf8"));
    const slug = f.path.split("/").pop()!.replace(/\.md$/, "");
    db.run("insert into fts values ('topic', ?, null, ?, ?)", [slug, data.name ?? slug, [...(data.aliases ?? []), body].join("\n")]);
  }
}

function dropFile(db: Database, lib: Library, path: string, kind: FileKind): void {
  if (kind === "doc" || kind === "ann" || kind === "notes") {
    const id = dirname(path).slice(-26);
    if (kind === "doc") {
      db.run("delete from items where id = ?", [id]);
      db.run("delete from fts where kind = 'item' and ref = ?", [id]);
    } else if (kind === "notes") db.run("delete from fts where kind = 'notes' and item = ?", [id]);
    else db.run("delete from fts where kind = 'annotation' and item = ?", [id]);
  } else if (kind === "skill-notes") {
    db.run("delete from fts where kind = 'skill-notes' and ref = ?", [basename(dirname(path))]);
  } else if (kind === "card") {
    const id = path.split("/").pop()!.replace(/\.md$/, "");
    db.run("delete from cards where id = ?", [id]);
    db.run("delete from card_state where id = ?", [id]);
    db.run("delete from fts where kind = 'card' and ref = ?", [id]);
  } else if (kind === "topic") {
    db.run("delete from fts where kind = 'topic' and ref = ?", [path.split("/").pop()!.replace(/\.md$/, "")]);
  }
}

// A card's state is a replay of its reviews (ts and rating) at its retention under the FSRS weights,
// so a card whose inputs hash the same keeps its stored state and only changed cards are replayed.
function recomputeStates(db: Database, lib: Library): void {
  const skills = loadSkills(lib).skills;
  const w = loadParams(lib);
  const byCard = new Map<string, Review[]>();
  for (const r of readReviews(lib)) {
    const list = byCard.get(r.card);
    if (list) list.push(r);
    else byCard.set(r.card, [r]);
  }
  const stored = new Map(db.query<{ id: string; sig: string | null }, []>("select id, sig from card_state").all().map((r) => [r.id, r.sig]));
  const rows = db.query<{ id: string; skills: string }, []>("select id, skills from cards").all();
  const keep = new Set<string>();
  for (const row of rows) {
    keep.add(row.id);
    const retention = desiredRetention(JSON.parse(row.skills), skills);
    const own = byCard.get(row.id) ?? [];
    const sig = Bun.hash(`${retention}|${w?.join(",") ?? ""}|${own.map((r) => `${r.ts}:${r.rating}`).sort().join(",")}`).toString(36);
    if (stored.get(row.id) === sig) continue;
    const s = replay(own, retention, w);
    db.run("insert or replace into card_state values (?,?,?,?,?,?)", [row.id, retention, s ? JSON.stringify(s) : null, s?.due ?? null, s?.reps ?? 0, sig]);
  }
  for (const id of stored.keys()) if (!keep.has(id)) db.run("delete from card_state where id = ?", [id]);
}

export interface SyncReport {
  changed: number;
  removed: number;
  errors: { path: string; error: string }[];
}

export function syncIndex(lib: Library): { index: LibraryIndex; report: SyncReport } {
  const db = openDb(lib);
  const known = new Map(
    db.query<{ path: string; kind: FileKind; mtime: number; size: number }, []>("select * from files").all().map((r) => [r.path, r]),
  );
  const current = scan(lib);
  const changed = current.filter((f) => {
    const k = known.get(f.path);
    return !k || k.mtime !== f.mtime || k.size !== f.size;
  });
  const currentPaths = new Set(current.map((f) => f.path));
  const removed = [...known.values()].filter((k) => !currentPaths.has(k.path));
  const report: SyncReport = { changed: changed.length, removed: removed.length, errors: [] };
  if (changed.length || removed.length) {
    db.transaction(() => {
      for (const k of removed) {
        dropFile(db, lib, k.path, k.kind);
        db.run("delete from files where path = ?", [k.path]);
      }
      for (const f of changed) {
        // Always, not only for files this process saw before: several `ore` processes sync at once (the app's
        // launch), and one that read the files table before another committed would index a file twice.
        dropFile(db, lib, f.path, f.kind);
        try {
          indexFile(db, lib, f);
        } catch (e) {
          report.errors.push({ path: relative(lib.root, f.path), error: errorLine(e) });
        }
        db.run("insert or replace into files values (?,?,?,?)", [f.path, f.kind, f.mtime, f.size]);
      }
      if ([...changed, ...removed].some((f) => f.kind === "card" || f.kind === "review" || f.kind === "config")) recomputeStates(db, lib);
    })();
  }
  return { index: new LibraryIndex(db, lib), report };
}

export function openIndex(lib: Library): LibraryIndex {
  return syncIndex(lib).index;
}

export function rebuildIndex(lib: Library): SyncReport {
  // Emptied in place, not deleted: unlinking the file from under another `ore` that has it open fails that one
  // with "disk I/O error". With no files known, the sync indexes everything again.
  const db = openDb(lib);
  db.transaction(() => {
    for (const t of ["files", "items", "cards", "card_state", "fts"]) db.run(`delete from ${t}`);
  })();
  db.close();
  const { index, report } = syncIndex(lib);
  index.close();
  return report;
}
