# Codex sweeps, 2026-11-12

Tyler asked to run the new sweep process (findings list, `docs/reviews/findings.md`) for a handful of loops. Codex (`gpt-6-astra`, high) ran each sweep on the Mac against master: the desktop in WebKit on the mock, the iPhone in the iOS Simulator. Claude verified each finding, logged it, and fixed it test-first. Prompts are here (`sN-*-prompt.md`); reports and screenshots stay on the Mac (`~/Developer/ore-wt/sweep-sN-out/`).

| Sweep | Tested | Found | Rows | Fixed in |
|---|---|---|---|---|
| s1 desktop | 760bd58: menus (D231), type-select and ⌘ keys (D232), highlight note lists (D233), Home and Feed picks (D234), focus ring (#319), as five study tasks | 6, all seen twice | F23–F27; F28 not a bug | #322 |
| s1 iPhone | reading (D230), share card (D227), skill page and Settings (D228), as four tasks | 4 | F29–F32 | #324 |
| s2 desktop | 3d44eba: confirm s1, then a 10-minute session, read and find, tend a skill | 2 | F33–F34 (F34 is F27 after a mouse pick) | #326 |
| s2 iPhone | 3d44eba: confirm s1, then hold to act, review on the bus (blocked: nothing due), search | 4 | F35–F37; F38 open (seen once) | #326 |

What s1 says about our own checks: a list rule added for All sources and a skill page (D232's type-select and ⌘ keys, the Conventions table's ⇧↑↓ and empty-space click) was never carried to Home and the Feed when D234 made them pick like lists. The Conventions table now says "Any list" means all four, and that a rule is built for all of them in the same PR.

s1 iPhone left untested: pinch (the driver has none), seeking from a video transcript, a course's next lesson, the share card from another app. A phone sweep needs its own simulator and `ORE_SIM_DIR`, or another thread's driver kills it.

What s1 iPhone says about our checks: the shell kept fields above the keyboard only on screens that asked (the reader); the drawer now asks too. Making it the default for every field fought his own scrolling (code review), so a new screen with a field still has to ask, as `ios-check` says. The double tap passed in Playwright, whose taps never jitter: on a real finger a tap allows 10 pt.

What s2 says about our checks: s1's fixes held in every confirm run, except F27 after a ⌘-click, which our journey missed because Chromium focuses a clicked button and WebKit doesn't. A pick journey for Home now runs in WebKit. A phone row inside another object's menu opened both menus. The hold timers belonged to every menu around the finger, and nothing in the suite held a row that sits inside a section. The phone sweep shared the desktop sweep's library, and the desktop sweep reviewed everything that was due, so each sweep now seeds its own library.
