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
  check?: (data: T) => string | null; // semantic validation beyond the schema
  web?: boolean; // allow web search/fetch
  cwd: string;
}

/** What one run passes to the vendor's CLI. */
interface RunOpts { model?: string }

export interface AgentResult<T> {
  data: T;
  ai: AiStamp;
}

interface RawRun {
  output: unknown; // parsed JSON (or a string to parse)
  model: string;
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

async function exec(cmd: string[], cwd: string): Promise<Exec> {
  const proc = Bun.spawn(cmd, { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; proc.kill(); }, TIMEOUT_MS);
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  clearTimeout(timer);
  return { stdout, stderr, code, timedOut };
}

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

/** A `claude -p --output-format json` run's result, or why it failed. */
function claudeResult(r: Exec) {
  let out: { is_error?: boolean; result?: string; structured_output?: unknown; modelUsage?: Record<string, { outputTokens?: number }> };
  try {
    out = JSON.parse(r.stdout);
  } catch {
    throw vendorFailure("claude", r);
  }
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
  const tools = ["Read", "Grep", "Glob", ...(task.web ? ["WebSearch", "WebFetch"] : [])];
  const cmd = [
    bin, "-p", message,
    "--output-format", "json",
    "--json-schema", JSON.stringify(schema),
    "--system-prompt", system,
    "--tools", tools.join(","),
    "--allowedTools", tools.join(","),
    "--permission-mode", "dontAsk",
    "--no-session-persistence",
    ...(model ? ["--model", model] : []),
  ];
  const out = claudeResult(await exec(cmd, task.cwd));
  const usage = Object.entries(out.modelUsage ?? {}).sort((a, b) => (b[1].outputTokens ?? 0) - (a[1].outputTokens ?? 0));
  return { output: out.structured_output ?? out.result, model: usage[0]?.[0] ?? model ?? "claude-default" };
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
    return { output: readFileSync(outPath, "utf8"), model: model ?? codexConfiguredModel() ?? "codex-default" };
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
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await run(prompt.text, message, schema, task as AgentTask<unknown>, opts);
    try {
      const parsed = task.schema.safeParse(parseOutput(raw.output));
      if (!parsed.success) throw new Error(parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "));
      const problem = task.check?.(parsed.data);
      if (problem) throw new Error(problem);
      return { data: parsed.data, ai: { vendor, model: raw.model, prompt_version: prompt.version } };
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
