Your name is `ux`.

Your ports: iPhone app page http://localhost:{{phone}}/ (library `{{phoneLibrary}}`); Mac app page http://localhost:{{mac}}/ with `window.__ORE_BRIDGE = {{bridge}}` (library `{{library}}`), for comparing with the Mac. WebKit server: `{{webkit}}`. The `ore` CLI: `ORE_NO_ENRICH=1 ORE_LIBRARY={{library}} bun packages/cli/src/ore.ts` (always keep ORE_NO_ENRICH=1). Write everything to `{{out}}/` and the report to `{{out}}/report.md`.

## What changed (PR #519, D350, F550)
The iPhone's Add sheet (the + in the top bar, and "Add a source to <skill>" on a skill's page) took only a link or a picked file; anything else was refused with "That isn’t a link". Now, as in the Mac's Add box (⌘N):
- The field is a text box (`Grow`) that grows with what is in it and scrolls inside itself past 40% of the screen height. Return (the keyboard's Go) adds; Shift+Return adds a line; pasted text keeps its lines.
- What it holds is read by `phoneEntries` in `apps/desktop/src/phone/AddLink.tsx`, built on the Mac's `entries` in `apps/desktop/src/paste.ts`: one link, or a list of links one per line, is saved to the inbox (`ore inbox --add`) and read on the phone as before. Anything else is ONE text source, added at once with `ore add --stdin` (with `--html` when the paste carried headings, tables, images, code or math), filed under the skill whose page opened the sheet. It opens in the reader, and a toast says Added “<title>” with Undo (which archives it). Added twice: "Already here: “<title>”".
- A file path typed on the phone is words (only the Mac reads paths).
- Its exercises come later from the Mac's daily catch-up, as for everything the phone adds (the phone runs no AI). Do not report the missing exercises.
- The + button's accessible name is now "Add a source"; placeholder "Paste a link or any text".
Read `apps/desktop/src/phone/AddLink.tsx`, `apps/desktop/src/phone/PhoneApp.tsx` (`addedText`, `bringIn`), `apps/desktop/src/paste.ts`, `apps/desktop/src/Add.tsx` (the Mac's box, the reference), `packages/core/src/ingest` (`addText`) and D350 in `docs/DECISIONS.md` first.

Parity is the bar (Tyler: the phone matches the Mac wherever possible): for every case, do the same on the Mac's Add box and report where the phone behaves differently without a reason in D350. Simulate a paste with `page.evaluate` dispatching a `paste` ClipboardEvent whose `clipboardData` (a `new DataTransfer()` with `text/plain` and, where it matters, `text/html`) you fill, then set the value as a paste would; also test typing with `page.keyboard.type`. iOS-only behaviour (the real keyboard, the system Paste menu, autocorrect) can't be reached here: list what you could not check instead of guessing.

## Your focus: the UI and UX of adding text on the iPhone, as a learner meets it
Tyler: "Test UI and UX as well as basic technical implementation against all edge cases." You take the UI and UX; another tester takes the data edge cases.
Walk it as a learner would, each path twice from a fresh page, at 390×844 and at 375×667 (a small phone), in dark mode and light mode:
- Open Add from Today's +, from a skill's page, and from an empty library's hint. Paste a short note, a long article (5,000+ words), a ChatGPT-style answer with headings, a list and code, and a list of links. What does the field look like at each size? Does the sheet stay above a keyboard (the app reads `--keyboard`; `apps/desktop/e2e/journeys.ts` has a `keyboardUp` helper), is Add always in reach, does a long paste scroll inside the field, can you get back to the top of what you pasted?
- After Add: does the right thing open, is the title what a learner expects, is the toast right, does Undo really take it back (gone from Today, Sources, the skill page, search), and Redo? Is focus somewhere sensible after each step (VoiceOver users: names, roles, the error tied to the field)?
- Leave the sheet half-filled (tap outside, swipe down, Esc) and come back from the same place and from a skill page: is your text kept where it should be (D342) and not where it shouldn't?
- Every wait and error: make `add` slow and failing (`__ORE_SLOW`, `__ORE_FAIL`), make `inbox` fail. Is there a sign it is working, can you double-submit, is the error worded for the phone with a next step, is your text kept for a retry?
- Compare each step with the Mac's ⌘N box on the same input and list each difference with your judgement: a parity gap, or a phone reason.
- Wording and the purpose rule: every word on the sheet earns its place? "Add a source", the placeholder, the empty-state hints.
Then list the three moments you hesitated most, each confirmed twice.
