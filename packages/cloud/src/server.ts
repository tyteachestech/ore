import { accounts, appleKeys, limiter, openSession, session, verifyApple, type Auth } from "./auth.ts";
import { guarded } from "./guard.ts";
import { importJob, type ImportReply } from "./import.ts";

/** Ore Cloud's server (D355, #545). POST /auth/apple takes `{ identityToken }` from Sign in with Apple and
 *  answers `{ session, account }`; every other route needs that session as `Authorization: Bearer …` (#551).
 *  DELETE /account deletes the account, all the server keeps about a person. POST /import: a link comes as JSON `{ "url": … }`; a file as the request body with
 *  its name in `?name=`, or, with the files it links to, as JSON `{ name, bytes, beside: { name: bytes } }`
 *  in base64. The reply is JSON: `{ id, files: { path: base64 } }`, or `{ refused }` with the next step. */

/** A source bigger than this is refused before it is read: the Mac's own import has no such limit, but a
 *  server must not let one upload fill its disk. Revisit with the phone's real largest PDFs. */
export const MAX_UPLOAD = 200 * 1024 * 1024;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });

const encode = (r: ImportReply) =>
  "refused" in r ? r : { id: r.id, files: Object.fromEntries(Object.entries(r.files).map(([p, b]) => [p, Buffer.from(b).toString("base64")])) };

/** A sign-in is a few hundred bytes; more than this isn't one. */
const MAX_SIGN_IN = 16 * 1024;

async function signIn(req: Request, auth: Auth): Promise<Response> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_SIGN_IN) return json({ error: "too big" }, 413);
  const raw = await req.text();
  if (raw.length > MAX_SIGN_IN) return json({ error: "too big" }, 413);
  let token: unknown;
  try {
    token = (JSON.parse(raw) as { identityToken?: unknown } | null)?.identityToken;
  } catch {
    return json({ error: "the body isn't JSON" }, 400);
  }
  if (typeof token !== "string" || !token) return json({ error: "give Apple's identityToken" }, 400);
  let sub: string;
  try {
    sub = await verifyApple(token, auth);
  } catch (e) {
    // Why is the server's to know (its log), not the caller's.
    console.error("sign-in refused:", e instanceof Error ? e.message : e);
    return json({ error: "Apple's sign-in didn't check out. Sign in again." }, 401);
  }
  return json({ session: await session(sub, auth), account: auth.accounts.signIn(sub) });
}

const ROUTES: Record<string, string> = { "/auth/apple": "POST", "/account": "DELETE", "/import": "POST" };

/** `who` is the caller's address (Bun's `server.requestIP`), for the sign-in limit. */
export const makeHandler = (auth: Auth, allowed = limiter()) => async function handle(req: Request, who = "unknown"): Promise<Response> {
  const url = new URL(req.url);
  const method = ROUTES[url.pathname];
  if (!method) return json({ error: "not found" }, 404);
  if (req.method !== method) return json({ error: `use ${method}` }, 405);
  if (url.pathname === "/auth/apple") return allowed(who) ? signIn(req, auth) : json({ error: "Too many sign-ins. Wait a few minutes and try again." }, 429);
  // Signed in or nothing: the session is checked before any of the request is read, and its account must
  // still be there (a deleted account's sessions stop at once).
  const bearer = req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  const sub = bearer ? await openSession(bearer, auth) : null;
  if (!sub || !auth.accounts.get(sub)) return json({ error: "Sign in to Ore Cloud first." }, 401);
  if (url.pathname === "/account") {
    auth.accounts.remove(sub);
    return json({ deleted: true });
  }
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
      return json(encode(await importJob({ name: b.name, bytes: bytes(b.bytes), beside: Object.fromEntries(Object.entries(beside).map(([n, v]) => [n, bytes(v as string)])) })));
    }
    const link = b.url;
    if (typeof link !== "string" || !/^https?:\/\//i.test(link)) return json({ error: "give a link starting with http:// or https://" }, 400);
    return json(encode(await importJob({ url: link })));
  }
  const name = url.searchParams.get("name");
  if (!name) return json({ error: "a file needs its name in ?name=" }, 400);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength > MAX_UPLOAD) return json({ refused: "This file is too big for Ore's server. Add it on your Mac." }, 413);
  return json(encode(await importJob({ name, bytes })));
};

/** The server's settings from its environment; it won't start without a session secret of its own. */
function authFromEnv(): Auth {
  const secret = process.env.ORE_SESSION_SECRET ?? "";
  if (secret.length < 32) throw new Error("Set ORE_SESSION_SECRET to at least 32 random characters (openssl rand -base64 48). It signs every session: keep it out of the repo.");
  return {
    secret,
    audience: (process.env.ORE_APPLE_AUDIENCE ?? "com.tylerpoelking.ore,com.tylerpoelking.ore.phone").split(",").map((a) => a.trim()).filter(Boolean),
    keys: appleKeys(),
    accounts: accounts(process.env.ORE_CLOUD_DB ?? "ore-cloud.db"),
  };
}

if (import.meta.main) {
  // Every link the import opens, its images and redirects too, must be on the public web.
  const auth = authFromEnv();
  globalThis.fetch = guarded(globalThis.fetch);
  const server = Bun.serve({ port: Number(process.env.PORT ?? 8787), hostname: process.env.HOST ?? "127.0.0.1", fetch: ((handle) => (req: Request, server: { requestIP(r: Request): { address: string } | null }) => handle(req, server.requestIP(req)?.address))(makeHandler(auth)), maxRequestBodySize: MAX_UPLOAD + 1 });
  console.log(`Ore Cloud listening on http://${server.hostname}:${server.port}`);
}
