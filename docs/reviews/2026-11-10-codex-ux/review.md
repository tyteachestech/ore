# Codex UX parity loop: Review (Anki, Mochi), 2026-11-10

How the loop runs: `README.md` here. Prompt, checklist and report: `review-prompt.md`, `review-checklist.md`, `review-report.md`. About 31 minutes. The prompt took the pilot's lesson: at most 8 items on plain text editing, the rest on controls, keys in each state, focus, short windows, waits and errors; each item marked sure or unsure about what the reference does, and an unsure one that fails is not a finding. Neither app was opened.

56 items: 42 work, 9 differ or are missing, 5 untested. Of the 9, five are how Ore means to work (confidence 1 to 3 shows the answer where Anki uses Space, D21 and D59), unsure about the reference, or WebKit's own Tab setting, which skips buttons outside Ore too. Two are findings.

| Finding | Class | Verified | Result |
|---|---|---|---|
| The exercise editor's Cancel had no hover hint, though Esc cancels and Save beside it shows ⌘↵ | A | Yes, in the code | Fixed: "Cancel Esc" on hover |
| No way to put an exercise off without rating it (Anki's Bury) | B | Yes | Left for Tyler |

Guard: `test/hints.test.ts` "dismiss buttons": a Cancel, Close, Done or Back that Esc runs shows Esc in its label or its hint, or is listed with why (a default button that shows ↵, a Cancel that stops a download and that Esc must not run). It flagged only this one.

Untested: the native right-click menu (not visible to a headless browser), a picker with many skills, cut then ⌘Z in WebKit (fails in a bare textarea outside Ore too), and two items with nothing to test (no action menu in Review, no menu in the quick quiz).
