import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { AiStamp } from "../items.ts";
import type { Library } from "../library.ts";
import { loadSkills } from "../skills.ts";
import { aiModel } from "./models.ts";
import { loadPrompt, type PromptName } from "./prompts.ts";

export type Vendor = "claude" | "codex";

export interface AgentTask<T> {
  prompt: PromptName;
  input: unknown;
  files?: string[]; // absolute paths the agent should read
  schema: z.ZodType<T>;
  check?: (data: T, web?: WebSeen) => string | null; // semantic validation beyond the schema
  web?: boolean; // allow web search/fetch
  /** While it runs (claude web tasks): the answer's JSON so far, and a search starting. */
  onProgress?: (p: { partial: string } | { searching: true }) => void;
  cwd: string;
}

/** What one run passes to the vendor's CLI. */
interface RunOpts { model?: string }

/** What a run spent, as the vendor reports it: claude gives a dollar figure, codex only tokens. */
export interface Usage { input_tokens: number; output_tokens: number; cost_usd?: number }

export interface AgentResult<T> {
  data: T;
  ai: AiStamp;
  usage: Usage; // summed over retries
  /** What its web searches and fetches returned, when the vendor reports it (claude does, codex doesn't). */
  web?: WebSeen;
}

/** The pages a run's web searches and fetches returned, each with the text it came back in, so a web
 *  citation can be checked as a library one is: its page must be one the search found, its quote words
 *  returned with that page. */
export interface WebSeen { searched: boolean; pages: { url: string; title: string; text: string }[] }

interface RawRun {
  output: unknown; // parsed JSON (or a string to parse)
  model: string;
  usage: Usage;
  web?: WebSeen;
}

const addUsage = (a: Usage, b: Usage): Usage => ({
  input_tokens: a.input_tokens + b.input_tokens,
  output_tokens: a.output_tokens + b.output_tokens,
  ...(a.cost_usd !== undefined || b.cost_usd !== undefined ? { cost_usd: (a.cost_usd ?? 0) + (b.cost_usd ?? 0) } : {}),
});

type ClaudeOut = { total_cost_usd?: number; usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number } };
const claudeUsage = (o: ClaudeOut): Usage => ({
  input_tokens: (o.usage?.input_tokens ?? 0) + (o.usage?.cache_creation_input_tokens ?? 0) + (o.usage?.cache_read_input_tokens ?? 0),
  output_tokens: o.usage?.output_tokens ?? 0,
  ...(typeof o.total_cost_usd === "number" ? { cost_usd: o.total_cost_usd } : {}),
});

/** Token counts from codex's `--json` events (`turn.completed` carries each turn's usage). */
export function codexUsage(stdout: string): Usage {
  let u: Usage = { input_tokens: 0, output_tokens: 0 };
  for (const line of stdout.split("\n")) {
    try {
      const e = JSON.parse(line) as { type?: string; usage?: { input_tokens?: number; output_tokens?: number } };
      if (e.type === "turn.completed" && e.usage) u = addUsage(u, { input_tokens: e.usage.input_tokens ?? 0, output_tokens: e.usage.output_tokens ?? 0 });
    } catch { /* not an event line */ }
  }
  return u;
}

export function chooseVendor(lib: Library): Vendor {
  const env = process.env.ORE_AI;
  if (env === "claude" || env === "codex") return env;
  if (env) throw new Error(`ORE_AI must be claude or codex (got "${env}")`);
  try {
    return loadSkills(lib).ai ?? "claude";
  } catch {
    return "claude";
  }
}

// JSON Schema for the vendor CLIs. Length/size limits are dropped (strict
// structured-output modes reject some of them); zod still enforces them.
export function vendorSchema(schema: z.ZodType): object {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v)
          .filter(([k]) => !["$schema", "minItems", "maxItems", "minLength", "maxLength", "pattern", "format", "minimum", "maximum"].includes(k))
          .map(([k, x]) => [k, strip(x)]),
      );
    }
    return v;
  };
  return strip(z.toJSONSchema(schema)) as object;
}

function userMessage(input: unknown, files: string[]): string {
  const parts = [`Task input (JSON):\n${JSON.stringify(input, null, 2)}`];
  if (files.length) parts.push(`Files to read:\n${files.map((f) => `- ${f}`).join("\n")}`);
  return parts.join("\n\n");
}

const TIMEOUT_MS = 15 * 60_000;

interface Exec { stdout: string; stderr: string; code: number; timedOut: boolean }

/** Runs a vendor CLI; `onLine` sees each line of its stdout as it comes (a stream-json run's events). */
async function exec(cmd: string[], cwd: string, onLine?: (line: string) => void): Promise<Exec> {
  const proc = Bun.spawn(cmd, { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; proc.kill(); }, TIMEOUT_MS);
  const read = async () => {
    if (!onLine) return new Response(proc.stdout).text();
    let all = "";
    let rest = "";
    const dec = new TextDecoder();
    for await (const chunk of proc.stdout) {
      const text = dec.decode(chunk, { stream: true });
      all += text;
      const lines = (rest + text).split("\n");
      rest = lines.pop()!;
      for (const l of lines) onLine(l);
    }
    if (rest) onLine(rest);
    return all;
  };
  const [stdout, stderr, code] = await Promise.all([read(), new Response(proc.stderr).text(), proc.exited]);
  clearTimeout(timer);
  return { stdout, stderr, code, timedOut };
}

/** A stream-json line's news for `onProgress`: a web search starting, or more of the structured
 *  answer's JSON (claude writes it as the StructuredOutput tool's input, streamed with
 *  --include-partial-messages). `state` keeps the answer's block index and its JSON so far. */
export function streamProgress(line: string, state: { block?: number; json: string }): { partial: string } | { searching: true } | null {
  let e: { type?: string; event?: { type?: string; index?: number; content_block?: { type?: string; name?: string }; delta?: { type?: string; partial_json?: string } } };
  try { e = JSON.parse(line); } catch { return null; }
  const ev = e.type === "stream_event" ? e.event : undefined;
  if (ev?.type === "content_block_start" && ev.content_block?.type === "tool_use") {
    if (ev.content_block.name === "StructuredOutput") {
      state.block = ev.index;
      state.json = "";
    } else state.block = undefined;
    return ev.content_block.name === "WebSearch" || ev.content_block.name === "WebFetch" ? { searching: true } : null;
  }
  if (ev?.type === "content_block_delta" && ev.index === state.block && ev.delta?.type === "input_json_delta") {
    state.json += ev.delta.partial_json ?? "";
    return { partial: state.json };
  }
  return null;
}

/** `claude -p` otherwise loads his own MCP servers, skills, settings and hooks into every call: on
 *  Tyler's Mac 21 MCP servers added ~360k input tokens (~$1.45) to each grade. Ore's tasks need none. */
const CLAUDE_BARE = ["--strict-mcp-config", "--disable-slash-commands", "--setting-sources", ""];

const SIGN_IN = { claude: "Run `claude` and /login, or pick Codex in Settings → AI.", codex: "Run `codex login`, or pick Claude in Settings → AI." };
/** The next step for a vendor error that is about signing in. */
const signInHint = (vendor: Vendor, msg: string) =>
  /authenticat|\blog ?in\b|oauth|unauthori[sz]ed|\b401\b|api key/i.test(msg) ? `. ${SIGN_IN[vendor]}`
  : /\bmodel\b/i.test(msg) ? ". Pick another model in Settings → AI." : "";

/** The vendor's own reason for a failed run, as one line: codex's `--json` events carry it inside an
 *  `error` event, which is shown by its message, not as the raw JSON line. */
export function vendorFailure(vendor: Vendor, r: Exec): Error {
  if (r.timedOut) return new Error(`${vendor} took over ${TIMEOUT_MS / 60_000} minutes and was stopped; try again`);
  let msg = "";
  if (vendor === "codex")
    for (const line of r.stdout.split("\n").reverse()) {
      try {
        const e = JSON.parse(line) as { type?: string; message?: unknown; error?: { message?: unknown } };
        const m = e.error?.message ?? (e.type === "error" ? e.message : undefined);
        if (typeof m === "string" && m.trim()) { msg = m.trim(); break; }
      } catch { /* not an event line */ }
    }
  msg ||= (r.stderr || r.stdout).trim().split("\n").pop()!.trim();
  return new Error(`${vendor} failed (exit ${r.code})${msg ? `: ${msg}` : " with no output"}${signInHint(vendor, msg)}`);
}

/** A `claude -p --output-format json` run's result (or, for a stream-json run, its last `result` event), or why it failed. */
function claudeResult(r: Exec, events?: StreamEvent[]) {
  let out: ClaudeOut & { is_error?: boolean; result?: string; structured_output?: unknown; modelUsage?: Record<string, { outputTokens?: number }> };
  try {
    out = events ? (events.findLast((e) => e.type === "result") as typeof out) : JSON.parse(r.stdout);
  } catch {
    throw vendorFailure("claude", r);
  }
  // A stream that ends with no result: its last line is a raw event, so the reason is in stderr if anywhere.
  if (!out) throw vendorFailure("claude", { ...r, stdout: "" });
  if (r.timedOut) throw vendorFailure("claude", r);
  if (out.is_error) {
    const msg = out.result ?? "unknown error";
    throw new Error(`claude: ${msg}${signInHint("claude", msg)}`);
  }
  return out;
}

// claude -p with a system prompt, structured output and only the tools the task needs.
async function runClaude(system: string, message: string, schema: object, task: AgentTask<unknown>, { model }: RunOpts): Promise<RawRun> {
  const bin = Bun.which("claude", { PATH: process.env.PATH ?? "" });
  if (!bin) throw new Error("Claude Code isn’t installed (no `claude` on PATH). Install it, or pick Codex in Settings → AI.");
  // File tools only for a task that names files: each tool's definition is input on every call, and a
  // task given everything in its input (the tutor, grading) has nothing to read.
  const tools = [...(task.files?.length ? ["Read", "Grep", "Glob"] : []), ...(task.web ? ["WebSearch", "WebFetch"] : [])];
  // A web task streams its events, so the pages its searches returned can be checked against its citations.
  const cmd = [
    bin, "-p", message,
    "--output-format", task.web ? "stream-json" : "json", ...(task.web ? ["--verbose"] : []), ...(task.web && task.onProgress ? ["--include-partial-messages"] : []),
    "--json-schema", JSON.stringify(schema),
    "--system-prompt", system,
    "--tools", tools.join(","),
    "--allowedTools", tools.join(","),
    "--permission-mode", "dontAsk",
    ...CLAUDE_BARE,
    "--no-session-persistence",
    ...(model ? ["--model", model] : []),
  ];
  const state = { json: "" };
  const onLine = task.web && task.onProgress ? (l: string) => { const p = streamProgress(l, state); if (p) task.onProgress!(p); } : undefined;
  const r = await exec(cmd, task.cwd, onLine);
  const events = task.web ? streamEvents(r.stdout) : undefined;
  const out = claudeResult(r, events);
  // The model that wrote the most is the one that ran, except on a web task, where the search's own
  // helper model can write more: its stream's `system init` event names the model it ran on.
  const usage = Object.entries(out.modelUsage ?? {}).sort((a, b) => (b[1].outputTokens ?? 0) - (a[1].outputTokens ?? 0));
  const ran = events?.find((e) => e.type === "system" && e.subtype === "init" && typeof e.model === "string")?.model as string | undefined;
  return { output: out.structured_output ?? out.result, model: ran ?? usage[0]?.[0] ?? model ?? "claude-default", usage: claudeUsage(out), ...(events ? { web: webSeen(events) } : {}) };
}

type StreamEvent = { type?: string; subtype?: string; model?: unknown; message?: { content?: unknown }; tool_use_result?: unknown; [k: string]: unknown };
const streamEvents = (stdout: string): StreamEvent[] =>
  stdout.split("\n").flatMap((line) => {
    try {
      const e = JSON.parse(line);
      return e && typeof e === "object" ? [e as StreamEvent] : [];
    } catch {
      return []; // not an event line
    }
  });

export const isWebUrl = (s: unknown): s is string => typeof s === "string" && /^https?:\/\//i.test(s.trim());

/** The pages a stream-json run's WebSearch and WebFetch calls returned, each with the text of the
 *  results it came back in: a search's links (its summary's links too), and each URL fetched. A link
 *  inside a fetched page is not a page it returned. */
export function webSeen(events: StreamEvent[]): WebSeen {
  const seen: WebSeen = { searched: false, pages: [] };
  const add = (url: unknown, title: unknown, text: string) => {
    if (!isWebUrl(url)) return;
    const page = seen.pages.find((p) => samePage(p.url, url));
    if (!page) seen.pages.push({ url: url.trim(), title: typeof title === "string" ? title : "", text });
    else {
      if (!page.text.includes(text)) page.text += `\n\n${text}`;
      if (!page.title && typeof title === "string") page.title = title;
    }
  };
  const calls = new Map<string, { name: string; url?: unknown }>(); // tool call id → which tool, and a fetch's URL
  for (const e of events) {
    const content = Array.isArray(e.message?.content) ? (e.message.content as Record<string, unknown>[]) : [];
    if (e.type === "assistant")
      for (const c of content)
        if (c.type === "tool_use" && (c.name === "WebSearch" || c.name === "WebFetch")) {
          seen.searched = true;
          calls.set(String(c.id), { name: c.name, url: (c.input as { url?: unknown })?.url });
        }
    if (e.type !== "user") continue;
    for (const c of content) {
      const call = calls.get(String(c.tool_use_id));
      if (c.type !== "tool_result" || c.is_error || !call) continue;
      const text = typeof c.content === "string" ? c.content : Array.isArray(c.content) ? (c.content as { text?: unknown }[]).map((x) => (typeof x.text === "string" ? x.text : "")).join("\n") : "";
      if (call.name === "WebFetch") {
        add(call.url, "", text);
        continue;
      }
      const results = (e.tool_use_result as { results?: { content?: unknown }[] } | undefined)?.results;
      for (const r of Array.isArray(results) ? results : [])
        for (const l of Array.isArray(r.content) ? (r.content as { url?: unknown; title?: unknown }[]) : []) add(l.url, l.title, text);
      for (const m of text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi)) add(m[2], m[1], text);
    }
  }
  return seen;
}

/** Two links to the same page: scheme, "www.", the host's case, a trailing slash and the #fragment don't count. */
export function samePage(a: string, b: string): boolean {
  const key = (u: string) => {
    const m = u.trim().replace(/#.*$/, "").replace(/\/+$/, "").match(/^https?:\/\/(?:www\.)?([^/?]*)(.*)$/i);
    return m ? `${m[1]!.toLowerCase()}${m[2]}` : u;
  };
  return key(a) === key(b);
}

function codexConfiguredModel(): string | undefined {
  const p = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "config.toml");
  if (!existsSync(p)) return undefined;
  const top = readFileSync(p, "utf8").split(/^\[/m)[0]!;
  return top.match(/^model\s*=\s*"([^"]+)"/m)?.[1];
}

// codex exec has no system-prompt flag: instructions go first in the message.
async function runCodex(system: string, message: string, schema: object, task: AgentTask<unknown>, { model }: RunOpts): Promise<RawRun> {
  const bin = Bun.which("codex", { PATH: process.env.PATH ?? "" });
  if (!bin) throw new Error("Codex isn’t installed (no `codex` on PATH). Install it, or pick Claude in Settings → AI.");
  const dir = mkdtempSync(join(tmpdir(), "ore-codex-"));
  const schemaPath = join(dir, "schema.json");
  const outPath = join(dir, "last-message.json");
  writeFileSync(schemaPath, JSON.stringify(schema));
  const cmd = [
    bin, ...(task.web ? ["--search"] : []), "exec",
    "--json", "--output-schema", schemaPath, "-o", outPath,
    "--skip-git-repo-check", "--ephemeral", "-s", "read-only", "-C", task.cwd,
    ...(model ? ["-m", model] : []),
    `<instructions>\n${system}\n</instructions>\n\n${message}`,
  ];
  // The schema and last message are scratch files: one folder per run, removed when it ends.
  try {
    const r = await exec(cmd, task.cwd);
    if (r.code !== 0 || !existsSync(outPath)) throw vendorFailure("codex", r);
    return { output: readFileSync(outPath, "utf8"), model: model ?? codexConfiguredModel() ?? "codex-default", usage: codexUsage(r.stdout) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function parseOutput(output: unknown): unknown {
  if (typeof output !== "string") return output;
  const text = output.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  return JSON.parse(text);
}

// Run one AI task. Invalid output (bad JSON, schema or check failure) is
// retried once with the error appended; a second failure is an error.
export async function runAgent<T>(lib: Library, task: AgentTask<T>): Promise<AgentResult<T>> {
  const vendor = chooseVendor(lib);
  const prompt = loadPrompt(task.prompt);
  const schema = vendorSchema(task.schema);
  const run = vendor === "claude" ? runClaude : runCodex;
  const opts = { model: aiModel(lib, vendor) };
  let message = userMessage(task.input, task.files ?? []);
  let lastError = "";
  let usage: Usage = { input_tokens: 0, output_tokens: 0 };
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await run(prompt.text, message, schema, task as AgentTask<unknown>, opts);
    usage = addUsage(usage, raw.usage);
    try {
      const parsed = task.schema.safeParse(parseOutput(raw.output));
      if (!parsed.success) throw new Error(parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "));
      const problem = task.check?.(parsed.data, raw.web);
      if (problem) throw new Error(problem);
      return { data: parsed.data, ai: { vendor, model: raw.model, prompt_version: prompt.version }, usage, ...(raw.web ? { web: raw.web } : {}) };
    } catch (e) {
      lastError = (e as Error).message;
      message = `${userMessage(task.input, task.files ?? [])}\n\nYour previous output was invalid: ${lastError}\nReturn only JSON that matches the schema.`;
    }
  }
  throw new Error(`${vendor} returned invalid ${task.prompt} output twice: ${lastError}`);
}

export interface ChatRun {
  output: unknown;
  model: string;
  /** Pass back on the next turn to continue the same conversation. */
  session: string;
}

// One turn of a chat (D61), through the vendor's own program on his plan: `claude -p` keeps the
// conversation under a session id it is given; `codex exec` under the thread id it reports, picked
// up again with `exec resume`. No tools: everything the chat needs is in the first message.
export async function runChatTurn(lib: Library, a: { system: string; message: string; schema: object; session?: string; cwd: string }): Promise<ChatRun & { vendor: Vendor }> {
  const vendor = chooseVendor(lib);
  const model = aiModel(lib, vendor);
  if (vendor === "claude") {
    const bin = Bun.which("claude", { PATH: process.env.PATH ?? "" });
    if (!bin) throw new Error("Claude Code isn’t installed (no `claude` on PATH). Install it, or pick Codex in Settings → AI.");
    const session = a.session ?? crypto.randomUUID();
    const cmd = [
      bin, "-p", a.message,
      "--output-format", "json",
      "--json-schema", JSON.stringify(a.schema),
      "--system-prompt", a.system,
      "--tools", "",
      "--permission-mode", "dontAsk",
      ...CLAUDE_BARE,
      ...(a.session ? ["--resume", session] : ["--session-id", session]),
      ...(model ? ["--model", model] : []),
    ];
    const out = claudeResult(await exec(cmd, a.cwd));
    const usage = Object.entries(out.modelUsage ?? {}).sort((x, y) => (y[1].outputTokens ?? 0) - (x[1].outputTokens ?? 0));
    return { vendor, output: out.structured_output ?? out.result, model: usage[0]?.[0] ?? model ?? "claude-default", session };
  }
  const bin = Bun.which("codex", { PATH: process.env.PATH ?? "" });
  if (!bin) throw new Error("Codex isn’t installed (no `codex` on PATH). Install it, or pick Claude in Settings → AI.");
  const dir = mkdtempSync(join(tmpdir(), "ore-codex-"));
  const schemaPath = join(dir, "schema.json");
  const outPath = join(dir, "last-message.json");
  writeFileSync(schemaPath, JSON.stringify(a.schema));
  const message = a.session ? a.message : `<instructions>\n${a.system}\n</instructions>\n\n${a.message}`;
  const cmd = [
    bin, "exec", "--json", "--output-schema", schemaPath, "-o", outPath,
    "--skip-git-repo-check", "-s", "read-only", "-C", a.cwd, ...(model ? ["-m", model] : []),
    ...(a.session ? ["resume", a.session] : []), message,
  ];
  try {
    const r = await exec(cmd, a.cwd);
    if (r.code !== 0 || !existsSync(outPath)) throw vendorFailure("codex", r);
    const started = r.stdout.split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((e) => e?.type === "thread.started");
    const session = a.session ?? started?.thread_id;
    if (!session) throw new Error("codex did not report a thread id");
    return { vendor, output: readFileSync(outPath, "utf8"), model: model ?? codexConfiguredModel() ?? "codex-default", session };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
