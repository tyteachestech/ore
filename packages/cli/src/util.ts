export const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
export const strs = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" ? [v] : []).flatMap((s: string) => s.split(",")).map((s) => s.trim()).filter(Boolean);
export const int = (v: unknown, name: string): number | undefined => {
  if (v === undefined) return undefined;
  const n = Number(v);
  // Number("") is 0, so an empty value would pass as a real one.
  if (!Number.isInteger(n) || (typeof v === "string" && !v.trim())) throw new Error(`--${name} must be an integer`);
  return n;
};
export function oneOf<T extends string>(v: unknown, allowed: readonly T[], name: string): T | undefined {
  if (v === undefined) return undefined;
  // A positional is named as its usage shows it (`<status>`), a flag with its dashes.
  if (!allowed.includes(v as T)) throw new Error(`${name.startsWith("<") ? name : `--${name}`} must be one of ${allowed.join("|")}`);
  return v as T;
}
export function need<T>(v: T | undefined, what: string): T {
  if (v === undefined || v === "") throw new Error(`missing ${what}`);
  return v;
}
export const table = (rows: string[][]): string => {
  if (!rows.length) return "";
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => (r[i] ?? "").length)));
  return rows.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i]!))).join("  ")).join("\n");
};
export async function readStdin(): Promise<string> {
  return await new Response(Bun.stdin.stream()).text();
}

export { errorLine } from "@ore/core";

/** Reports a long step's progress on stderr: with --json one `{"progress":…}` line the app shows as a
 *  bar (`done` of `of` finished, `label` what is being added), else a line for the terminal. */
export function progress(done: number, of: number, label: string, line: string): void {
  process.stderr.write(process.argv.includes("--json") ? JSON.stringify({ progress: { done, of, label } }) + "\n" : line + "\n");
}

/** Pasted bytes sent as base64 on stdin. Not Buffer: the iPhone runs these commands in its web view, which has none. */
export const fromBase64 = (s: string): Uint8Array => Uint8Array.from(atob(s.trim()), (c) => c.charCodeAt(0));
