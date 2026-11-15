Your name is `settings`. First read `codex-out/preamble.md` and follow it.

Your ports: Mac app page http://localhost:1730/ with `window.__ORE_BRIDGE = 1731` (library `/Users/tylerpoelking/Developer/ore-wt/sweep4/codex-out/libs/settings`); iPhone app http://localhost:1732/ (its seed is a copy at `/Users/tylerpoelking/Developer/ore-wt/sweep4/codex-out/libs/settings-phone`; the page's writes stay in IndexedDB). WebKit server: `ws://[::1]:1739/`. The `ore` CLI: `ORE_LIBRARY=/Users/tylerpoelking/Developer/ore-wt/sweep4/codex-out/libs/settings bun packages/cli/src/ore.ts`.
Your library is seeded with `seed-big.ts` (a year of use).

## Your focus: every setting, changed in the middle of use
Read Settings (`apps/desktop/src/Settings*.tsx`), where each setting is saved (`skills.yaml` or elsewhere), and the D-numbers that name each one. List every setting first, then for each:
1. **It takes effect.** Change it, then check every screen it should change, with no reload: the daily goal on Home's ring and the end screen; retention on the next due dates (D22: priority never changes FSRS math); new exercises per session; a skill's goal or importance; the AI vendor and model; sounds; the quick-quiz shortcut; text size. Name any screen that still shows the old value.
2. **Mid-session.** Change each one while Review is open and halfway through. Does the session follow the new value, keep the old one on purpose, or mix them?
3. **Bad values.** Every field that takes a number or a name: 0, negative, huge, empty, a decimal, text. Constrained to valid values (`CLAUDE.md` UI bar), or saved as nonsense? Then write the same bad values into `skills.yaml` by hand and reopen: does the app read them safely and say what is wrong?
4. **Lasting.** Quit and reopen (a fresh page), and open the iPhone on a copy of the library: does every setting come back, and does the phone honour the ones it shares?
5. **Undo and reset.** Can every change be undone (`CLAUDE.md`: undo for every change), and is there a way back to the default?
