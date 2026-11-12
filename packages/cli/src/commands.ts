import { initLibrary } from "@ore/core/init";
import type { Command } from "./types.ts";
import { itemCommands } from "./cmd-items.ts";
import { studyCommands } from "./cmd-study.ts";
import { aiCommands } from "./cmd-ai.ts";
import { feedCommands } from "./cmd-feed.ts";

export type { Command, Output } from "./types.ts";
export { errorLine } from "./util.ts";
/** For a shell that hears speech itself (the iPhone app): see audio.ts `setTranscriber`. Loaded only when asked. */
export const setTranscriber = async (hear: Parameters<typeof import("@ore/core/ingest/audio").setTranscriber>[0]) => (await import("@ore/core/ingest/audio")).setTranscriber(hear);

export const commands: Record<string, Command> = {
  init: {
    usage: "[path]                create library skeleton, AGENTS.md, skills.yaml, git init",
    async run([path]) {
      const r = await initLibrary(path);
      const text = r.created.length
        ? `Library at ${r.root}\n${r.created.map((c) => `  created ${c}`).join("\n")}`
        : `Library at ${r.root} (already initialized)`;
      return { data: r, text };
    },
  },
  ...itemCommands,
  ...studyCommands,
  ...aiCommands,
  ...feedCommands,
};
