import type { ParseArgsConfig } from "node:util";

export interface Output {
  data: unknown;
  text?: string;
  exitCode?: number;
}

export interface Command {
  usage: string;
  options?: NonNullable<ParseArgsConfig["options"]>;
  run(positionals: string[], flags: Record<string, unknown>): Promise<Output>;
}
