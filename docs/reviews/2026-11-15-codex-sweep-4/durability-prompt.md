Your name is `durability`. First read `codex-out/preamble.md` and follow it.

Your ports: Mac app page http://localhost:1727/ with `window.__ORE_BRIDGE = 1728` (library `/Users/tylerpoelking/Developer/ore-wt/sweep4/codex-out/libs/durability`); iPhone app http://localhost:1729/ (its seed is a copy at `/Users/tylerpoelking/Developer/ore-wt/sweep4/codex-out/libs/durability-phone`; the page's writes stay in IndexedDB). WebKit server: `ws://[::1]:1739/`. The `ore` CLI: `ORE_LIBRARY=/Users/tylerpoelking/Developer/ore-wt/sweep4/codex-out/libs/durability bun packages/cli/src/ore.ts`.
Your library is seeded with `seed.ts`.

## Your focus: writes that are interrupted
Files in the library are canonical (`CLAUDE.md`), so a write cut halfway is lost or corrupt data. Read how `packages/core` writes files (search for `writeFile`, `rename`, `atomic`, `lock`, `appendFile`) and the D-numbers on storage. After each step, run `ore doctor --json` and read the files on disk.
1. **Killed mid-write.** Start a long write (`ore add` of a big file, a bulk filing of 50 sources, a review session's ratings, an import of an inbox folder) and `kill -9` the `ore` process at several points (a loop with growing delays). What is left: a half-written `doc.md`, a truncated `reviews/` line, a temp file, a lock that never clears, a source with no exercises? Does the next run notice and repair, or tell him what to do?
2. **The disk says no.** Make the library read-only (`chmod -R a-w`), make one folder read-only, fill a small disk image (`hdiutil create -size 20m`, then put a library on it) and write until it is full. Does the app show a failed write with the next step, keep what he typed, and recover once the space is back?
3. **Two writers.** The CLI and the app write at once: rate in the app while `ore card retire` runs on the same exercise; two `ore` commands that edit the same skill or source at once; the quick-quiz window and the main window rating the same exercise (`apps/desktop/src/QuickQuiz.tsx`). Does one write lose the other?
4. **The folder moves.** While the app is open: rename the library folder, delete a source folder, replace `skills.yaml` with an older copy, or remove `.index`. What does each screen do on its next action?
5. **Clocks.** A review written with a time in the future (the Mac's clock was wrong) and then the clock set back. Does the queue or the stats break?
The iPhone keeps writes in IndexedDB: fill the browser's storage quota (`navigator.storage.estimate()`) and see what a failed save does there.
