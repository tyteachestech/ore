Your name is `ai`. First read `codex-out/preamble.md` and follow it.

Your ports: Mac app page http://localhost:1676/ with `window.__ORE_BRIDGE = 1677` (library `/Users/tylerpoelking/Developer/ore-wt/sweep2/codex-out/libs/ai`); iPhone app http://localhost:1681/ (its seed is a copy at `/Users/tylerpoelking/Developer/ore-wt/sweep2/codex-out/libs/ai-phone`; the page's writes stay in IndexedDB). WebKit server: `ws://[::1]:1683/`.

## Your focus: AI that is slow, missing or wrong
Every AI step in Ore is enrichment on add (exercises drafted from a source), grading an Explain answer in Review, the tutor chat, Ask your library (⌘K), explain/look up in the reader, and question variants. Read D21, D116 and anything on AI waits and failures in `docs/DECISIONS.md`, and `packages/core/src/ai/`. Here AI returns null; use `__ORE_FAIL` and `__ORE_SLOW` on each AI command (read `apps/desktop/scripts/mock/tauri.js` and `bridge.ts` for their names) to play each case:
1. **Slow.** 5 s, 30 s, 2 min on each step. Is there a wait that says what is happening, can he leave and come back, does it finish where he left it, can he cancel?
2. **Fails.** A vendor that is not installed or signed out (`claude`/`codex` missing), a rate limit, a timeout, output that is not valid JSON, an empty answer. Does each say what happened and what to do, and does the loop keep going (he can still rate, read, review)?
3. **Rules.** AI never sets the recorded rating (D21): a grade that comes late, or after he rated, must not change his rating. Every AI result records vendor, model and prompt version: check the files written.
4. **Mid-flight.** Switch vendor or model in Settings while a grade or tutor reply is pending; rate the next exercise while the last grade is still coming; close the source while enrichment runs; add five sources at once and watch their enrichment.
5. **Ask and tutor.** An empty library, a question with no answer in the library, a very long question, a reply that cites a source since deleted.
