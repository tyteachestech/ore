import { Database } from "bun:sqlite";

/** Accounts for Ore Cloud (#551): Sign in with Apple only (#545). The server checks Apple's identity token
 *  itself, then gives the device a session of its own, signed with the server's secret, so no session is
 *  stored. About a person it keeps the account id Apple gives Ore for them and their plan; nothing else. */

export interface Account {
  id: string;
  plan: string;
}

export interface Accounts {
  /** The account for Apple's id, made on the free plan the first time. */
  signIn(id: string): Account;
  get(id: string): Account | null;
  /** Deletes the account: all the server holds about the person. Their sessions stop working with it. */
  remove(id: string): void;
  all(): Account[];
}

export function accounts(path: string): Accounts {
  const db = new Database(path, { create: true, strict: true });
  db.run("CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, plan TEXT NOT NULL DEFAULT 'free')");
  return {
    signIn(id) {
      db.query("INSERT OR IGNORE INTO accounts (id) VALUES (?)").run(id);
      return db.query("SELECT id, plan FROM accounts WHERE id = ?").get(id) as Account;
    },
    get: (id) => (db.query("SELECT id, plan FROM accounts WHERE id = ?").get(id) as Account | null) ?? null,
    remove: (id) => void db.query("DELETE FROM accounts WHERE id = ?").run(id),
    all: () => db.query("SELECT id, plan FROM accounts ORDER BY id").all() as Account[],
  };
}

export interface Auth {
  /** The apps Apple's token may be for: Ore's bundle ids (the Mac's and the iPhone's). */
  audience: string[];
  /** Signs sessions; at least 32 characters, from the server's environment, never in the repo. */
  secret: string;
  /** Apple's public keys. */
  keys: () => Promise<(JsonWebKey & { kid?: string })[]>;
  accounts: Accounts;
  /** Seconds since 1970; the clock, for tests. */
  now?: () => number;
}

const clock = (a: { now?: () => number }) => (a.now ?? (() => Math.floor(Date.now() / 1000)))();
const text = new TextEncoder();
const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));
const json = (s: string): Record<string, unknown> | null => {
  try {
    const v: unknown = JSON.parse(Buffer.from(s, "base64url").toString());
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const APPLE = "https://appleid.apple.com";

/** Apple's keys from its own address, kept for an hour (they change rarely; a failed fetch isn't kept). */
export function appleKeys(real: typeof fetch = fetch, now = () => Math.floor(Date.now() / 1000)): Auth["keys"] {
  let kept: { at: number; keys: JsonWebKey[] } | undefined;
  return async () => {
    if (kept && now() - kept.at < 3600) return kept.keys;
    const res = await real(`${APPLE}/auth/keys`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Apple's keys answered HTTP ${res.status}`);
    const keys = ((await res.json()) as { keys?: JsonWebKey[] }).keys;
    if (!Array.isArray(keys) || !keys.length) throw new Error("Apple's keys came back empty");
    kept = { at: now(), keys };
    return keys;
  };
}

/** The account id (`sub`) in an identity token from Sign in with Apple, once it is shown to be Apple's
 *  (RS256 by one of Apple's keys, never another algorithm), for Ore, and not expired. Throws otherwise. */
export async function verifyApple(token: string, auth: Auth): Promise<string> {
  const refuse = (why: string): never => {
    throw new Error(`not a sign-in from Apple: ${why}`);
  };
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[2]) refuse("not a token");
  const [h, b, s] = parts as [string, string, string];
  const head = json(h);
  const claims = json(b);
  if (!head || !claims) return refuse("not a token");
  if (head.alg !== "RS256") refuse("its algorithm");
  const jwk = (await auth.keys()).find((k) => k.kid === head.kid);
  if (!jwk) return refuse("its key");
  const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromB64(s), text.encode(`${h}.${b}`)))) refuse("its signature");
  if (claims.iss !== APPLE) refuse("its issuer");
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.some((a) => typeof a === "string" && auth.audience.includes(a))) refuse("it is for another app");
  if (typeof claims.exp !== "number" || claims.exp <= clock(auth)) refuse("it has expired");
  if (typeof claims.sub !== "string" || !claims.sub) refuse("it names no one");
  return claims.sub as string;
}

const SESSION_DAYS = 30;
const hmac = (secret: string) => crypto.subtle.importKey("raw", text.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

/** A session for an account: who, until when, and the server's signature over both. */
export async function session(sub: string, auth: Pick<Auth, "secret" | "now">): Promise<string> {
  const body = Buffer.from(JSON.stringify({ sub, exp: clock(auth) + SESSION_DAYS * 86400 })).toString("base64url");
  const sig = await crypto.subtle.sign("HMAC", await hmac(auth.secret), text.encode(`v1.${body}`));
  return `v1.${body}.${Buffer.from(sig).toString("base64url")}`;
}

/** How many sign-ins one address may try in a quarter hour, in this process's memory: one server (#545).
 *  Reopen with a shared store if a second server ever runs. */
export function limiter(max = 10, windowSeconds = 900, now = () => Math.floor(Date.now() / 1000)) {
  const seen = new Map<string, number[]>();
  return (who: string): boolean => {
    const t = now();
    const recent = (seen.get(who) ?? []).filter((at) => t - at < windowSeconds);
    if (recent.length >= max) {
      seen.set(who, recent);
      return false;
    }
    recent.push(t);
    seen.set(who, recent);
    if (seen.size > 10_000) for (const [k, v] of seen) if (v.every((at) => t - at >= windowSeconds)) seen.delete(k);
    return true;
  };
}

/** The account a session is for; null when it isn't one of ours, was changed, or has expired. */
export async function openSession(token: string, auth: Pick<Auth, "secret" | "now">): Promise<string | null> {
  const [v, body, sig, more] = token.split(".");
  if (v !== "v1" || !body || !sig || more !== undefined) return null;
  if (!(await crypto.subtle.verify("HMAC", await hmac(auth.secret), fromB64(sig), text.encode(`v1.${body}`)))) return null;
  const claims = json(body);
  if (!claims || typeof claims.sub !== "string" || !claims.sub || typeof claims.exp !== "number" || claims.exp <= clock(auth)) return null;
  return claims.sub;
}
