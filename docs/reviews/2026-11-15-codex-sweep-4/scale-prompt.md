Your name is `scale`. First read `codex-out/preamble.md` and follow it.

Your ports: Mac app page http://localhost:1724/ with `window.__ORE_BRIDGE = 1725` (library `/Users/tylerpoelking/Developer/ore-wt/sweep4/codex-out/libs/scale`); iPhone app http://localhost:1726/ (its seed is a copy at `/Users/tylerpoelking/Developer/ore-wt/sweep4/codex-out/libs/scale-phone`; the page's writes stay in IndexedDB). WebKit server: `ws://[::1]:1739/`. The `ore` CLI: `ORE_LIBRARY=/Users/tylerpoelking/Developer/ore-wt/sweep4/codex-out/libs/scale bun packages/cli/src/ore.ts`.
Your library is seeded with `ORE_SEED_SCALE=10 bun apps/desktop/scripts/mock/seed-big.ts`: about ten years of use. Check the counts it printed in `codex-out/libs/scale.log`.

## Your focus: a library ten times bigger than today's
`bun run bench` times a few screens on 950 sources; no one has used the app at ten times that. Read `docs/guides/bench.md` and `docs/research/` on performance. Time each step with `performance.now()` around the action and the first frame after it (`requestAnimationFrame`), three runs each, and note anything over 100 ms for a key press, 300 ms for a screen, or 2 s for anything.
1. **Every screen.** Home, Review, each skill page (the biggest one and a small one), All sources (scroll to the end), the Feed, search and ⌘K with a common word, Settings. First open and the second open.
2. **Every action, in the big skill.** Rate an exercise, undo it, retire one, file a source, rename the skill, archive a source, add a highlight in a long source, type in a note. Does each stay instant, or does one write reload everything?
3. **A long session.** Do 200 reviews in one page without reloading. Does the page's memory (`performance.memory` where present, or the DOM node count) keep climbing, and does the 200th rating feel like the first?
4. **The CLI.** Time `ore due`, `ore stats`, `ore list`, `ore doctor` and `ore search` with `--json`. Which grow faster than the library?
5. **The phone.** The iPhone on the same scale: Today, a skill page, Review and search. It keeps the library in IndexedDB: how long does the first load take, and is anything refused or cut off?
Report the slowest steps first, with the numbers.
