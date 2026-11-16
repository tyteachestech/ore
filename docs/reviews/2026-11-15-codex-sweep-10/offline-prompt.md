Your name is `offline`.

Your ports: Mac app page http://localhost:{{mac}}/ with `window.__ORE_BRIDGE = {{bridge}}` (library `{{library}}`); iPhone app http://localhost:{{phone}}/ (its seed is a copy at `{{phoneLibrary}}`; the page's writes stay in IndexedDB). WebKit server: `{{webkit}}`. The `ore` CLI: `ORE_LIBRARY={{library}} ORE_NO_ENRICH=1 bun packages/cli/src/ore.ts` (keep `ORE_NO_ENRICH=1`: without it a read like `today` starts AI enrichment). Write everything to `{{out}}/` and the report to `{{out}}/report.md`.

Read `docs/reviews/sweeps.md` first: it lists every earlier tester's angle. Yours is new ground.
Your library is seeded with `seed.ts`.

## Your focus: the Feed over weeks, and the Mac offline or on a bad network
The Feed has produced bugs every time anyone passed through it (F143, F144, F303), and only the phone was ever tested offline (s4b). Read the Feed's code (`apps/desktop/src/Feed*.tsx`, the core's feed module, the CLI's feed commands) and the decisions on it (grep DECISIONS.md for feed, follow, post), and how adds, the tutor, grading and refresh reach the network.
1. **Feeds that change.** Serve your own feeds from files the page or CLI can reach (a `file://` path if the code allows, or ask the bridge's `ore` to add a local file feed; otherwise use `__ORE_REPLY`/`__ORE_EDIT` hooks in `apps/desktop/scripts/mock/tauri.js` to change what refresh returns). Over simulated weeks (`page.clock`): new posts, an edited post, a post removed, a feed that vanishes, returns malformed (bad XML, HTML instead of XML, empty, huge), doubles its items, changes its title or URL; follow many feeds; keep some posts, add some as sources, leave others. Does the Feed keep what he kept, never double a source, show each failure with a next step, and stay fast?
2. **Offline and bad network.** With `__ORE_FAIL` / `__ORE_SLOW` on the network-bound commands (add a link, feed refresh, enrich, tutor, grade, explain; find which ones by reading the code), and `context.setOffline(true)` for anything the page fetches itself (YouTube embed, images): every screen that needs the network says so with a next step, nothing waits forever, nothing half-saves (a link added offline is refused with its next step per D96, or queued and finished later: which does the code promise?), and coming back online recovers without a reload.
3. **iPhone.** The phone offline (`context.setOffline`) and its Feed if it has one.
Report lost or doubled data first, then endless waits and silent failures.
