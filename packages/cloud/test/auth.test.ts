import { beforeAll, expect, test } from "bun:test";
import { accounts, appleKeys, KeysUnavailable, limiter, nonces, openSession, session, verifyApple, type Auth } from "../src/auth.ts";
import { caller, makeHandler } from "../src/server.ts";

// Sign in with Apple (#551): the server takes Apple's identity token, checks it is Apple's and meant for
// Ore, and gives the device its own session. Apple's keys here are a pair made for the test.
const b64 = (v: unknown) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
let pair: CryptoKeyPair;
let other: CryptoKeyPair;
let jwk: JsonWebKey & { kid: string };
const RSA = { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };
const NOW = 1_800_000_000;

async function apple(claims: Record<string, unknown> = {}, by = pair, header: Record<string, unknown> = {}) {
  const head = b64({ alg: "RS256", kid: "test-key", ...header });
  const body = b64({ iss: "https://appleid.apple.com", aud: "com.tylerpoelking.ore.phone", sub: "001.abc", iat: NOW - 10, exp: NOW + 600, ...claims });
  const sig = await crypto.subtle.sign(RSA.name, by.privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${Buffer.from(sig).toString("base64url")}`;
}

let auth: Auth;
beforeAll(async () => {
  pair = (await crypto.subtle.generateKey(RSA, true, ["sign", "verify"])) as CryptoKeyPair;
  other = (await crypto.subtle.generateKey(RSA, true, ["sign", "verify"])) as CryptoKeyPair;
  jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "test-key" };
  auth = { audience: ["com.tylerpoelking.ore", "com.tylerpoelking.ore.phone"], secret: "s".repeat(32), keys: async () => [jwk], accounts: accounts(":memory:"), now: () => NOW };
});

const sha = async (v: string) => Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v))).toString("hex");
const post = (handle: ReturnType<typeof makeHandler>, path: string, body?: unknown, who?: string) =>
  handle(new Request(`http://x${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }), who);
/** What the app does: asks for a nonce, asks Apple with its hash, sends both. */
async function signedIn(handle: ReturnType<typeof makeHandler>, claims: Record<string, unknown> = {}) {
  const { nonce } = (await (await post(handle, "/auth/nonce")).json()) as { nonce: string };
  const identityToken = await apple({ nonce: await sha(nonce), ...claims });
  return { nonce, identityToken, res: await post(handle, "/auth/apple", { identityToken, nonce }) };
}

test("Apple's token for Ore is accepted and names the account", async () => {
  expect((await verifyApple(await apple(), auth)).sub).toBe("001.abc");
});

test("a token that is expired, for another app, from another issuer, signed by another key, unsigned or garbled is refused", async () => {
  const bad = [
    await apple({ exp: NOW - 1 }),
    await apple({ aud: "com.someone.else" }),
    await apple({ iss: "https://evil.example" }),
    await apple({}, other),
    await apple({}, pair, { alg: "none" }),
    await apple({}, pair, { alg: "HS256" }),
    await apple({}, pair, { kid: "unknown" }),
    await apple({}, pair, { kid: undefined }),
    await apple({ sub: "" }),
    (await apple()).split(".").slice(0, 2).join(".") + ".",
    "not.a.token",
    "",
  ];
  for (const t of bad) expect([t.slice(0, 20), await verifyApple(t, auth).catch(() => null)]).toEqual([t.slice(0, 20), null]);
  // A key with no name is never picked by a token with none.
  expect(await verifyApple(await apple({}, pair, { kid: undefined }), { ...auth, keys: async () => [{ ...jwk, kid: undefined }] }).catch(() => null)).toBeNull();
});

test("a session names its account until it expires, and one that was changed or signed with another secret is refused", async () => {
  const me = auth.accounts.signIn("001.abc");
  const s = await session(me, auth);
  expect(await openSession(s, auth)).toEqual({ id: "001.abc", plan: "free" });
  expect(await openSession(s, { ...auth, now: () => NOW + 31 * 86400 })).toBeNull();
  expect(await openSession(s, { ...auth, secret: "t".repeat(32) })).toBeNull();
  const [v, body, sig] = s.split(".");
  expect(await openSession(`${v}.${b64({ sub: "001.someone-else", gen: me.gen, exp: NOW + 999 })}.${sig}`, auth)).toBeNull();
  expect(await openSession(`${v}.${body}.`, auth)).toBeNull();
  expect(await openSession("", auth)).toBeNull();
  // A nonce is signed by the same secret but is never a session.
  expect(await openSession(await nonces(auth).issue(), auth)).toBeNull();
});

test("signing in makes the account once, on the free plan, and nothing else is kept about it", async () => {
  const a: Auth = { ...auth, accounts: accounts(":memory:") };
  const handle = makeHandler(a);
  const first = (await (await signedIn(handle)).res.json()) as { session: string; account: { id: string; plan: string } };
  expect(first.account).toEqual({ id: "001.abc", plan: "free" });
  expect(await openSession(first.session, a)).toEqual({ id: "001.abc", plan: "free" });
  await signedIn(handle);
  expect(a.accounts.all()).toEqual([{ id: "001.abc", plan: "free" }]);
  expect((await signedIn(handle, { exp: NOW - 1 })).res.status).toBe(401);
  expect((await post(handle, "/auth/apple", {})).status).toBe(400);
  expect((await post(handle, "/auth/apple", { identityToken: await apple() })).status).toBe(400);
  expect(a.accounts.all().length).toBe(1);
});

test("Apple's token answers one request: sent again, with another nonce, a made-up one or a stale one, it gets no session", async () => {
  const a: Auth = { ...auth, accounts: accounts(":memory:") };
  const handle = makeHandler(a, () => true);
  const good = await signedIn(handle);
  expect(good.res.status).toBe(200);
  // The same token and nonce again (read from a log, say).
  expect((await post(handle, "/auth/apple", { identityToken: good.identityToken, nonce: good.nonce })).status).toBe(401);
  // The same token and nonce twice at once: one session, not two.
  const { nonce: n2 } = (await (await post(handle, "/auth/nonce")).json()) as { nonce: string };
  const t2 = await apple({ nonce: await sha(n2) });
  const both = await Promise.all([post(handle, "/auth/apple", { identityToken: t2, nonce: n2 }), post(handle, "/auth/apple", { identityToken: t2, nonce: n2 })]);
  expect(both.map((r) => r.status).sort()).toEqual([200, 401]);
  // A token asked with no nonce, or with another one's hash.
  const { nonce } = (await (await post(handle, "/auth/nonce")).json()) as { nonce: string };
  expect((await post(handle, "/auth/apple", { identityToken: await apple(), nonce })).status).toBe(401);
  expect((await post(handle, "/auth/apple", { identityToken: await apple({ nonce: await sha("another") }), nonce })).status).toBe(401);
  // A nonce the server never gave.
  expect((await post(handle, "/auth/apple", { identityToken: await apple({ nonce: await sha("n1.made.up") }), nonce: "n1.made.up" })).status).toBe(401);
  // One it gave more than five minutes ago.
  let now = NOW;
  const late = makeHandler({ ...a, now: () => now }, () => true);
  const asked = (await (await post(late, "/auth/nonce")).json()) as { nonce: string };
  now += 301;
  expect((await post(late, "/auth/apple", { identityToken: await apple({ nonce: await sha(asked.nonce), exp: now + 600 }), nonce: asked.nonce })).status).toBe(401);
});

test("every route but sign-in needs a session: none, a bad one or an expired one is refused before anything is read", async () => {
  const handle = makeHandler(auth);
  const imp = (authz?: string, a = auth) => makeHandler(a)(new Request("http://x/import", { method: "POST", headers: { "content-type": "application/json", ...(authz ? { authorization: authz } : {}) }, body: JSON.stringify({ url: "file:///etc/passwd" }) }));
  expect((await imp()).status).toBe(401);
  expect((await imp("Bearer nope")).status).toBe(401);
  const s = await session(auth.accounts.signIn("001.abc"), auth);
  expect((await imp(`Bearer ${await session({ id: "001.never-signed-in", gen: "x" }, auth)}`)).status).toBe(401);
  expect((await imp(`Bearer ${s}`, { ...auth, now: () => NOW + 31 * 86400 })).status).toBe(401);
  // Signed in, the request is read (and this one refused for what it asks).
  expect((await imp(`Bearer ${s}`)).status).toBe(400);
  expect((await handle(new Request("http://x/nope", { method: "POST" }))).status).toBe(404);
});

test("Apple's keys are fetched once and kept for an hour; a failed fetch isn't kept, and later the old keys serve through one", async () => {
  let calls = 0;
  let fail = true;
  const real = (async () => {
    calls++;
    if (fail) return new Response("no", { status: 500 });
    return Response.json({ keys: [jwk] });
  }) as unknown as typeof fetch;
  let now = NOW;
  const keys = appleKeys(real, () => now);
  await expect(keys()).rejects.toBeInstanceOf(KeysUnavailable);
  fail = false;
  expect((await keys()).length).toBe(1);
  await keys();
  expect(calls).toBe(2);
  now += 3601;
  await keys();
  expect(calls).toBe(3);
  now += 3601;
  fail = true;
  expect((await keys()).length).toBe(1);
  expect(calls).toBe(4);
});

test("a token signed with a key Apple just started using is accepted: the keys are fetched again, at most once a minute", async () => {
  const next = { ...(await crypto.subtle.exportKey("jwk", other.publicKey)), kid: "new-key" };
  let served = [jwk];
  let calls = 0;
  let now = NOW;
  const real = (async () => (calls++, Response.json({ keys: served }))) as unknown as typeof fetch;
  const a: Auth = { ...auth, keys: appleKeys(real, () => now), now: () => now };
  await verifyApple(await apple(), a);
  served = [jwk, next];
  now += 61;
  expect((await verifyApple(await apple({ exp: now + 600 }, other, { kid: "new-key" }), a)).sub).toBe("001.abc");
  expect(calls).toBe(2);
  // An unknown key asked for over and over doesn't hammer Apple.
  for (let i = 0; i < 5; i++) await verifyApple(await apple({ exp: now + 600 }, pair, { kid: "nobody" }), a).catch(() => null);
  expect(calls).toBe(2);
});

test("when Apple's keys can't be had, sign-in says to try again shortly, not that the sign-in was bad", async () => {
  const handle = makeHandler({ ...auth, keys: async () => { throw new KeysUnavailable("down"); } });
  expect((await signedIn(handle)).res.status).toBe(503);
});

test("a sign-in body is read only up to its limit, whatever its length header says", async () => {
  const handle = makeHandler(auth, () => true);
  let sent = 0;
  const big = new ReadableStream<Uint8Array>({
    pull(c) {
      sent += 4096;
      if (sent > 10 * 1024 * 1024) c.close();
      else c.enqueue(new Uint8Array(4096).fill(97));
    },
  });
  const res = await handle(new Request("http://x/auth/apple", { method: "POST", body: big, duplex: "half" } as RequestInit));
  expect(res.status).toBe(413);
  expect(sent).toBeLessThan(64 * 1024);
});

test("deleting the account removes all the server holds, and its sessions stop working for good, also once the person signs in anew", async () => {
  const a: Auth = { ...auth, accounts: accounts(":memory:") };
  const handle = makeHandler(a);
  a.accounts.signIn("001.stays");
  const s = await session(a.accounts.signIn("001.gone"), a);
  const del = () => handle(new Request("http://x/account", { method: "DELETE", headers: { authorization: `Bearer ${s}` } }));
  expect((await handle(new Request("http://x/account", { method: "DELETE" }))).status).toBe(401);
  expect(await (await del()).json()).toEqual({ deleted: true });
  expect(a.accounts.all()).toEqual([{ id: "001.stays", plan: "free" }]);
  expect((await del()).status).toBe(401);
  const again = a.accounts.signIn("001.gone");
  expect(await openSession(s, a)).toBeNull();
  expect(await openSession(await session(again, a), a)).toEqual({ id: "001.gone", plan: "free" });
});

test("one address gets ten sign-in tries in a quarter hour; another address, or a later hour, is not held back", async () => {
  let now = NOW;
  const handle = makeHandler(auth, limiter(10, 900, () => now));
  const tryIt = (who: string) => post(handle, "/auth/apple", {}, who);
  for (let i = 0; i < 10; i++) expect((await tryIt("1.2.3.4")).status).toBe(400);
  expect((await tryIt("1.2.3.4")).status).toBe(429);
  expect((await tryIt("5.6.7.8")).status).toBe(400);
  now += 901;
  expect((await tryIt("1.2.3.4")).status).toBe(400);
});

test("the limit counts an IPv6 network as one caller, and forgets the oldest callers past its cap", () => {
  const ok = limiter(2, 900, () => NOW, 3);
  expect([ok("2001:db8:1:2::1"), ok("2001:db8:1:2:ffff::9"), ok("2001:db8:1:2::3")]).toEqual([true, true, false]);
  expect(ok("2001:db8:1:3::1")).toBe(true);
  const short = limiter(1, 900, () => NOW);
  expect([short("2001:db8::1"), short("2001:0db8:0:0::2"), short("2001:db8:0:1::1")]).toEqual([true, false, true]);
  // Three more callers push the first network out of memory; nothing grows past the cap.
  for (const who of ["a", "b", "c"]) ok(who);
  expect(ok("2001:db8:1:2::1")).toBe(true);
});

test("the caller's address is the socket's; a forwarded header counts only behind Ore's own proxy, and then its last entry", () => {
  const req = new Request("http://x/", { headers: { "x-forwarded-for": "9.9.9.9, 7.7.7.7" } });
  expect(caller(req, "1.1.1.1", false)).toBe("1.1.1.1");
  expect(caller(req, "127.0.0.1", true)).toBe("7.7.7.7");
  expect(caller(new Request("http://x/"), "127.0.0.1", true)).toBe("127.0.0.1");
  expect(caller(new Request("http://x/"), undefined, false)).toBe("unknown");
});

test("answers are never cached or sniffed", async () => {
  const res = await makeHandler(auth)(new Request("http://x/nope"));
  expect([res.headers.get("cache-control"), res.headers.get("x-content-type-options")]).toEqual(["no-store", "nosniff"]);
});
