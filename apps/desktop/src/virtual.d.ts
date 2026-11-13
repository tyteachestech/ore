/** The CLI's command table, run in-process on iPhone (src/phone/core.ts; aliased in vite.config.ts). */
declare module "ore-commands" {
  type Command = { usage: string; options?: Record<string, { type: "string" | "boolean"; multiple?: boolean; short?: string }>; run(positionals: string[], flags: Record<string, unknown>): Promise<{ data: unknown }> };
  export type Commands = Record<string, Command>;
  export const commands: Commands;
  export function errorLine(e: unknown): string;
  export function fillOwedHere(opts: { onProgress?: (id: string, done: number, label?: string) => void; turn?: <T>(f: () => Promise<T>) => Promise<T> }): Promise<{ id: string; title: string }[]>;
  export function setTranscriber(hear: ((data: Uint8Array, ext: string, onProgress?: (done: number, label?: string) => void, language?: string) => Promise<string>) | null): Promise<void>;
}

/** Node's util.parseArgs as a package, for the CLI's flags on iPhone (src/phone/core.ts). */
declare module "@pkgjs/parseargs" {
  export function parseArgs(config: { args: string[]; options?: object; allowPositionals?: boolean; strict?: boolean }): { values: Record<string, unknown>; positionals: string[] };
}
