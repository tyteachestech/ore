# Codex sweeps, 2026-11-12

Tyler asked to run the new sweep process (findings list, `docs/reviews/findings.md`) for a handful of loops. Codex (`gpt-6-astra`, high) ran each sweep on the Mac against master: the desktop in WebKit on the mock, the iPhone in the iOS Simulator. Claude verified each finding, logged it, and fixed it test-first. Prompts are here (`sN-*-prompt.md`); reports and screenshots stay on the Mac (`~/Developer/ore-wt/sweep-sN-out/`).

| Sweep | Tested | Found | Rows | Fixed in |
|---|---|---|---|---|
| s1 desktop | 760bd58: menus (D231), type-select and ⌘ keys (D232), highlight note lists (D233), Home and Feed picks (D234), focus ring (#319), as five study tasks | 6, all seen twice | F23–F27; F28 not a bug | #322 |
| s1 iPhone | reading (D230), share card (D227), skill page and Settings (D228) | (running) | | |

What s1 says about our own checks: a list rule added for All sources and a skill page (D232's type-select and ⌘ keys, the Conventions table's ⇧↑↓ and empty-space click) was never carried to Home and the Feed when D234 made them pick like lists. The Conventions table now says "Any list" means all four, and that a rule is built for all of them in the same PR.
