import { accounts, appleKeys, KeysUnavailable, limiter, nonces, openSession, session, verifyApple, type Auth } from "./auth.ts";
import { guarded } from "./guard.ts";
import { encode, importJob, type ImportJob } from "./import.ts";
import { isolated } from "./isolate.ts";

/** Ore Cloud's server (D355, #545). POST /auth/nonce gives the app a nonce to ask Apple with; POST /auth/apple takes
 *  `{ identityToken, nonce }` from Sign in with Apple and answers `{ session, account }`; every other route needs that session as `Authorization: Bearer …` (#551).
 *  DELETE /account deletes the account, all the server keeps about a person. POST /import: a link comes as JSON `{ "url": … }`; a file as the request body with
 *  its name in `?name=`, or, with the files it links to, as JSON `{ name, bytes, beside: { name: bytes } }`
 *  in base64. The reply is JSON: `{ id, files: { path: base64 } }`, or `{ refused }` with the next step. */

/** A source bigger than this is refused before it is read: the Mac's own import has no such limit, but a
 *  server must not let one upload fill its disk. Revisit with the phone's real largest PDFs. */
export const MAX_UPLOAD = 200 * 1024 * 1024;

const HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: HEADERS });
const reply = (text: string) => new Response(text, { headers: { ...HEADERS, "content-type": "application/json" } });

/** Reads one import and answers the reply's JSON text: in a process of its own on the server (isolate.ts). */
export type Run = (job: ImportJob) => Promise<string>;
/** The same import in this process, for tests that serve its pages from a stand-in `fetch`. */
export const inProcess: Run = async (job) => JSON.stringify(encode(await importJob(job)));

/** Imports at once, per account and on the server, and per account in an hour (F762): each
 *  one may hold a 200 MB file in memory and on disk several times over, so a person sending many at once
 *  must not fill the server for everyone. Reopen with the phone's real use (#552). */
export const IMPORTS = { perAccount: 2, total: 4, perHour: 120 };

/** A sign-in is a few hundred bytes; more than this isn't one, and no more than this is read. */
const MAX_SIGN_IN = 16 * 1024;

async function capped(req: Request, max: number): Promise<string | null> {
  if (Number(req.headers.get("content-length") ?? 0) > max) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of (req.body ?? []) as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength;
    if (size > max) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
}

async function signIn(req: Request, auth: Auth, once: ReturnType<typeof nonces>): Promise<Response> {
  const raw = await capped(req, MAX_SIGN_IN);
  if (raw === null) return json({ error: "too big" }, 413);
  let body: { identityToken?: unknown; nonce?: unknown } | null;
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return json({ error: "the body isn't JSON" }, 400);
  }
  const { identityToken: token, nonce } = body ?? {};
  if (typeof token !== "string" || !token || typeof nonce !== "string" || !nonce) return json({ error: "give Apple's identityToken and the nonce it was asked with" }, 400);
  try {
    const apple = await verifyApple(token, auth);
    if (!(await once.spend(nonce, apple.nonce))) throw new Error("its nonce isn't one of ours, was used, or has expired");
    const account = auth.accounts.signIn(apple.sub);
    return json({ session: await session(account, auth), account: { id: account.id, plan: account.plan } });
  } catch (e) {
    // Why is the server's to know (its log), not the caller's.
    console.error("sign-in refused:", e instanceof Error ? e.message : e);
    if (e instanceof KeysUnavailable) return json({ error: "Ore's server can't reach Apple just now. Try again in a minute." }, 503);
    return json({ error: "Apple's sign-in didn't check out. Sign in again." }, 401);
  }
}

const ROUTES: Record<string, string> = { "/health": "GET", "/auth/nonce": "POST", "/auth/apple": "POST", "/account": "DELETE", "/import": "POST" };

/** `who` is the caller's address, for the sign-in limit. */
export const makeHandler = (auth: Auth, allowed = limiter(), run: Run = isolated) => {
  const once = nonces(auth);
  const running = new Map<string, number>();
  const hourly = limiter(IMPORTS.perHour, 3600);
  let total = 0;
  return async function handle(req: Request, who = "unknown"): Promise<Response> {
  const url = new URL(req.url);
  const method = ROUTES[url.pathname];
  if (!method) return json({ error: "not found" }, 404);
  if (req.method !== method) return json({ error: `use ${method}` }, 405);
  // For the deploy's own check that the server is up (#550); says nothing else.
  if (url.pathname === "/health") return json({ ok: true });
  if (url.pathname === "/auth/nonce") return json({ nonce: await once.issue() });
  if (url.pathname === "/auth/apple") return allowed(who) ? signIn(req, auth, once) : json({ error: "Too many sign-ins. Wait a few minutes and try again." }, 429);
  // Signed in or nothing: the session is checked before any of the request is read, and its account must
  // still be the one it was made for (a deleted account's sessions stop at once, for good).
  const bearer = req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  const account = bearer ? await openSession(bearer, auth) : null;
  if (!account) return json({ error: "Sign in to Ore Cloud first." }, 401);
  const sub = account.id;
  if (url.pathname === "/account") {
    auth.accounts.remove(sub);
    return json({ deleted: true });
  }
  const mine = running.get(sub) ?? 0;
  if (mine >= IMPORTS.perAccount) return json({ refused: "Ore's server is still reading the last ones you sent. Wait for one to finish, then send this again." }, 429);
  if (total >= IMPORTS.total) return json({ refused: "Ore's server is busy just now. Try again in a minute." }, 503);
  running.set(sub, mine + 1);
  total++;
  // Counted toward the hour only once the request is one the server reads, not a refused or malformed one.
  const go = async (job: ImportJob) => (hourly(sub) ? reply(await run(job)) : json({ refused: "That's a lot of imports in an hour. Wait a little, then send this again." }, 429));
  try {
    return await importRoute(req, url, go);
  } finally {
    total--;
    const left = (running.get(sub) ?? 1) - 1;
    if (left) running.set(sub, left);
    else running.delete(sub);
  }
  };
};

async function importRoute(req: Request, url: URL, go: (job: ImportJob) => Promise<Response>): Promise<Response> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD) return json({ refused: "This file is too big for Ore's server. Add it on your Mac." }, 413);
  const type = (req.headers.get("content-type") ?? "").toLowerCase();
  if (type.startsWith("application/json")) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "the body isn't JSON" }, 400);
    }
    const b = (body ?? {}) as { url?: unknown; name?: unknown; bytes?: unknown; beside?: unknown };
    if (typeof b.name === "string" && typeof b.bytes === "string") {
      const beside = b.beside && typeof b.beside === "object" ? (b.beside as Record<string, unknown>) : {};
      if (Object.values(beside).some((v) => typeof v !== "string")) return json({ error: "beside holds base64 files by name" }, 400);
      const bytes = (v: string) => new Uint8Array(Buffer.from(v, "base64"));
      return go({ name: b.name, bytes: bytes(b.bytes), beside: Object.fromEntries(Object.entries(beside).map(([n, v]) => [n, bytes(v as string)])) });
    }
    const link = b.url;
    if (typeof link !== "string" || !/^https?:\/\//i.test(link)) return json({ error: "give a link starting with http:// or https://" }, 400);
    return go({ url: link });
  }
  const name = url.searchParams.get("name");
  if (!name) return json({ error: "a file needs its name in ?name=" }, 400);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength > MAX_UPLOAD) return json({ refused: "This file is too big for Ore's server. Add it on your Mac." }, 413);
  return go({ name, bytes });
}

/** Tools that open links themselves, past the guard on private addresses (guard.ts): the server won't
 *  start where one is installed (F763). A source that needs one says "Add it on your Mac". */
export const unsafeTools = () => ["yt-dlp"].filter((t) => Bun.which(t, { PATH: process.env.PATH }));

/** The caller's address. Behind Ore's own proxy (ORE_BEHIND_PROXY, #550) the socket is always the proxy's,
 *  so it is the last address in X-Forwarded-For, the one the proxy itself wrote; a header is never believed
 *  otherwise, since any caller can send one. */
export const caller = (req: Request, socket: string | undefined, behindProxy: boolean) =>
  (behindProxy ? req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() : undefined) || socket || "unknown";

/** The server's settings from its environment; it won't start without a session secret of its own. */
function authFromEnv(): Auth {
  const secret = process.env.ORE_SESSION_SECRET ?? "";
  if (secret.length < 32) throw new Error("Set ORE_SESSION_SECRET to at least 32 random characters (openssl rand -base64 48). It signs every session: keep it out of the repo.");
  // Named outright: a default beside wherever it was started from would open on an empty one after a move.
  const db = process.env.ORE_CLOUD_DB ?? "";
  if (!db.startsWith("/")) throw new Error("Set ORE_CLOUD_DB to the full path of the accounts file (it is made if missing).");
  return {
    secret,
    audience: (process.env.ORE_APPLE_AUDIENCE ?? "com.tylerpoelking.ore,com.tylerpoelking.ore.phone").split(",").map((a) => a.trim()).filter(Boolean),
    keys: appleKeys(),
    accounts: accounts(db),
  };
}

if (import.meta.main) {
  const tools = unsafeTools();
  if (tools.length) throw new Error(`Remove ${tools.join(", ")} from the server: it opens links itself, past Ore's guard on private addresses.`);
  const handle = makeHandler(authFromEnv());
  // Nothing the server opens may reach its own network; each import's process sets the same guard.
  globalThis.fetch = guarded(globalThis.fetch);
  const server = Bun.serve({ port: Number(process.env.PORT ?? 8787), hostname: process.env.HOST ?? "127.0.0.1", fetch: (req, server) => handle(req, caller(req, server.requestIP(req)?.address, !!process.env.ORE_BEHIND_PROXY)), maxRequestBodySize: MAX_UPLOAD + 1 });
  console.log(`Ore Cloud listening on http://${server.hostname}:${server.port}`);
}
