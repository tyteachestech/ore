import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { annotationsPath, readAnnotations } from "./annotations.ts";
import { errorLine, logFiles, subdirs, visible } from "./fsutil.ts";
import { readCardFile } from "./cards.ts";
import { parseFrontmatter } from "./frontmatter.ts";
import { ID_END, readItemDir } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { readReviews, type FsrsState, type Review } from "./reviews.ts";
import { loadParams, replay } from "./scheduler.ts";
import { desiredRetention, loadSkills, type Priority } from "./skills.ts";

// .index/library.sqlite is a disposable cache of the files: FTS5 search plus
// card states replayed from the review log. Every open syncs it by comparing
// file mtimes and sizes, so direct file edits by agents are picked up.
const SCHEMA_VERSION = "10"; // 10: fts.chars keeps runs apart; 9: items.priority, the importance he set on a source; 5: card_state.sig, so a new review replays only its own card; 6: rebuilt once to drop doubled search rows; 7: again, for rows from copied folders; 8: fts.chars, words inside Chinese, Japanese and Thai

const SCHEMA = `
create table meta(key text primary key, value text);
create table files(path text primary key, kind text, mtime real, size integer);
create table items(id text primary key, path text, title text, type text, status text, skills text, topics text, finished_at text, enriched_at text, archived integer, priority text);
create table cards(id text primary key, path text, kind text, state text, item text, annotation text, from_notes integer, content_type text, skills text, topics text, question text, created text);
create table card_state(id text primary key, retention real, fsrs text, due text, reps integer, sig text);
create virtual table fts using fts5(kind unindexed, ref unindexed, item unindexed, title, body, chars);
`;

type FileKind = "doc" | "ann" | "notes" | "skill-notes" | "card" | "topic" | "review" | "config";
interface FileStat { path: string; kind: FileKind; mtime: number; size: number }

/** The source folders the index reads, each with its source's id: one folder per id, as `listItems` lists
 *  them. A folder named as Ore names it (`<slug>-<id>`) is the one; a folder renamed in Finder, whose name
 *  no longer ends in its id, is read for the id its doc.md names, and counts unless a folder ending in that
 *  id is there (then it is a Finder or iCloud copy, "… 2", which would show every hit twice). `ore doctor`
 *  names both. */
function sourceDirs(lib: Library): Map<string, string> {
  const dirs = new Map<string, string>();
  const renamed: string[] = [];
  for (const y of subdirs(paths.items(lib))) {
    for (const d of subdirs(join(paths.items(lib), y))) {
      const dir = join(paths.items(lib), y, d);
      if (ID_END.test(d)) dirs.set(dir, d.slice(-26));
      else if (existsSync(join(dir, "doc.md"))) renamed.push(dir);
    }
  }
  const named = new Set(dirs.values());
  for (const dir of renamed.sort()) {
    let id: string;
    try {
      id = readItemDir(dir).meta.id;
    } catch {
      continue;
    }
    if (!named.has(id)) (named.add(id), dirs.set(dir, id));
  }
  return dirs;
}

function scan(lib: Library, dirs: Map<string, string>): FileStat[] {
  const out: FileStat[] = [];
  const add = (path: string, kind: FileKind) => {
    if (!existsSync(path)) return;
    const s = statSync(path);
    out.push({ path, kind, mtime: s.mtimeMs, size: s.size });
  };
  const ls = visible;
  for (const dir of dirs.keys()) {
    add(join(dir, "doc.md"), "doc");
    // One entry for a source's highlight log however many device files it spans (they are indexed together).
    const logs = logFiles(annotationsPath(dir)).map((f) => statSync(f));
    if (logs.length) out.push({ path: annotationsPath(dir), kind: "ann", mtime: Math.max(...logs.map((s) => s.mtimeMs)), size: logs.reduce((t, s) => t + s.size, 0) });
    add(join(dir, "notes.md"), "notes");
  }
  // A removed skill's notes stay on disk for recovery, but out of search: they can't be opened.
  const skills = new Set(loadSkills(lib).skills.map((s) => s.id));
  for (const s of subdirs(paths.skillNotes(lib)).filter((s) => skills.has(s))) add(join(paths.skillNotes(lib), s, "notes.md"), "skill-notes");
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
  /** The importance he set on it himself (P1–P3), over its skills'. */
  priority: Priority | null;
}

/** The text around a word found in `chars`, marked as the index marks its own hits (its snippet would be of the spaced letters). */
function around(body: string, word: string): string | undefined {
  const at = body.indexOf(word);
  if (at < 0) return undefined;
  const from = Math.max(0, at - 30);
  const to = Math.min(body.length, at + word.length + 30);
  return `${from ? "…" : ""}${body.slice(from, at)}[${word}]${body.slice(at + word.length, to)}${to < body.length ? "…" : ""}`.replace(/\s+/g, " ");
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

  /** Sources' doc.md files that have no row: the sync that saw them change couldn't read them (`ore doctor` says why). */
  unindexedDocs(): string[] {
    const indexed = new Set(this.db.query<{ path: string }, []>("select path from items").all().map((r) => r.path));
    return this.db
      .query<{ path: string }, []>("select path from files where kind = 'doc'")
      .all()
      .map((r) => r.path)
      .filter((p) => !indexed.has(relative(this.lib.root, p)));
  }

  /** Matches for `query`, best first. `bySource`: each source's best match only, every source that has
   *  one unless `limit` cuts them (a list's search, whose rows are sources: the first N matches across
   *  the library leave out sources a tab or filter would show, organize sweep 6); past the first SNIPPETS
   *  their snippet is empty. `within`: only these sources, in this order (the list's rows, as it shows
   *  them), so the ones it shows first are the ones with a snippet. */
  search(query: string, limit = 20, bySource = false, within?: string[]): SearchHit[] {
    // FTS5 drops "+" and "#" from words, so "c++" would find every word starting with c. A term that ends
    // in them ("c++", "c#", "f#") asks the index for the bare word and keeps only rows that spell it out.
    const terms = query.normalize("NFC").match(/[\p{L}\p{M}\p{N}_]+[+#]*/gu) ?? [];
    if (!terms.length) return [];
    const literal = terms.filter((t) => /[+#]$/.test(t));
    // A word in a script without spaces is its letters side by side in `chars`; any other letters in it ask as usual.
    const unspaced = terms.filter((t) => spacedOut(t));
    const ask = (t: string) => {
      const rest = t.replace(UNSPACED, " ").trim();
      return [...runsOf(t).map((r) => `"${spacedOut(r)}"`), ...(rest ? rest.split(/\s+/).map((w) => `"${w}"*`) : [])].join(" ");
    };
    const match = terms.map((t) => (spacedOut(t) ? ask(t) : /[+#]$/.test(t) ? `"${t.replace(/[+#]+$/, "")}"` : `"${t}"*`)).join(" ");
    const spelled = literal.map((t) => new RegExp(`(?<![\\p{L}\\p{N}_])${t.replace(/\+/g, "\\+")}(?![+#])`, "iu"));
    // The body is read only to check a spelled-out term or cut a snippet around an unspaced word. A snippet
    // costs about a millisecond on a long source, so only the matches kept get one, and by source only the
    // best SNIPPETS: a list's search of a common word ("a", every source) took a second for 877 of them.
    const needBody = spelled.length > 0 || unspaced.length > 0;
    const capped = !spelled.length && !bySource && !within;
    // A hit in the title counts five times one in the body (bm25 weights by column). Archived sources,
    // and everything in them, stay out.
    const rows = this.db
      .query<Omit<SearchHit, "snippet"> & { id: number; body?: string; annotation: string | null }, [string, number]>(
        `select rowid as id, kind, ref, item, title${needBody ? ", body" : ""}, case when kind = 'card' then (select annotation from cards where cards.id = fts.ref) end as annotation from fts where fts match ? and (item is null or item not in (select id from items where archived = 1)) order by bm25(fts, 0, 0, 0, 5, 1, 1) limit ?`,
      )
      .all(match, capped ? limit : -1);
    const seen = new Set<string>();
    const order = within && new Map(within.map((id, i) => [id, i]));
    const kept = rows
      .filter((r) => !order || order.has(r.item!))
      .filter((r) => spelled.every((re) => re.test(r.title) || re.test(r.body!)))
      .filter((r) => !(bySource || within) || (r.item !== null && !seen.has(r.item) && !!seen.add(r.item)))
      .sort(order ? (a, b) => order.get(a.item!)! - order.get(b.item!)! : () => 0)
      .slice(0, limit);
    if (!kept.length) return [];
    // A word found in `chars` gets the body's snippet, never the spaced letters (and its own, below, where the body holds it).
    const snips = new Map(
      this.db
        .query<{ id: number; snippet: string }, [string]>(`select rowid as id, snippet(fts, ${unspaced.length ? 4 : -1}, '[', ']', '…', 12) as snippet from fts where fts match ? and rowid in (${kept.slice(0, bySource || within ? SNIPPETS : undefined).map((r) => r.id).join(",")})`)
        .all(match)
        .map((r) => [r.id, r.snippet]),
    );
    return kept.map(({ id, body, annotation, ...hit }) => {
      const snippet = (unspaced.length ? around(body!, unspaced[0]!) : undefined) ?? snips.get(id) ?? "";
      return annotation ? { ...hit, snippet, annotation } : { ...hit, snippet };
    });
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

/** How many of a search by source get a snippet, best first: as many lines as the list's search had before it found every source. */
const SNIPPETS = 60;

/** Letters of scripts written without spaces between words (Chinese, Japanese, Thai and its neighbours),
 *  with the marks on them. The index reads a run of them as one word, so a word inside one was never found.
 *  The long-vowel mark ー (and its half-width ｰ) belongs to no script but is part of a katakana word (コーヒー). */
const UNSPACED = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Thai}\p{sc=Lao}\p{sc=Khmer}\p{sc=Myanmar}\u30FC\uFF70]\p{M}*/gu;
/** Those letters one by one, so a word is found as the letters side by side (`chars`). */
const spacedOut = (s: string) => s.match(UNSPACED)?.join(" ") ?? "";
/** A text's runs of those letters spaced out, with a private-use mark between runs: the index reads it as a
 *  word no query can spell, so a phrase never joins letters that punctuation or other words keep apart
 *  (日本。語。 does not say 日本語, Codex deep scan 2). Spaces and one line break inside a paragraph join
 *  the letters on both sides (a wrapped line); a blank line ends the run. */
const RUN = new RegExp(`(?:${UNSPACED.source})+(?:[^\\S\\n]*\\n?[^\\S\\n]*(?:${UNSPACED.source})+)*`, "gu");
const BETWEEN = " \uE000 ";
const runsOf = (s: string) => s.match(RUN) ?? [];
const spacedRuns = (s: string) => runsOf(s).map(spacedOut).join(BETWEEN);

/** A search row, in one Unicode form (an accent typed as its own mark finds the same text, Codex sweep 4). */
function addFts(db: Database, [kind, ref, item, title, body]: [string, string, string | null, string, string]): void {
  const [t, b] = [title.normalize("NFC"), body.normalize("NFC")];
  db.run("insert into fts values (?, ?, ?, ?, ?, ?)", [kind, ref, item, t, b, spacedRuns(`${t}\n${b}`)]);
}

function indexFile(db: Database, lib: Library, f: FileStat): void {
  const dir = dirname(f.path);
  if (f.kind === "doc") {
    const item = readItemDir(dir);
    const m = item.meta;
    db.run("insert or replace into items values (?,?,?,?,?,?,?,?,?,?,?)", [
      m.id, relative(lib.root, f.path), m.title, m.type, m.status, JSON.stringify(m.skills), JSON.stringify(m.topics), m.finished_at ?? null, m.enriched_at ?? null, m.archived_at ? 1 : 0, m.priority ?? null,
    ]);
    addFts(db, ["item", m.id, m.id, m.title, item.body]);
  } else if (f.kind === "ann") {
    const item = readItemDir(dir);
    for (const a of readAnnotations(item)) {
      addFts(db, ["annotation", a.id, item.meta.id, `${a.intent}: ${item.meta.title}`, [a.exact, a.note].filter(Boolean).join("\n")]);
    }
  } else if (f.kind === "notes") {
    const item = readItemDir(dir);
    addFts(db, ["notes", item.meta.id, item.meta.id, `My notes: ${item.meta.title}`, readFileSync(f.path, "utf8")]);
  } else if (f.kind === "skill-notes") {
    const id = basename(dir);
    const name = loadSkills(lib).skills.find((s) => s.id === id)?.name ?? id;
    addFts(db, ["skill-notes", id, null, `Notes: ${name}`, readFileSync(f.path, "utf8")]);
  } else if (f.kind === "card") {
    const c = readCardFile(f.path);
    const m = c.meta;
    db.run("insert or replace into cards values (?,?,?,?,?,?,?,?,?,?,?,?)", [
      m.id, relative(lib.root, f.path), m.kind, m.state, m.item, m.annotation ?? null, m.from === "notes" ? 1 : 0, m.content_type, JSON.stringify(m.skills), JSON.stringify(m.topics), c.question, m.created,
    ]);
    addFts(db, ["card", m.id, m.item, c.question, [c.answer, ...c.rubric].join("\n")]);
  } else if (f.kind === "topic") {
    const { data, body } = parseFrontmatter<{ name?: string; aliases?: string[] }>(readFileSync(f.path, "utf8"));
    const slug = f.path.split("/").pop()!.replace(/\.md$/, "");
    addFts(db, ["topic", slug, null, data.name ?? slug, [...(data.aliases ?? []), body].join("\n")]);
  }
}

/** `idOf`: a source folder's id, from its name or, for a folder renamed in Finder, from its doc.md. */
function dropFile(db: Database, lib: Library, path: string, kind: FileKind, idOf: (dir: string) => string): void {
  if (kind === "doc" || kind === "ann" || kind === "notes") {
    const id = idOf(dirname(path));
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
  const rows = db.query<{ id: string; skills: string; own: Priority | null }, []>("select c.id, c.skills, i.priority as own from cards c left join items i on i.id = c.item").all();
  const keep = new Set<string>();
  for (const row of rows) {
    keep.add(row.id);
    const retention = desiredRetention(JSON.parse(row.skills), skills, row.own);
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
  const dirs = sourceDirs(lib);
  // A folder gone or renamed away is known by the id it was indexed under.
  const was = new Map(db.query<{ id: string; path: string }, []>("select id, path from items").all().map((r) => [dirname(join(lib.root, r.path)), r.id]));
  const idOf = (dir: string) => dirs.get(dir) ?? was.get(dir) ?? dir.slice(-26);
  const current = scan(lib, dirs);
  const own = current.filter((f) => {
    const k = known.get(f.path);
    return !k || k.mtime !== f.mtime || k.size !== f.size;
  });
  // Search rows that carry their owner's name go again when it changes: a source's highlights and notes
  // with its doc.md (its title), the skills' notes with skills.yaml (their names), so the index is a rebuild's.
  const docs = new Set(own.filter((f) => f.kind === "doc").map((f) => dirname(f.path)));
  const skillsChanged = own.some((f) => f.path === paths.skills(lib));
  const mine = new Set(own);
  const changed = current.filter((f) => mine.has(f) || ((f.kind === "ann" || f.kind === "notes") && docs.has(dirname(f.path))) || (f.kind === "skill-notes" && skillsChanged));
  const currentPaths = new Set(current.map((f) => f.path));
  const removed = [...known.values()].filter((k) => !currentPaths.has(k.path));
  const report: SyncReport = { changed: changed.length, removed: removed.length, errors: [] };
  if (changed.length || removed.length) {
    db.transaction(() => {
      // A write comes first so this process holds the lock before it looks: a read that another process
      // then wrote past would fail the transaction instead of waiting its turn.
      db.run("delete from files where path = ''");
      // The sources he set an importance on: a change there moves their cards' retention, as a skill's does.
      const set = () => db.query<{ p: string }, []>("select coalesce(group_concat(id || priority), '') as p from (select id, priority from items where priority is not null order by id)").get()!.p;
      const before = set();
      for (const k of removed) {
        dropFile(db, lib, k.path, k.kind, idOf);
        db.run("delete from files where path = ?", [k.path]);
      }
      // An empty index has no rows to drop, and each drop scans the whole search table: on a first build they cost
      // most of its time (F84).
      const fresh = !db.query("select 1 where exists (select 1 from fts) or exists (select 1 from items) or exists (select 1 from cards)").get();
      for (const f of changed) {
        // Otherwise always, not only for files this process saw before: several `ore` processes sync at once (the
        // app's launch), and one that read the files table before another committed would index a file twice.
        if (!fresh) dropFile(db, lib, f.path, f.kind, idOf);
        try {
          indexFile(db, lib, f);
        } catch (e) {
          report.errors.push({ path: relative(lib.root, f.path), error: errorLine(e) });
        }
        db.run("insert or replace into files values (?,?,?,?)", [f.path, f.kind, f.mtime, f.size]);
      }
      if ([...changed, ...removed].some((f) => f.kind === "card" || f.kind === "review" || f.kind === "config") || set() !== before) recomputeStates(db, lib);
    })();
  }
  return { index: new LibraryIndex(db, lib), report };
}

export function openIndex(lib: Library): LibraryIndex {
  return syncIndex(lib).index;
}

/** Runs `f` on `index`, an index the caller already opened (and closes), or on one opened for it.
 *  A command that reads several views (Home's Today, a skill page's stats) syncs the files once. */
export function withIndex<T>(lib: Library, index: LibraryIndex | undefined, f: (index: LibraryIndex) => T): T {
  if (index) return f(index);
  const own = openIndex(lib);
  try {
    return f(own);
  } finally {
    own.close();
  }
}

export function rebuildIndex(lib: Library): SyncReport {
  // Emptied in place, not deleted: unlinking the file from under another `ore` that has it open fails that one
  // with "disk I/O error". With no files known, the sync indexes everything again.
  try {
    const db = openDb(lib);
    try {
      db.transaction(() => {
        for (const t of ["files", "items", "cards", "card_state", "fts"]) db.run(`delete from ${t}`);
      })();
    } finally {
      db.close();
    }
  } catch (e) {
    // An index too damaged to open ("database disk image is malformed") is deleted and built from scratch.
    // Another `ore` holding the lock past busy_timeout leaves the file alone: deleting it fails that one.
    if (/^SQLITE_(BUSY|LOCKED)/.test(String((e as { code?: unknown }).code))) throw e;
    const path = paths.index(lib);
    for (const f of [path, `${path}-wal`, `${path}-shm`]) if (existsSync(f)) unlinkSync(f);
  }
  const { index, report } = syncIndex(lib);
  index.close();
  return report;
}
