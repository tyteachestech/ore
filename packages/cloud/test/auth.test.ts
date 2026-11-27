import { beforeAll, expect, test } from "bun:test";
import { accounts, appleKeys, limiter, openSession, session, verifyApple, type Auth } from "../src/auth.ts";
import { makeHandler } from "../src/server.ts";

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

test("Apple's token for Ore is accepted and names the account", async () => {
  expect(await verifyApple(await apple(), auth)).toBe("001.abc");
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
    await apple({ sub: "" }),
    (await apple()).split(".").slice(0, 2).join(".") + ".",
    "not.a.token",
    "",
  ];
  for (const t of bad) expect([t.slice(0, 20), await verifyApple(t, auth).catch(() => null)]).toEqual([t.slice(0, 20), null]);
});

test("a session names its account until it expires, and one that was changed or signed with another secret is refused", async () => {
  const s = await session("001.abc", auth);
  expect(await openSession(s, auth)).toBe("001.abc");
  expect(await openSession(s, { ...auth, now: () => NOW + 31 * 86400 })).toBeNull();
  expect(await openSession(s, { ...auth, secret: "t".repeat(32) })).toBeNull();
  const [v, body, sig] = s.split(".");
  expect(await openSession(`${v}.${b64({ sub: "001.someone-else", exp: NOW + 999 })}.${sig}`, auth)).toBeNull();
  expect(await openSession(`${v}.${body}.`, auth)).toBeNull();
  expect(await openSession("", auth)).toBeNull();
});

test("signing in makes the account once, on the free plan, and nothing else is kept about it", async () => {
  const handle = makeHandler(auth);
  const post = (body: unknown) => handle(new Request("http://x/auth/apple", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  const first = (await (await post({ identityToken: await apple() })).json()) as { session: string; account: { id: string; plan: string } };
  expect(first.account).toEqual({ id: "001.abc", plan: "free" });
  expect(await openSession(first.session, auth)).toBe("001.abc");
  await post({ identityToken: await apple() });
  expect(auth.accounts.all()).toEqual([{ id: "001.abc", plan: "free" }]);
  expect((await post({ identityToken: await apple({ exp: NOW - 1 }) })).status).toBe(401);
  expect((await post({})).status).toBe(400);
  expect(auth.accounts.all().length).toBe(1);
});

test("every route but sign-in needs a session: none, a bad one or an expired one is refused before anything is read", async () => {
  const handle = makeHandler(auth);
  const imp = (authz?: string, a = auth) => makeHandler(a)(new Request("http://x/import", { method: "POST", headers: { "content-type": "application/json", ...(authz ? { authorization: authz } : {}) }, body: JSON.stringify({ url: "file:///etc/passwd" }) }));
  expect((await imp()).status).toBe(401);
  expect((await imp("Bearer nope")).status).toBe(401);
  auth.accounts.signIn("001.abc");
  const s = await session("001.abc", auth);
  expect((await imp(`Bearer ${await session("001.never-signed-in", auth)}`)).status).toBe(401);
  expect((await imp(`Bearer ${s}`, { ...auth, now: () => NOW + 31 * 86400 })).status).toBe(401);
  // Signed in, the request is read (and this one refused for what it asks).
  expect((await imp(`Bearer ${s}`)).status).toBe(400);
  expect((await handle(new Request("http://x/nope", { method: "POST" }))).status).toBe(404);
});

test("Apple's keys are fetched once and kept for an hour; a failed fetch isn't kept", async () => {
  let calls = 0;
  let fail = true;
  const real = (async () => {
    calls++;
    if (fail) return new Response("no", { status: 500 });
    return Response.json({ keys: [jwk] });
  }) as unknown as typeof fetch;
  let now = NOW;
  const keys = appleKeys(real, () => now);
  await expect(keys()).rejects.toThrow();
  fail = false;
  expect((await keys()).length).toBe(1);
  await keys();
  expect(calls).toBe(2);
  now += 3601;
  await keys();
  expect(calls).toBe(3);
});

test("deleting the account removes all the server holds, and its sessions stop working at once", async () => {
  const a: Auth = { ...auth, accounts: accounts(":memory:") };
  const handle = makeHandler(a);
  a.accounts.signIn("001.gone");
  a.accounts.signIn("001.stays");
  const s = await session("001.gone", a);
  const del = () => handle(new Request("http://x/account", { method: "DELETE", headers: { authorization: `Bearer ${s}` } }));
  expect((await handle(new Request("http://x/account", { method: "DELETE" }))).status).toBe(401);
  expect(await (await del()).json()).toEqual({ deleted: true });
  expect(a.accounts.all()).toEqual([{ id: "001.stays", plan: "free" }]);
  expect((await del()).status).toBe(401);
});

test("one address gets ten sign-in tries in a quarter hour; another address, or a later hour, is not held back", async () => {
  let now = NOW;
  const handle = makeHandler(auth, limiter(10, 900, () => now));
  const tryIt = (who: string) => handle(new Request("http://x/auth/apple", { method: "POST", body: "{}" }), who);
  for (let i = 0; i < 10; i++) expect((await tryIt("1.2.3.4")).status).toBe(400);
  expect((await tryIt("1.2.3.4")).status).toBe(429);
  expect((await tryIt("5.6.7.8")).status).toBe(400);
  now += 901;
  expect((await tryIt("1.2.3.4")).status).toBe(400);
});

test("answers are never cached or sniffed", async () => {
  const res = await makeHandler(auth)(new Request("http://x/nope"));
  expect([res.headers.get("cache-control"), res.headers.get("x-content-type-options")]).toEqual(["no-store", "nosniff"]);
});
