// bun:sqlite for the core on iPhone (phase 0 feel test): the same calls over sql.js (SQLite in
// WebAssembly). The index is a disposable cache (D5), so it lives in memory and is rebuilt at launch.
// sql.js's stock build has FTS4, not FTS5: the search table is created as FTS4, so library search
// (bm25 ranking) doesn't work on the phone yet. Phase 1 uses the phone's own SQLite instead.
import initSqlJs, { type Database as SqlJsDb, type SqlValue } from "sql.js";

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
export async function ready(wasmUrl: string) {
  SQL = await initSqlJs({ locateFile: () => wasmUrl });
}

const open = new Map<string, SqlJsDb>();
const fix = (sql: string) => sql.replace(/using fts5/gi, "using fts4").replace(/pragma (busy_timeout|journal_mode)[^;]*;?/gi, "");
const bind = (p: unknown[]): SqlValue[] => p.map((v) => (typeof v === "boolean" ? Number(v) : v === undefined ? null : (v as SqlValue)));
const params = (p: unknown[]) => bind(p.length === 1 && Array.isArray(p[0]) ? p[0] : p);

export class Database {
  private db: SqlJsDb;
  /** One database per path for the life of the app: every command opens the index, and rebuilding it each time would be slow. */
  constructor(path: string, _o?: unknown) {
    if (!SQL) throw new Error("sqlite not ready");
    let db = open.get(path);
    if (!db) open.set(path, (db = new SQL.Database()));
    this.db = db;
  }
  exec(sql: string) {
    const s = fix(sql);
    if (s.trim()) this.db.exec(s);
  }
  run(sql: string, p: unknown[] = []) {
    const s = fix(sql);
    if (s.trim()) this.db.run(s, bind(p));
  }
  query<T = Record<string, SqlValue>, _P = unknown>(sql: string) {
    const db = this.db;
    const all = (...p: unknown[]): T[] => {
      const st = db.prepare(fix(sql));
      try {
        st.bind(params(p));
        const out: T[] = [];
        while (st.step()) out.push(st.getAsObject() as T);
        return out;
      } finally {
        st.free();
      }
    };
    return {
      all,
      get: (...p: unknown[]): T | null => all(...p)[0] ?? null,
      run: (...p: unknown[]) => db.run(fix(sql), params(p)),
      values: (...p: unknown[]) => all(...p).map((r) => Object.values(r as object)),
    };
  }
  prepare<T = Record<string, SqlValue>>(sql: string) {
    return this.query<T>(sql);
  }
  transaction<A extends unknown[], R>(fn: (...a: A) => R) {
    return (...a: A): R => {
      this.db.exec("begin");
      try {
        const r = fn(...a);
        this.db.exec("commit");
        return r;
      } catch (e) {
        this.db.exec("rollback");
        throw e;
      }
    };
  }
  close() {}
}
