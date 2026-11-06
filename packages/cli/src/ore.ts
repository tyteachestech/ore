#!/usr/bin/env bun
import { parseArgs, type ParseArgsConfig } from "node:util";
import { cancelRun, openLibrary, snapshot } from "@ore/core";
import { commands } from "./commands.ts";
import { errorLine } from "./util.ts";

type Options = NonNullable<ParseArgsConfig["options"]>;

function usage(): string {
  const lines = Object.entries(commands).map(([name, c]) => `  ore ${name} ${c.usage}`.trimEnd());
  return ["ore — Ore library CLI. Every command accepts --json.", "", ...lines, "", "Library: $ORE_LIBRARY or ~/Ore"].join("\n");
}

async function main(argv: string[]): Promise<number> {
  const [name, ...rest] = argv;
  if (!name || name === "--help" || name === "-h" || name === "help") {
    console.log(usage());
    return 0;
  }
  const cmd = commands[name];
  if (!cmd) throw new Error(`unknown command "${name}" (ore --help)`);
  if (rest.includes("--help") || rest.includes("-h")) {
    console.log(`ore ${name} ${cmd.usage}`);
    return 0;
  }
  const options: Options = { json: { type: "boolean" }, ...cmd.options };
  const { values, positionals } = (() => {
    try {
      return parseArgs({ args: rest, options, allowPositionals: true, strict: true });
    } catch (e) {
      // Node's own wording explains `--` terminators; say which flag and where the right ones are listed.
      const flag = /^Unknown option '([^']+)'/.exec((e as Error).message)?.[1];
      throw new Error(`${flag ? `unknown option ${flag}` : (e as Error).message.split(". ")[0]} (ore ${name} --help)`);
    }
  })();
  const json = Boolean(values.json);
  const out = await cmd.run(positionals, values as Record<string, unknown>);
  // Library history (D5): best effort, never fails the command.
  try {
    snapshot(openLibrary());
  } catch {
    /* no library yet, or git missing */
  }
  if (json) console.log(JSON.stringify(out.data, null, 2));
  else if (out.text) console.log(out.text);
  return out.exitCode ?? 0;
}

// The app's Cancel on an add ends this run with SIGTERM: take out what it wrote so far, then stop.
process.on("SIGTERM", () => {
  cancelRun();
  process.exit(143);
});

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    const msg = errorLine(e);
    console.error(`ore: ${msg}`);
    if (process.argv.includes("--json")) console.log(JSON.stringify({ error: msg }));
    process.exit(1);
  },
);
