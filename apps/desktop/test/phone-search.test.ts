// Search on the iPhone runs the core's own SQL over sql.js, whose stock build has FTS4, not FTS5
// (src/phone/sqlite.ts rewrites it). The statements are read from db.ts, so a change there is tested here.
import { beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Database, ready } from "../src/phone/sqlite";

const core = readFileSync(new URL("../../../packages/core/src/db.ts", import.meta.url), "utf8");
const statement = (re: RegExp) => {
  const m = core.match(re);
  if (!m) throw new Error(`not in db.ts: ${re}`);
  return m[0];
};

let db: Database;
beforeAll(async () => {
  await ready(Bun.resolveSync("sql.js/dist/sql-wasm.wasm", import.meta.dir));
  db = new Database("phone-search-test");
  db.exec(statement(/create virtual table fts using fts5\([^)]*\);/));
  db.exec("create table items (id text, archived int); create table cards (id text, annotation text);");
  const add = "insert into fts (kind, ref, item, title, body) values (?, ?, ?, ?, ?)";
  db.run(add, ["item", "a", "a", "Spaced repetition", "Reviewing at growing intervals beats cramming."]);
  db.run(add, ["card", "c1", "b", "How the web works", "A browser asks a server for a page."]);
  db.run(add, ["item", "u", "u", "Unicode", "We met at a café. ΜΝΗΜΗ. Привет."]);
  db.run("insert into fts (kind, ref, item, title, body, chars) values (?, ?, ?, ?, ?, ?)", ["item", "j", "j", "日本語", "毎朝勉強する。", "日 本 語 毎 朝 勉 強 す る"]);
});

/** The two statements of `search`: the matches, then the snippets of those it keeps. */
const MATCHES = statement(/select rowid as id, kind, ref, item, title[^`]*/).replace('${needBody ? ", body" : ""}', ", body");
const SNIPPETS = statement(/select rowid as id, snippet\(fts[^`]*/).replace("${unspaced.length ? 4 : -1}", "-1");
const search = (q: string) => {
  const hits = db.query<{ id: number; kind: string; ref: string }>(MATCHES).all(q.startsWith('"') ? q : `"${q}"*`, 10);
  if (!hits.length) return [];
  const snips = db.query<{ id: number; snippet: string }>(SNIPPETS.replace(/\(\$\{kept.*\}\)/, `(${hits.map((h) => h.id).join(",")})`)).all(q.startsWith('"') ? q : `"${q}"*`);
  return hits.map(({ id: _, ...h }) => ({ ...h, snippet: snips.find((s) => s.id === _)?.snippet ?? "" }));
};

test("finds a word in a source's text, marked in its snippet", () => {
  const hits = search("cramming");
  expect(hits.map((h) => h.ref)).toEqual(["a"]);
  expect(hits[0]!.snippet).toContain("[cramming]");
});

test("the start of a word finds it, as FTS5's prefix query does", () => {
  expect(search("cram").map((h) => h.ref)).toEqual(["a"]);
});

test("the kind, ref and item columns aren't searched", () => {
  expect(search("card")).toEqual([]);
});

test("a word inside Japanese is found from its letters side by side, as on the Mac (Codex sweep 4)", () => {
  expect(search('"勉 強"').map((h) => h.ref)).toEqual(["j"]);
  expect(search('"勉 朝"')).toEqual([]);
});

test("a word is found without its accent or in another letter case, Greek and Cyrillic too, as on the Mac (F590)", () => {
  for (const q of ["café", "cafe", "ΜΝΗΜΗ", "μνημη", "Привет", "привет"]) expect([q, search(q).map((h) => h.ref)]).toEqual([q, ["u"]]);
});
