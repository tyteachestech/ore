import { Database } from "bun:sqlite";
import { createHmac } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";

/** Ore's own AI (#554, D355): a signed-in person's task (the prompt Ore wrote, their words, the schema the
 *  answer must fit) goes to Anthropic with Ore's key, which lives only in the server's environment, and
 *  comes back as the Mac's own AI gives it: the text and what it used. Each person has a month's allowance
 *  in dollars; the server keeps what each has spent this month and nothing of what was asked or answered. */

/** Dollars per million tokens. Tutor, grading and exercises run on Sonnet; Haiku is the cheaper choice a
 *  job can be set to (Settings › AI › By job, D356). Haiku costs more once a prompt passes 100K tokens.
 *  Reopen when a model's price or name changes: an unknown model is refused, never guessed at. */
const PRICES = {
  "claude-sonnet-5-5": { in: 2, out: 10, read: 0.1 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5, past: { tokens: 100_000, in: 0.5, out: 2.5 } },
} satisfies Record<string, Price>;
/** `read` is input read from the cache, a tenth of the input price where a model names no other. */
type Price = { in: number; out: number; read?: number; past?: { tokens: number; in: number; out: number } };
export type Model = keyof typeof PRICES;
const isModel = (m: unknown): m is Model => typeof m === "string" && Object.hasOwn(PRICES, m);

export const AI = {
  /** The longest answer a task may get: what Anthropic's own tools default to, and 16¢ on Sonnet at most. */
  maxTokens: 16_000,
  /** A task bigger than this isn't read: a whole book's text for its exercises is under it, and at
   *  Sonnet's price this much input is about 50¢. Reopen with the largest real source. */
  maxBody: 1024 * 1024,
  /** Tasks one person may send in a minute, and have running at once: a review asks for one grade at a
   *  time and a tutor one reply, so more than this is a bug or abuse. */
  perMinute: 20,
  atOnce: 2,
};

type Used = { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null };

/** What a run cost in dollars: input written to the cache costs 1.25 times the input price. */
export function priced(model: Model, u: Used): number {
  const write = u.cache_creation_input_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0;
  const p: Price = PRICES[model];
  const rate: Price = p.past && u.input_tokens + write + read > p.past.tokens ? p.past : p;
  return ((u.input_tokens + write * 1.25) * rate.in + read * (rate.read ?? rate.in * 0.1) + u.output_tokens * rate.out) / 1e6;
}

/** The one call the server makes to Anthropic, so a test can stand in for it. */
export type Ask = (body: Anthropic.MessageCreateParamsNonStreaming, gone?: AbortSignal) => Promise<{ content: { type: string; text?: string }[]; stop_reason: string | null; usage: Used }>;

/** Thinking and sampling are left at the model's own defaults: Sonnet 5.5 refuses them set otherwise.
 *  A call stops when its caller has gone, and after five minutes, tried again once at most: left at the
 *  SDK's ten minutes and two more tries, a stuck one would hold one of a person's places for half an hour. */
export const anthropic = (apiKey: string): Ask => {
  const client = new Anthropic({ apiKey, timeout: 5 * 60_000, maxRetries: 1 });
  return (body, signal) => client.messages.create(body, { signal });
};

export interface Ledger {
  /** Dollars this person has spent this month. */
  spent(account: string, month: string): number;
  /** Dollars everyone has spent this month. */
  total(month: string): number;
  /** Adds a run's cost, and forgets every month before this one. */
  add(account: string, month: string, usd: number): void;
  rows(): { who: string; month: string; usd: number }[];
}

/** What each person has spent this month, beside the accounts. A person is a keyed hash of their account
 *  id, not the id: the row has to outlive `DELETE /account` until the month ends, or deleting the account
 *  and signing in again would hand out a second allowance, and this way what stays names no one.
 *  The key is the session secret: changing that mid-month starts everyone's month again (the old rows
 *  still count toward the server's total). Kept in millionths of a dollar, whole numbers: ten runs of 40¢ must add up to $4, not just under. */
export function ledger(path: string, secret: string): Ledger {
  const db = new Database(path, { create: true, strict: true });
  db.run("CREATE TABLE IF NOT EXISTS spend (who TEXT NOT NULL, month TEXT NOT NULL, micros INTEGER NOT NULL, PRIMARY KEY (who, month))");
  const who = (account: string) => createHmac("sha256", secret).update(`spend:${account}`).digest("base64url");
  return {
    spent: (account, month) => ((db.query("SELECT micros FROM spend WHERE who = ? AND month = ?").get(who(account), month) as { micros: number } | null)?.micros ?? 0) / 1e6,
    total: (month) => (db.query("SELECT COALESCE(SUM(micros), 0) AS micros FROM spend WHERE month = ?").get(month) as { micros: number }).micros / 1e6,
    add(account, month, usd) {
      db.query("INSERT INTO spend (who, month, micros) VALUES (?, ?, ?) ON CONFLICT (who, month) DO UPDATE SET micros = micros + excluded.micros").run(who(account), month, Math.round(usd * 1e6));
      db.query("DELETE FROM spend WHERE month < ?").run(month);
    },
    rows: () => db.query("SELECT who, month, micros / 1e6 AS usd FROM spend ORDER BY month, who").all() as ReturnType<Ledger["rows"]>,
  };
}

export interface Ai {
  ask: Ask;
  ledger: Ledger;
  /** Dollars of AI one person gets in a month (#545: about $4 of the $8). */
  allowance: number;
  /** Dollars the whole server may spend in a month: past it nobody's task runs, so a bug can't run up a bill. */
  total: number;
  /** Billing is off (Tyler is the only user, #545): everyone gets what Pro gets. */
  everyone: boolean;
}

const HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: HEADERS });

/** The month an allowance is for, and the day the next one starts, by the server's clock in UTC. */
function month(now: number) {
  const d = new Date(now * 1000);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { month: d.toISOString().slice(0, 7), resets: next.toISOString().slice(0, 10), day: next.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" }) };
}

interface Task {
  model: Model;
  system?: string;
  message: string;
  schema: Record<string, unknown>;
}

function task(raw: string): Task | null {
  let b: Record<string, unknown>;
  try {
    b = JSON.parse(raw) as typeof b;
  } catch {
    return null;
  }
  if (!b || typeof b !== "object" || !isModel(b.model) || typeof b.message !== "string" || !b.message) return null;
  if (b.system !== undefined && typeof b.system !== "string") return null;
  if (!b.schema || typeof b.schema !== "object" || Array.isArray(b.schema)) return null;
  return { model: b.model, system: b.system as string | undefined, message: b.message, schema: b.schema as Record<string, unknown> };
}

/** POST /ai: `{ model, system?, message, schema }` answers `{ text, model, usage: { input_tokens, output_tokens, cost_usd } }`,
 *  the text being JSON that fits the schema. `{ refused, resets }` with 402 once the month's allowance is
 *  spent: the app then uses the person's own AI if they have one, else says the day. */
export function aiRoute(ai: Ai, now: () => number, perMinute: (who: string) => boolean) {
  const running = new Map<string, number>();
  // What the tasks now running may cost at most, per person and in all: a cap is checked against what is
  // spent and what is still out, so tasks sent together can't each pass it and overspend by all of them.
  const out = new Map<string, number>();
  let outAll = 0;
  // Set when a run's cost couldn't be written: with the ledger not counting, neither cap would ever stop
  // anything, so no more tasks run until the server is looked at and restarted.
  let stuck = false;
  return async (account: { id: string; plan: string }, read: (max: number) => Promise<string | null>, gone?: AbortSignal): Promise<Response> => {
    if (!ai.everyone && account.plan !== "pro") return json({ refused: "Ore's own AI comes with Ore Cloud Pro." }, 402);
    if (stuck) return json({ error: "Ore's AI is off until its server is looked at." }, 503);
    const m = month(now());
    const used = { refused: `This month's Ore AI is used up. It resets on ${m.day}.`, resets: m.resets };
    const closed = { refused: `Ore's AI is closed for the month. It opens again on ${m.day}.`, resets: m.resets };
    if (ai.ledger.spent(account.id, m.month) >= ai.allowance) return json(used, 402);
    if (ai.ledger.total(m.month) >= ai.total) return json(closed, 503);
    const mine = running.get(account.id) ?? 0;
    if (mine >= AI.atOnce) return json({ refused: "Ore's AI is still on your last ones. Wait for one to finish." }, 429);
    running.set(account.id, mine + 1);
    let most = 0;
    try {
      const raw = await read(AI.maxBody);
      if (raw === null) return json({ error: "too big" }, 413);
      const t = task(raw);
      if (!t) return json({ error: "give a model of Ore's, the message, and the schema the answer must fit" }, 400);
      if (ai.ledger.spent(account.id, m.month) + (out.get(account.id) ?? 0) >= ai.allowance) return json({ refused: "Ore's AI is still on your last one. Wait for it to finish." }, 429);
      if (ai.ledger.total(m.month) + outAll >= ai.total) return json({ refused: "Ore's AI is busy just now. Try again in a minute." }, 503);
      // Counted toward the minute only once it is a task the server sends on.
      if (!perMinute(account.id)) return json({ refused: "That's a lot at once. Wait a minute, then try again." }, 429);
      // At most: a token for every two bytes sent (more than any text makes) and the longest answer.
      const worst = priced(t.model, { input_tokens: Math.ceil(raw.length / 2), output_tokens: AI.maxTokens });
      most = worst;
      out.set(account.id, (out.get(account.id) ?? 0) + most);
      outAll += most;
      let res: Awaited<ReturnType<Ask>>;
      try {
        res = await ai.ask({
          model: t.model,
          max_tokens: AI.maxTokens,
          ...(t.system ? { system: t.system } : {}),
          messages: [{ role: "user", content: t.message }],
          output_config: { format: { type: "json_schema", schema: t.schema } },
        }, gone);
      } catch (e) {
        // Why is the server's to know (its log): Anthropic's words can name Ore's key or account.
        console.error("ai failed:", e instanceof Error ? e.message : e);
        if (e instanceof Anthropic.BadRequestError || e instanceof Anthropic.ContentTooLargeError) return json({ error: "Ore's AI couldn't take this one." }, 400);
        if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError) return json({ refused: "Ore's AI is busy just now. Try again in a minute." }, 503);
        return json({ error: "Ore's AI couldn't be reached. Try again in a minute." }, 502);
      }
      // A cost that can't be worked out or written is still counted, at the most it could be, and still answered.
      const cost = priced(t.model, res.usage);
      const cost_usd = Number.isFinite(cost) ? cost : worst;
      try {
        ai.ledger.add(account.id, month(now()).month, cost_usd);
      } catch (e) {
        stuck = true;
        console.error("ai ledger failed, no more tasks until a restart:", e instanceof Error ? e.message : e);
      }
      const usage = { input_tokens: res.usage.input_tokens + (res.usage.cache_creation_input_tokens ?? 0) + (res.usage.cache_read_input_tokens ?? 0), output_tokens: res.usage.output_tokens, cost_usd };
      // Anything but a finished answer isn't one the app can use; it was still paid for.
      if (res.stop_reason === "refusal") return json({ error: "The AI declined this one.", usage }, 422);
      if (res.stop_reason !== "end_turn") return json({ error: "The AI's answer was cut off.", usage }, 422);
      return json({ text: res.content.map((c) => (c.type === "text" ? (c.text ?? "") : "")).join(""), model: t.model, usage });
    } finally {
      outAll -= most;
      const held = (out.get(account.id) ?? 0) - most;
      if (held > 1e-9) out.set(account.id, held);
      else out.delete(account.id);
      const left = (running.get(account.id) ?? 1) - 1;
      if (left) running.set(account.id, left);
      else running.delete(account.id);
    }
  };
}
