// End-to-end journeys: the app in a real browser against a seeded scratch library, through the real
// `ore` CLI (scripts/mock), doing what Tyler does every day. Unit tests check the parts; these check
// that the parts still work together on screen (note saves across switches, undo, review).
//   bun run e2e                      seeds, starts the bridge and vite, runs every journey
//   bun run e2e -- highlight         only journeys whose name contains "highlight"
//   E2E_URL=http://localhost:1420/   use a mock already running (scripts/mock/README.md) instead: one library for every file, so pick a file or a name
//   ORE_E2E_PORT=1490 ORE_E2E_MOCK_PORT=1491   vite's and the bridge's ports (1450, 1451), so runs side by side don't answer each other
//   ORE_E2E_FILE=reader              only the journeys in e2e/journeys/reader.ts
//   ORE_E2E_SHARD=2/4                the second of four parts (CI runs five side by side); a part takes whole files
//   ORE_E2E_REPEAT=30                each picked journey that many times in a row, to catch a flaky one
//   ORE_E2E_CPU=6                    Chromium's CPU slowed that many times, as a busy CI runner is
//   ORE_E2E_SLOW='{"ls":800}'        those `ore` commands answer that many ms late (window.__ORE_SLOW), to widen a race
//
// The journeys live in e2e/journeys/, a file per screen. Each file runs in its own order on a fresh library, so a
// journey can lean only on its own file, and one added here never changes what another file's journeys start from.
// A new journey goes in the file of the screen it is about; a new file needs nothing but to be there.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { from, run } from "./harness";

for (const f of readdirSync(join(import.meta.dir, "journeys")).filter((f) => f.endsWith(".ts")).sort()) {
  from(f.slice(0, -3));
  await import(`./journeys/${f}`);
}
await run();
