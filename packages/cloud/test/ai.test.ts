import { expect, test } from "bun:test";
import Anthropic from "@anthropic-ai/sdk";
import { AI, ledger, priced, type Ai, type Ask } from "../src/ai.ts";
import { accounts, session, type Auth } from "../src/auth.ts";
import { inProcess, makeHandler } from "../src/server.ts";

// Ore's own AI on the server (#554): the same result the Mac's own AI gives (text and what it used), paid
// from a monthly allowance per person. No real AI here: Anthropic is a stand-in that says what it was asked.

const NOV = Date.UTC(2026, 10, 27) / 1000;
type Reply = Awaited<ReturnType<Ask>>;
const said = (text: string, input = 1000, output = 500, more: Partial<Reply> = {}): Reply => ({
  content: [{ type: "text", text }],
  stop_reason: "end_turn",
  usage: { input_tokens: input, output_tokens: output, cache_creation_input_tokens: null, cache_read_input_tokens: null },
  ...more,
});

function server(opts: Partial<Ai> & { ask?: Ask; now?: () => number } = {}) {
  let now = NOV;
  const auth: Auth = { audience: [], secret: "s".repeat(32), keys: async () => [], accounts: accounts(":memory:"), now: opts.now ?? (() => now) };
  const asked: Parameters<Ask>[0][] = [];
  const ask: Ask = async (body, gone) => {
    asked.push(body);
    return (opts.ask ?? (async () => said('{"grade":"good"}')))(body, gone);
  };
  const ai: Ai = { ask, ledger: ledger(":memory:", auth.secret), allowance: 4, total: 100, everyone: true, ...opts, ...(opts.ask ? { ask } : {}) };
  const handle = makeHandler(auth, undefined, inProcess, ai);
  const as = async (id: string, body: unknown, raw?: string) => {
    const s = await session(auth.accounts.signIn(id), auth);
    return handle(new Request("http://x/ai", { method: "POST", headers: { authorization: `Bearer ${s}`, "content-type": "application/json" }, body: raw ?? JSON.stringify(body) }));
  };
  return { as, asked, ai, auth, handle, at: (t: number) => (now = t) };
}

const task = { model: "claude-sonnet-5-5", system: "Grade the answer.", message: "Answer: 4", schema: { type: "object", properties: { grade: { type: "string" } }, required: ["grade"], additionalProperties: false } };

test("a task comes back as the Mac's own AI gives it: the text, the model, and what it used with its cost", async () => {
  const s = server();
  const res = await s.as("001.a", task);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ text: '{"grade":"good"}', model: "claude-sonnet-5-5", usage: { input_tokens: 1000, output_tokens: 500, cost_usd: 0.007 } });
  expect(s.asked[0]).toEqual({
    model: "claude-sonnet-5-5",
    max_tokens: AI.maxTokens,
    system: "Grade the answer.",
    messages: [{ role: "user", content: "Answer: 4" }],
    output_config: { format: { type: "json_schema", schema: task.schema } },
  });
});

test("what a run costs: each model's own price, cached input at its own rates, Haiku dearer past 100K tokens", () => {
  const u = (input_tokens: number, output_tokens: number, write = 0, read = 0) => ({ input_tokens, output_tokens, cache_creation_input_tokens: write, cache_read_input_tokens: read });
  expect(priced("claude-sonnet-5-5", u(1_000_000, 1_000_000))).toBeCloseTo(12);
  expect(priced("claude-sonnet-5-5", u(0, 0, 1_000_000, 1_000_000))).toBeCloseTo(2.5 + 0.1);
  expect(priced("claude-haiku-5-5", u(100_000, 10_000))).toBeCloseTo(0.01 + 0.005);
  expect(priced("claude-haiku-5-5", u(60_000, 10_000, 0, 50_000))).toBeCloseTo(0.03 + 0.0025 + 0.025);
});

test("signed out, nothing is asked", async () => {
  const s = server();
  const res = await s.handle(new Request("http://x/ai", { method: "POST", body: JSON.stringify(task) }));
  expect(res.status).toBe(401);
  expect(s.asked).toHaveLength(0);
});

test("with no key on the server, the AI says it isn't set up and imports still work", async () => {
  const auth: Auth = { audience: [], secret: "s".repeat(32), keys: async () => [], accounts: accounts(":memory:") };
  const handle = makeHandler(auth, undefined, inProcess);
  const s = await session(auth.accounts.signIn("001.a"), auth);
  const res = await handle(new Request("http://x/ai", { method: "POST", headers: { authorization: `Bearer ${s}` }, body: JSON.stringify(task) }));
  expect(res.status).toBe(503);
});

test("only Ore's models, and only a task with its words and schema", async () => {
  const s = server();
  for (const bad of [{ ...task, model: "claude-opus-5-5" }, { ...task, model: undefined }, { ...task, message: "" }, { ...task, message: 4 }, { ...task, schema: "x" }, { ...task, schema: [] }, { ...task, system: 4 }, null, []]) {
    expect((await s.as("001.a", bad)).status).toBe(400);
  }
  expect((await s.as("001.a", null, "{not json")).status).toBe(400);
  expect(s.asked).toHaveLength(0);
});

test("a task too big to be one is refused unread", async () => {
  const s = server();
  expect((await s.as("001.a", { ...task, message: "x".repeat(AI.maxBody) })).status).toBe(413);
  expect(s.asked).toHaveLength(0);
});

test("once the month's allowance is spent, the next task is refused with the day it resets; the next month starts fresh", async () => {
  // 150K in and 10K out on Sonnet: $0.40 a run, so ten runs spend $4.
  const s = server({ ask: async () => said("{}", 150_000, 10_000) });
  for (let i = 0; i < 10; i++) expect((await s.as("001.a", task)).status).toBe(200);
  const res = await s.as("001.a", task);
  expect(res.status).toBe(402);
  expect(await res.json()).toEqual({ refused: "This month's Ore AI is used up. It resets on December 1.", resets: "2026-12-01" });
  expect(s.asked).toHaveLength(10);
  // Someone else's allowance is their own.
  expect((await s.as("001.b", task)).status).toBe(200);
  s.at(Date.UTC(2026, 11, 1) / 1000);
  expect((await s.as("001.a", task)).status).toBe(200);
});

test("deleting the account and signing in again doesn't hand out a second allowance, and the ledger holds no account id", async () => {
  const s = server({ ask: async () => said("{}", 1_500_000, 100_000) });
  expect((await s.as("001.a", task)).status).toBe(200);
  const gone = await session(s.auth.accounts.get("001.a")!, s.auth);
  expect((await s.handle(new Request("http://x/account", { method: "DELETE", headers: { authorization: `Bearer ${gone}` } }))).status).toBe(200);
  expect((await s.as("001.a", task)).status).toBe(402);
  expect(JSON.stringify(s.ai.ledger.rows())).not.toContain("001.a");
});

test("a month that has ended is forgotten", async () => {
  const s = server();
  await s.as("001.a", task);
  expect(s.ai.ledger.rows()).toHaveLength(1);
  s.at(Date.UTC(2026, 11, 1) / 1000);
  await s.as("001.b", task);
  expect(s.ai.ledger.rows().map((r) => r.month)).toEqual(["2026-12"]);
});

test("the whole server's month has a cap of its own: past it, nobody's task runs", async () => {
  const s = server({ total: 0.5, ask: async () => said("{}", 150_000, 10_000) });
  expect((await s.as("001.a", task)).status).toBe(200);
  expect((await s.as("001.b", task)).status).toBe(200);
  const res = await s.as("001.c", task);
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ refused: "Ore's AI is closed for the month. It opens again on December 1.", resets: "2026-12-01" });
  expect(s.asked).toHaveLength(2);
});

test("tasks sent together can't each slip under a cap: what is still running counts at the most it may cost", async () => {
  // One run may cost 16¢ at most, more than the 10¢ left to this person and to the server.
  for (const caps of [{ allowance: 0.1 }, { total: 0.1 }]) {
    let free!: () => void;
    const held = new Promise<void>((r) => (free = r));
    const s = server({ ...caps, ask: async () => (await held, said("{}")) });
    const first = s.as("001.a", task);
    await Bun.sleep(10);
    const second = await s.as("allowance" in caps ? "001.a" : "001.b", task);
    expect(second.status).toBe("allowance" in caps ? 429 : 503);
    expect(s.asked).toHaveLength(1);
    free();
    expect((await first).status).toBe(200);
    // Nothing is left held once it ends.
    expect((await s.as("001.b", task)).status).toBe(200);
  }
});

test("when a run's cost can't be written down, its answer still comes and no more tasks run", async () => {
  const errors: unknown[] = [];
  const real = console.error;
  console.error = (...a: unknown[]) => void errors.push(a);
  try {
    const s = server();
    s.ai.ledger.add = () => {
      throw new Error("disk full");
    };
    expect((await s.as("001.a", task)).status).toBe(200);
    expect((await s.as("001.a", task)).status).toBe(503);
    expect(s.asked).toHaveLength(1);
    expect(errors).toHaveLength(1);
  } finally {
    console.error = real;
  }
});

test("a task whose caller has gone is stopped", async () => {
  let got: AbortSignal | undefined;
  const auth: Auth = { audience: [], secret: "s".repeat(32), keys: async () => [], accounts: accounts(":memory:") };
  const ai: Ai = { ask: async (_b, gone) => ((got = gone), said("{}")), ledger: ledger(":memory:", auth.secret), allowance: 4, total: 100, everyone: true };
  const gone = new AbortController();
  const req = new Request("http://x/ai", { method: "POST", signal: gone.signal, headers: { authorization: `Bearer ${await session(auth.accounts.signIn("001.a"), auth)}` }, body: JSON.stringify(task) });
  await makeHandler(auth, undefined, inProcess, ai)(req);
  gone.abort();
  expect(got?.aborted).toBe(true);
});

test("so many a minute, and one person's tasks only so many at once", async () => {
  const s = server();
  for (let i = 0; i < AI.perMinute; i++) expect((await s.as("001.a", task)).status).toBe(200);
  expect((await s.as("001.a", task)).status).toBe(429);
  expect((await s.as("001.b", task)).status).toBe(200);

  let free!: () => void;
  const held = new Promise<void>((r) => (free = r));
  const slow = server({ ask: async () => (await held, said("{}")) });
  const running = Array.from({ length: AI.atOnce }, () => slow.as("001.a", task));
  await Bun.sleep(10);
  expect((await slow.as("001.a", task)).status).toBe(429);
  free();
  for (const r of await Promise.all(running)) expect(r.status).toBe(200);
  expect((await slow.as("001.a", task)).status).toBe(200);
});

test("with billing on, Ore's AI is for Pro; with it off, for everyone", async () => {
  const s = server({ everyone: false });
  const res = await s.as("001.a", task);
  expect(res.status).toBe(402);
  expect(((await res.json()) as { refused: string }).refused).toContain("Ore Cloud Pro");
  expect(s.asked).toHaveLength(0);
});

test("a declined or cut-off answer is said as one, and still counts toward the month", async () => {
  const declined = server({ ask: async () => said("", 1000, 10, { stop_reason: "refusal" }) });
  const res = await declined.as("001.a", task);
  expect(res.status).toBe(422);
  expect(((await res.json()) as { error: string }).error).toContain("declined");
  expect(declined.ai.ledger.rows()[0]!.usd).toBeGreaterThan(0);

  const cut = server({ ask: async () => said('{"gra', 1000, AI.maxTokens, { stop_reason: "max_tokens" }) });
  expect((await cut.as("001.a", task)).status).toBe(422);
});

test("Anthropic's own trouble is the server's to log, not the caller's to read", async () => {
  const errors: unknown[] = [];
  const real = console.error;
  console.error = (...a: unknown[]) => void errors.push(a);
  try {
    const busy = server({ ask: async () => Promise.reject(new Anthropic.RateLimitError(429, undefined, "slow down sk-ant-secret", new Headers())) });
    const r1 = await busy.as("001.a", task);
    expect(r1.status).toBe(503);
    expect(await r1.text()).not.toContain("sk-ant");
    const bad = server({ ask: async () => Promise.reject(new Anthropic.BadRequestError(400, undefined, "prompt is too long", new Headers())) });
    expect((await bad.as("001.a", task)).status).toBe(400);
    const down = server({ ask: async () => Promise.reject(new Error("socket hang up")) });
    expect((await down.as("001.a", task)).status).toBe(502);
    expect(busy.ai.ledger.rows()).toHaveLength(0);
    expect(errors.length).toBe(3);
  } finally {
    console.error = real;
  }
});
