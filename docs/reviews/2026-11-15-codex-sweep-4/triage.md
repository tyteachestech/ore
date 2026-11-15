# Codex sweep 4: triage

Five Codex testers on ground no earlier sweep took. The Mac froze with all five running at once, so they reran two at a time under the new Mac load rule (`docs/WORKFLOW.md`). Each finding was reproduced by a test before it was fixed; every row is in `docs/reviews/findings.md` with its guard.

| Report | Finding | Verdict |
|---|---|---|
| firstrun 1 | A short caught-up review showed the goal as minutes spent | fixed |
| firstrun 2 | Finish promised exercises: the phone drafts none, and a Mac run that drafted none said nothing | fixed (phone copy names the Mac; Mac says no exercises came and what to mark) |
| firstrun 3 | Recall feedback waited forever on an empty reply | not a bug: only the mock answers null |
| firstrun 4 | Start review on day 0 said "All caught up" | fixed |
| settings 1 | A goal changed mid-session didn't reach the open Review | fixed |
| settings 2 | New exercises a day set to 0 mid-session kept serving new ones | fixed |
| settings 3 | iPhone Today kept the old goal after Settings | fixed |
| settings 4 | ⌘Z of a goal change left Home on the undone value | fixed |
| settings 5 | Reading look, sounds, menu bar and shortcut changes aren't on ⌘Z | Tyler: Mac apps don't undo preferences; keep or add |
| settings 6 | A failed When you review save lost the typed words | fixed |
| settings 7 | A goal off the list showed no choice picked | fixed |
| settings 8 | A bad value in skills.yaml fell back silently | fixed (Settings names it) |
| settings 9 | An empty skill name in skills.yaml showed a blank skill | fixed (its id shows; doctor names it) |
| durability 1 | A failed phone save looked saved, gone on reload | not a bug: only the browser build's IndexedDB stand-in; the iPhone app keeps and retries a failed write |
| durability 2 | A library moved while Ore was open was replaced by an empty one | fixed (says it was moved, makes none) |
| durability 3 | A wrong clock's future review made the replayed schedule differ from the saved one | fixed (the rating is saved as the log replays; doctor names the future-dated review) |
| durability 4 | A killed add left a folder nothing names | fixed (doctor names it) |
| languages 1 | A Korean PDF came in as punctuation | fixed (CMaps carried in `ore` and the phone; punctuation alone is no text) |
| languages 2 | A Hebrew PDF from macOS saved words in reverse | open: needs the sweep's file |
| languages 3 | Arabic and Hebrew read left to right | fixed (each block takes its direction from its letters) |
| languages 4 | A Thai page was refused as almost no text | fixed |
| languages 5 | Search missed words inside Chinese, Japanese, Thai | fixed |
| languages 6 | Accents typed two ways didn't find each other | fixed (search and Find) |
| languages 7 | Ruby spaced off or hidden | fixed (letters with the reading in brackets) |
| languages 8 | Joined emoji came apart from web pages | fixed |
| scale 1 | A drag on a long book while it loads was dropped | fixed (kept, highlighted once loaded) |
| scale 2 | Phone holds a frame ~500 ms opening a skill, ~330 ms starting Review | open: needs a profile |
| scale 3 | Filing or archiving one source rereads both source lists | open |
