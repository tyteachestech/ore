# Mocked app for screenshots

Runs the desktop UI in a plain browser against a scratch library, through the real `ore` CLI.

```bash
bun apps/desktop/scripts/mock/seed.ts /tmp/ore-mock          # realistic library: skills, sources, highlights, cards, due reviews
bun apps/desktop/scripts/mock/seed-big.ts /tmp/ore-big       # a year of use: ~240 sources, 14 skills, ~1000 reviews (views at scale)
bun apps/desktop/scripts/mock/seed-demo.ts ~/OreDemo         # the library the product video is filmed on (below)
ORE_LIBRARY=/tmp/ore-mock bun apps/desktop/scripts/mock/bridge.ts &   # :1421 (PORT= for another)
cd apps/desktop && bun run dev &                               # vite on :1420
```

In Playwright, before `goto("http://localhost:1420/")`: `await page.addInitScript({ path: "apps/desktop/scripts/mock/tauri.js" })`
(set `window.__ORE_BRIDGE = <port>` in an earlier init script for a second bridge). AI commands return null, so AI results don’t render, unless the bridge runs with `ORE_MOCK_AI=<dir>`: then `<dir>/<command>.json` (`explain.json`, `research.json`…) answers that command, after 600 ms or `ORE_MOCK_DELAY` ms (set it long to look at a wait). Background enrichment after an add is off (it would run the real `claude` or `codex` CLI and spend usage); `ORE_MOCK_ENRICH=1` turns it on. `ORE_MOCK_REAL_AI=1` runs the AI commands for real instead (a rehearsal on a copy of a real library; it spends usage).

Every seed ends with `addMess` (`mess.ts`): `.DS_Store`, `._` files, `Icon\r`, a stray `.txt` and an empty
folder, as Finder leaves them in a real library. Code that walks the library must skip them.

### The demo library

`seed-demo.ts <new folder>` writes a year of one person's learning that reads well on camera: 46 sources over seven
skills, 90 exercises with real questions and answers (all written for Ore), a year of reviews replayed through
FSRS, and today set up to film: nine of the day's ten minutes done, about a dozen exercises due, six gems one Good
from being cut, and AI two gems short of level 2. It refuses a folder that isn't empty. On the Mac:
`ORE_LIBRARY=~/OreDemo open -n /Applications/Ore.app`. Seed it on the day of filming (dates count back from now),
and again for another take. `apps/desktop/test/seed-demo.test.ts` holds that state.

### Zoomed crops

Shoot at Retina scale, then crop each component the change touches at 4× and compare it with its `DESIGN.md`
entry. Element boxes can be centred while the glyph ink is not, so judge the pixels, not `getBoundingClientRect`.

```ts
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1280, height: 800 } });
// …open the screen…
const zoom = await browser.newPage({ deviceScaleFactor: 4, viewport: { width: 1280, height: 800 } });
// …open the same screen…
for (const [i, el] of (await zoom.locator(".chip").all()).slice(0, 3).entries()) await el.screenshot({ path: `chip-${i}.png` });
```

### Options and style checks

`ab.ts` shoots a screen as it is and with each option's CSS laid over it, at 2× with optional 4× crops, so a look can be
picked before it is built: `bun apps/desktop/scripts/mock/ab.ts /tmp/ab skill:Teaching --crop .skill-note A=a.css B=b.css`.
`style-check.ts` walks Home, a skill page and a source and lists what breaks `DESIGN.md`'s style rules in the rendered
page: a box inside a box, and UI text off the type ramp. It exits non-zero on any finding.

## In the real macOS webview

Chromium can pass where WKWebView doesn't (pointer events, menus, drag). To drive the real webview with
screen tools without touching the installed app or ~/Ore, build a debug copy with its own bundle
id from a worktree: set `identifier` to `com.tylerpoelking.ore.dragdebug` and `productName` to
`Ore Debug` in `src-tauri/tauri.conf.json` (local edit, never committed), then
`bun run tauri build --debug --bundles app` and launch
`ORE_LIBRARY=/tmp/ore-dbg "$HOME/Library/Caches/ore/target/debug/bundle/macos/Ore Debug.app/Contents/MacOS/ore"`.
`tauri dev` won't do: it runs a bare binary with no bundle id, so screen tools fall back to (and relaunch)
the installed app. The debug app runs whichever `ore` is on PATH (the master checkout), so set
`ORE_BIN=<worktree>/packages/cli/src/ore.ts` when the branch changes the CLI.
