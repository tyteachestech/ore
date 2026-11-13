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

/** For an app that runs these commands in its own process (the iPhone): what was added with a part owed is
 *  downloaded and heard outside any command, and only its writing takes a `turn` among them (core `fillOwed`). */
export const fillOwedHere = async (opts: { onProgress?: (id: string, done: number, label?: string) => void; turn?: <T>(f: () => Promise<T>) => Promise<T> }) => {
  const core = await import("@ore/core");
  return (await core.fillOwed(core.openLibrary(), opts)).map((i) => ({ id: i.meta.id, title: i.meta.title }));
};

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
