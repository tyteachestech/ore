import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Apart from paddle.ts, which runs it and needs Bun and node:fs/promises, so the iPhone app can load
// what only asks whether it is here.

/** Where the optional download lives (D120: big tools are optional Mac downloads). */
export const paddleHome = () => process.env.ORE_PADDLE_HOME || join(homedir(), "Library", "Application Support", "Ore", "paddle");

/** The mark the download writes last, so a download cut off halfway is not taken for one. */
export const READY = "ready";

/** The page reader's Python, once the download has finished, or ORE_PADDLE for one installed elsewhere
 *  (a test's stand-in). It is run as `<python> <script> <pdf> <out.json>`. */
export function paddlePath(): string | undefined {
  if (process.env.ORE_PADDLE) return existsSync(process.env.ORE_PADDLE) ? process.env.ORE_PADDLE : undefined;
  return existsSync(join(paddleHome(), READY)) ? join(paddleHome(), "env", "bin", "python") : undefined;
}
