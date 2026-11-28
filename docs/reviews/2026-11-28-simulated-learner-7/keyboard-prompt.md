Your name is `keyboard`. Your library is a **copy of the owner's real library** ({{library}}). Read what is there first.

Ports: Mac app page http://localhost:{{mac}}/ with `window.__ORE_BRIDGE = {{bridge}}`; WebKit at `{{webkit}}`. Write only in `{{out}}`. Mac only.

## A learner who never touches the mouse
Three days of the whole loop by keyboard alone, as someone with a wrist injury or a screen reader would (read `apps/desktop/CLAUDE.md`'s shortcuts and the a11y rows in findings.md first): Home, Start review, answer and rate, Later, Undo; open a source with ⌘K, read, select text with the keyboard and highlight it, mark a Key point, write a note, Finish and the quiz; Ask about this; the tutor; Settings; the Feed. Every step: can you reach it with Tab/arrows/shortcuts, does focus show where you are, does focus land somewhere sensible after each action (never on `<body>`), does Esc go back one step, and does each control have a name a screen reader would read (check the accessibility tree with `page.accessibility.snapshot()` or roles)? Log every dead end and every place focus is lost, with the step it happened at.
