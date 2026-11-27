import { Database } from "bun:sqlite";
import { randomBytes } from "node:crypto";

/** Accounts for Ore Cloud (#551): Sign in with Apple only (#545). The server checks Apple's identity token
 *  itself, then gives the device a session of its own, signed with the server's secret, so no session is
 *  stored. About a person it keeps the account id Apple gives Ore for them and their plan; nothing else. */

export interface Account {
  id: string;
  plan: string;
}

export interface Accounts {
  /** The account for Apple's id, made on the free plan the first time. */
  signIn(id: string): Account & { gen: string };
  /** `gen` is made new with the account: a session carries it, so one from before a delete never works
   *  again, also after the same person signs in anew. */
  get(id: string): (Account & { gen: string }) | null;
  /** Deletes the account: all the server holds about the person. Their sessions stop working with it. */
  remove(id: string): void;
  all(): Account[];
}

export function accounts(path: string): Accounts {
  const db = new Database(path, { create: true, strict: true });
  db.run("CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, plan TEXT NOT NULL DEFAULT 'free', gen TEXT NOT NULL)");
  const get: Accounts["get"] = (id) => (db.query("SELECT id, plan, gen FROM accounts WHERE id = ?").get(id) as (Account & { gen: string }) | null) ?? null;
  return {
    signIn(id) {
      db.query("INSERT OR IGNORE INTO accounts (id, gen) VALUES (?, ?)").run(id, randomBytes(12).toString("base64url"));
      return get(id)!;
    },
    get,
    remove: (id) => void db.query("DELETE FROM accounts WHERE id = ?").run(id),
    all: () => db.query("SELECT id, plan FROM accounts ORDER BY id").all() as Account[],
  };
}

type Jwk = JsonWebKey & { kid?: string };

export interface Auth {
  /** The apps Apple's token may be for: Ore's bundle ids (the Mac's and the iPhone's). */
  audience: string[];
  /** Signs sessions and sign-in nonces; at least 32 characters, from the server's environment, never in the repo. */
  secret: string;
  /** Apple's public keys; asked again with `missing` when a token names a key not among them. */
  keys: (missing?: boolean) => Promise<Jwk[]>;
  accounts: Accounts;
  /** Seconds since 1970; the clock, for tests. */
  now?: () => number;
}

const seconds = () => Math.floor(Date.now() / 1000);
const clock = (a: { now?: () => number }) => (a.now ?? seconds)();
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

/** Apple's keys couldn't be had: the server's trouble (or Apple's), not a bad sign-in. */
export class KeysUnavailable extends Error {}

/** Apple's keys from its own address, kept for an hour. When the fetch fails the kept ones still serve;
 *  when a token names a key not among them (Apple changed keys), they are fetched again, at most once a minute. */
export function appleKeys(real: typeof fetch = fetch, now = seconds): Auth["keys"] {
  let kept: { at: number; keys: Jwk[] } | undefined;
  return async (missing = false) => {
    const age = kept ? now() - kept.at : Infinity;
    if (kept && age < (missing ? 60 : 3600)) return kept.keys;
    try {
      const res = await real(`${APPLE}/auth/keys`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const keys = ((await res.json()) as { keys?: Jwk[] }).keys;
      if (!Array.isArray(keys) || !keys.length) throw new Error("empty");
      kept = { at: now(), keys };
      return keys;
    } catch (e) {
      if (kept) return kept.keys;
      throw new KeysUnavailable(`Apple's keys: ${e instanceof Error ? e.message : e}`);
    }
  };
}

const hmac = (secret: string) => crypto.subtle.importKey("raw", text.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

/** `kind.body.signature`: a value only this server could have written. */
async function signed(kind: string, payload: unknown, secret: string): Promise<string> {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = await crypto.subtle.sign("HMAC", await hmac(secret), text.encode(`${kind}.${body}`));
  return `${kind}.${body}.${Buffer.from(sig).toString("base64url")}`;
}

/** What a signed value holds; null when it isn't ours, was changed, or has expired. */
async function opened(kind: string, token: string, auth: Pick<Auth, "secret" | "now">): Promise<Record<string, unknown> | null> {
  const [k, body, sig, more] = token.split(".");
  if (k !== kind || !body || !sig || more !== undefined) return null;
  if (!(await crypto.subtle.verify("HMAC", await hmac(auth.secret), fromB64(sig), text.encode(`${kind}.${body}`)))) return null;
  const claims = json(body);
  return claims && typeof claims.exp === "number" && claims.exp > clock(auth) ? claims : null;
}

const NONCE_SECONDS = 300;

/** Sign-in nonces (the app asks for one, hands Apple its SHA-256, and sends both back): Apple's token then
 *  answers this one request, so a token read from somewhere can't be sent again for a session. Each nonce
 *  works once; the used ones are remembered in this process until they expire (one server, #545). */
export function nonces(auth: Pick<Auth, "secret" | "now">) {
  const used = new Map<string, number>();
  return {
    issue: () => signed("n1", { r: randomBytes(18).toString("base64url"), exp: clock(auth) + NONCE_SECONDS }, auth.secret),
    /** Whether Apple's token carries this nonce's hash; spends the nonce. */
    async spend(nonce: string, claimed: unknown): Promise<boolean> {
      const now = clock(auth);
      for (const [n, exp] of used) if (exp <= now) used.delete(n);
      const claims = await opened("n1", nonce, auth);
      if (!claims || used.has(nonce)) return false;
      const hash = Buffer.from(await crypto.subtle.digest("SHA-256", text.encode(nonce))).toString("hex");
      if (claimed !== hash) return false;
      used.set(nonce, claims.exp as number);
      return true;
    },
  };
}

/** The claims of an identity token from Sign in with Apple, once it is shown to be Apple's (RS256 by one
 *  of Apple's keys, never another algorithm), for Ore, and not expired. Throws otherwise. */
export async function verifyApple(token: string, auth: Auth): Promise<{ sub: string; nonce?: unknown }> {
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
  const kid = head.kid;
  if (typeof kid !== "string" || !kid) return refuse("its key");
  const find = (keys: Jwk[]) => keys.find((k) => k.kid === kid);
  const jwk = find(await auth.keys()) ?? find(await auth.keys(true));
  if (!jwk) return refuse("its key");
  const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromB64(s), text.encode(`${h}.${b}`)))) refuse("its signature");
  if (claims.iss !== APPLE) refuse("its issuer");
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.some((a) => typeof a === "string" && auth.audience.includes(a))) refuse("it is for another app");
  if (typeof claims.exp !== "number" || claims.exp <= clock(auth)) refuse("it has expired");
  if (typeof claims.sub !== "string" || !claims.sub) refuse("it names no one");
  return { sub: claims.sub as string, nonce: claims.nonce };
}

const SESSION_DAYS = 30;

/** A session for an account: who, which making of the account, until when, and the server's signature. */
export const session = (account: { id: string; gen: string }, auth: Pick<Auth, "secret" | "now">) =>
  signed("v1", { sub: account.id, gen: account.gen, exp: clock(auth) + SESSION_DAYS * 86400 }, auth.secret);

/** The account a session is for; null when it isn't one of ours, was changed, has expired, or its account
 *  was deleted since (also when the same person has signed in anew). */
export async function openSession(token: string, auth: Pick<Auth, "secret" | "now" | "accounts">): Promise<Account | null> {
  const claims = await opened("v1", token, auth);
  if (!claims || typeof claims.sub !== "string") return null;
  const account = auth.accounts.get(claims.sub);
  return account && account.gen === claims.gen ? { id: account.id, plan: account.plan } : null;
}

/** An address as the limiter counts it: an IPv6 one by its /64, which is one network's to hand out. */
const network = (who: string) => (who.includes(":") && !who.startsWith("::ffff:") ? who.split(":").slice(0, 4).join(":") : who);

/** How many sign-ins one address may try in a quarter hour, in this process's memory: one server (#545).
 *  Reopen with a shared store if a second server ever runs. It remembers at most `cap` addresses: past
 *  that the oldest are forgotten, so a flood of addresses can't fill memory or slow each sign-in. */
export function limiter(max = 10, windowSeconds = 900, now = seconds, cap = 10_000) {
  const seen = new Map<string, number[]>();
  return (who: string): boolean => {
    const key = network(who);
    const t = now();
    const recent = (seen.get(key) ?? []).filter((at) => t - at < windowSeconds);
    const ok = recent.length < max;
    if (ok) recent.push(t);
    seen.delete(key);
    seen.set(key, recent);
    while (seen.size > cap) seen.delete(seen.keys().next().value!);
    return ok;
  };
}
