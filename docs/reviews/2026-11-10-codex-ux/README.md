# Codex UX parity loop, pilot, 2026-11-10

The bug loop (`../2026-11-09-codex-sweeps.md`) pointed at basic UX instead: Codex (`gpt-6-astra`, high effort) writes a checklist of what the reference app does on one kind of surface, before it opens Ore, then tests every item twice in the mock in Chromium and WebKit and classes each miss. One sweep per surface.

## How it ran
The setup of the bug loop: a clone at master for Codex with `scripts/mock` (one vite, a bridge and a scratch library per surface, `ORE_MOCK_AI` with a 6 s `ORE_MOCK_DELAY`), a clone per fix branch. The prompt for each surface is `<surface>-prompt.md`; its checklist is `<surface>-checklist.md` and its report `<surface>-report.md` (local paths cut; of its ~250 screenshots a surface only the ones a finding needs are kept in `shots/`). The prompt names what is already covered (the Conventions table, earlier audits, the decisions) and what is Tyler's open call, so neither comes back.

Classes: **A** a plain miss, **B** needs Tyler, **C** the same kind is likely on other screens.

## Tutor chat (ChatGPT, Claude, Notion AI): about 25 minutes
60 items: 51 work, 5 failed (4 findings), 4 untested (the native right-click menu, Tab in WebKit, a partly streamed reply, and one item D128 rules out).

| Finding | Class | Verified | Result |
|---|---|---|---|
| Esc in the chats menu put focus in the field, not back on its title | A | Yes, in the code | Fixed; the note's format bar popovers had the same fault (focus lost on Esc), fixed |
| Send had no hover hint | C | Yes | Fixed in the tutor and Ask; the guard found five more icon-only buttons with none, hinted |
| WebKit: ⌘Z then ⇧⌘Z after a send put the sent message into the next draft | C | Yes, in WebKit | Fixed in the tutor, Ask and a question's answer box |
| The tutor opened on a skill's page is not scoped to that skill | B | Yes | Left for Tyler |

Guards: `test/hints.test.ts` (every icon-only button sits in a `<Hint>` or is listed with why), `test/menu-focus.test.ts` (a layer that cancels Radix's focus return is listed with where focus goes), and e2e journeys can now run in WebKit (`journey(name, run, "webkit")`) for what only the Mac app's engine does.

## Note editor (Notion): about 14 minutes
56 items: 52 work, 2 failed, 2 untested (paste without formatting, Esc in an equation). Record in the notes PR (`notes-*.md`).

## What the pilot showed
- 116 items checked, 103 worked, 6 findings, 5 real and 1 dropped. Both guards and the class C checks then found 7 more of the same kinds that Codex had not reached.
- The checklists lean on plain text editing (typing, selection, paste), which the browser gives for free and so mostly passes. The findings came from controls, focus and placement. The next prompt should ask for fewer native-editing items and more on menus, popovers, focus after each action, window edges and short windows.
- Codex writes the checklist from what it knows of the reference app; it does not open it. The notes run fetched Notion's keyboard help page on its own, which is worth asking for.
- The mock answers a chat in one piece, so a partly streamed reply could not be tested.
