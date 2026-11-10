# Codex UX parity loop, pilot: the note editor (Notion), 2026-11-10

How the loop runs and what the pilot showed: `README.md` here (the chat PR). Prompt, checklist and report: `notes-prompt.md`, `notes-checklist.md`, `notes-report.md`. About 14 minutes.

56 items: 52 work, 2 failed, 2 untested (paste without formatting and Esc in an equation, where Codex could not establish what Notion does).

| Finding | Class | Verified | Result |
|---|---|---|---|
| The / menu opened below the window at the bottom of a long note | A | Yes: code and `shots/notes-codex-slash-offscreen.png` | Fixed: `menuPlace` puts it above the line, or caps it and scrolls |
| A slow note read shows a blank editor | C | Dropped | A note is read from a local file in a few milliseconds; Codex added a 2.5 s delay by hand. The wait rule covers the AI and the network, and a spinner that flashes on every note is worse than none |

Guard: every e2e journey now fails when a floating menu, listbox, dialog, toolbar or popover lies outside the window. It found one more: the note's format bar ran 19px past the right edge in a source's note panel (fixed).

Seen, not changed (outside the editor, or in a file another thread is editing): the tutor's selection toolbar has no clamp at the panel's edge; the Explain peek has no clamp at the bottom of a short window; the tutor's @ list could run off the top of a very short window. None is flagged by the guard in today's journeys.
