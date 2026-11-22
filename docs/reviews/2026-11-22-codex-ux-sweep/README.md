# Codex UX sweep, 2026-11-22

Tyler: "Use codex to find all obvious ux mishaps". Two Codex testers (`bun run sweep`), sandboxed, about 20 minutes each, on seeded scratch libraries: `mac` (a first-time Mac user's obvious mishaps, the last five days' features first) and `phone` (the same on the iPhone at 390×844 and 375×667). Prompts: `preamble.md`, `mac-prompt.md`, `phone-prompt.md`. Reports: `mac-report.md`, `phone-report.md`.

Seven candidates, seven real, each shown by a test that failed before its fix: Mac 4 (Forge Undo during a save, a use saved twice, the Forge's new-try form with no button, ⌘K New collection by pointer), iPhone 3 (a skill page stale after a source is unfiled, Add a link losing what was typed, the small phone's end screen opening scrolled down). Findings F-new-forge-undo-plan … F-new-phone-end-scroll.

Harness note: the e2e page is 390×844 at load; a journey that sets 375×667 must reload, or the phone's keyboard fit (`PhoneApp.tsx`) reads the shrunk window as the keyboard and scrolls Review's foot into view.
