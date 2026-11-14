import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Apart from docling.ts, which runs it and needs Bun and node:fs/promises, so the iPhone app can load
// what only asks whether it is here.

/** Where the optional download lives (D120: big tools are optional Mac downloads). */
export const doclingHome = () => process.env.ORE_DOCLING_HOME || join(homedir(), "Library", "Application Support", "Ore", "docling");

/** The mark the download writes last. Named for its reader, so an install from before Granite-Docling
 *  (D-new-granite-docling), which lacks the VLM extra and its weights, is not taken for one and is offered again. */
export const READY = "ready-granite";

/** Docling's command, once the download has finished (its `ready` mark is written last, so a download
 *  cut off halfway is not taken for one), or ORE_DOCLING for one installed elsewhere. */
export function doclingPath(): string | undefined {
  if (process.env.ORE_DOCLING) return existsSync(process.env.ORE_DOCLING) ? process.env.ORE_DOCLING : undefined;
  return existsSync(join(doclingHome(), READY)) ? join(doclingHome(), "env", "bin", "docling") : undefined;
}

