Your name is `firstrun`. First read `codex-out/preamble.md` and follow it.

Your ports: Mac app page http://localhost:1721/ with `window.__ORE_BRIDGE = 1722` (library `/Users/tylerpoelking/Developer/ore-wt/sweep4/codex-out/libs/firstrun`); iPhone app http://localhost:1736/ (its seed is a copy at `/Users/tylerpoelking/Developer/ore-wt/sweep4/codex-out/libs/firstrun-phone`; the page's writes stay in IndexedDB). WebKit server: `ws://[::1]:1739/`. The `ore` CLI: `ORE_LIBRARY=/Users/tylerpoelking/Developer/ore-wt/sweep4/codex-out/libs/firstrun bun packages/cli/src/ore.ts`.
Your library is empty: made with `ore init` and nothing else. Keep it that way until a step adds to it.

## Your focus: the first week, from an empty library
Every earlier sweep started from a seeded library, so no one has seen what a new learner sees. Read `docs/design/daily-session.md`, the purpose rule in `CLAUDE.md`, and the empty states in `DESIGN.md`.
1. **Day 0.** Open every screen with nothing in the library: Home, Review, a skill page, All sources, the Feed, Settings, search, ⌘K. Does each say what to do next in one line, with a control that does it? Any count reading 0 of 0, NaN, "undefined", a ring or chart with no data, a dead button, or a screen that is blank with no next step?
2. **The first source.** Add one article (serve a local page), read it, highlight, make the first exercises (AI is off here: what does he see, and can he write one himself?), and file it into a first skill. Is every step findable without knowing the app? Note each place you had to guess.
3. **The first review.** Review the first exercises. Then move the clock (`page.clock`) a day, three days, a week: what does Home say when nothing is due yet, when one thing is due, and after the first goal is met? Do the numbers, levels and the ring make sense with one or two exercises?
4. **Growing.** Add a second and third source and a second skill, delete or archive the first, and empty a skill again. Does every screen go back to a sensible empty state, or do stale rows, counts or a skill with nothing in it remain?
5. **The library folder.** Start with no library at all (`ORE_LIBRARY` pointing at a folder that does not exist, and an empty folder that has no `skills.yaml`). What does `ore` and the app do?
On the iPhone too: its first run on an empty library, the first add and the first review.
