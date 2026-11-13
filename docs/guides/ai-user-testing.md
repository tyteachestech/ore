# AI user testing for Ore: ChatGPT (GPT-6 Astra) prompt

> **Retired (Tyler, 2026-11-13).** This ChatGPT prompt predates the exercise rename (D181) and the ⌘ list keys (D232), so it sends a tester to old names and keys. Hands-on passes now use the Codex prompt in the project Library (`codex-ux/hands-on-prompt-v2.md`); the old paste parts are in `ai-user-testing/retired/`. Kept for the record.

For the iPhone build in the Simulator, see `ai-user-testing-iphone.md`.

Two parts: a 2-minute setup you run yourself, then the prompt to paste into ChatGPT with computer use on.

---

## Part 1. Setup (you, before pasting)

The agent drives the real app on your Mac. It must never touch `~/Ore`. The installed app reads `ORE_LIBRARY`, so launch it against a seeded scratch library:

```bash
# 1. Quit Ore completely (⌘Q), so the next launch is the test one.
# 2. Fresh test library (same realistic data the screenshot harness uses):
rm -rf ~/ore-test && cd ~/Developer/ore && bun apps/desktop/scripts/mock/seed.ts ~/ore-test
# 3. Launch the app against it:
open -n -a /Applications/Ore.app --env ORE_LIBRARY="$HOME/ore-test"
```

Check: the sidebar shows a skill called "Distributed Systems and Consensus Protocols for Very Large Clusters". That skill exists only in the seed, so it proves you're on the test library. Re-run step 2 and 3 between personas for a clean slate. When done, ⌘Q and reopen the app normally.

AI features (prequestions, quiz checking, card grading, Ask) will use your Claude or Codex plan as usual. Add `--env ORE_NO_ENRICH=1` to step 3 if you'd rather skip background enrichment.

Grant ChatGPT computer-use access to **Ore only** (plus a browser if you want it to copy an article URL). Not Terminal, not Finder.

---

## Part 2. The prompt (copy everything below the line)

---

You are running a usability and bug-hunting study of **Ore**, a Mac learning app, using computer use. You will play several realistic users one after another, try to get real things done the way each would, and then write one structured report. The app is already open on screen, pointed at a disposable test library.

### Safety rules (non-negotiable)

1. Only operate the window titled **Ore**. Do not open Terminal, System Settings, Finder, Mail, or any other app. You may use a web browser only to copy an article or YouTube URL to paste into the app.
2. Before starting, confirm the sidebar contains a skill named **"Distributed Systems and Consensus Protocols for Very Large Clusters"**. If it does not, **stop immediately** and tell me: it means the app is on my real library.
3. Never use "Reveal in Finder" or "Open original" in a way that edits files outside the app. Deleting, archiving and renaming inside the app is fine and expected; it is all test data.
4. **Never quit or relaunch Ore** (no ⌘Q, no Dock relaunch): a normal relaunch opens my real library. If the app crashes or closes, stop and report it as S1.
5. Don't send anything outside this Mac (no sharing, emailing or posting).

### What the app is

Ore turns reading into lasting memory: capture anything → read → highlight → answer AI questions → spaced review. Dark, compact, keyboard-first, modelled on Raycast (speed), Notion (reading), Linear (lists and menus) and Duolingo (encouraging feel). One user, the owner, who reads on his Mac and wants what he reads to stick.

Main places and features:
- **Home** (default page, ⌘0): today's review goal (minutes, 10 by default), **Start review** (↵), skill chips (click toggles, ⌥-click solos), your skills and what to read next.
- **Review** (⌘R anywhere): one card at a time. **Fact** cards: recall in your head, press 1/2/3 for confidence (Guess, Think so, Sure) which reveals the answer, then rate 1–4 or ↵ for Good. **Explain** cards: type an answer (⌘⌫ = No idea), tap confidence, ⌘↵ Check; the AI marks rubric points and proposes a rating, ↵ accepts, 1–4 overrides. After answering: E edits the card, ⇧⌘⌫ retires it, / opens "Ask about this" chat. A missed card comes back once. Esc leaves (ratings are already saved).
- **Sidebar**: Home, sources lists (**To read** ⌘1, **Done** ⌘2, **Feed** ⌘3), skills grouped in collections. Skills and collections can be created, renamed, given an pixel icon and colour, dragged to reorder or into another collection, and deleted. Hovering the collapsed sidebar's edge peeks it open. ⇧⌘S toggles it.
- **Add** (⌘N): paste a URL, YouTube link or text, or drop a file (PDF, EPUB). ⌘O opens a file.
- **Reader**: one comfortable column, a thin position bar, a floating outline at the right edge (hover to expand, click to jump), text size ⌘= / ⌘−, reading width and a light page in Settings (⌘,). Select text → popup to mark it as **Highlight (1)**, **Key point (2)**, **Question (3)** or **Try it (4)**; typing right after a highlight writes its note, Tab also opens the note, Backspace removes it. **H** highlights the focused paragraph (↑/↓ move the focus). **L** reads aloud. **⌘F** finds in the source. **⌥⌘R** renames the source, **⇧⌘A** archives it.
- **Side panel** (⌥⌘S, right of the reader): **Collected** (C, everything you highlighted), **Questions** (Q) and the **source note** (N, your own notes; it can hide the source while you write with ⌥H). **M** recalls the chapter you're in. **Finish** (⇧⌘↵) opens the quiz: free recall first, then each prequestion with confidence and Check (⌘↵), which reveals supporting passages (↑/↓ to step through them).
- **Tutor** (the mole at the bottom right, ⌘J): a chat about the open source or your library.
- **Video and audio sources**: player above the transcript, Space play/pause, ←/→ skip, [ ] speed, the transcript follows playback.
- **Skill page** (click a skill): the skill note, its questions and its reading list.
- **⌘K** command palette for everything; **⌘/** shows and rebinds all shortcuts. Every control with a shortcut should show it in a hover hint.
- Rows open on a **single click**. Arrows move a selection, ↵ opens, Esc closes the top layer. Every list row has a hover **⋯** menu, the same actions on **right-click**, and the same in ⌘K. Destructive actions happen at once and show a toast with **Undo** (⌘Z while it shows).

### Deliberate design choices (do NOT report these as missing)

No streaks that reset, no XP, badges, points, leaderboards or percent-correct scores. No reading-speed or "time left" stats. No AI summaries replacing the user's own notes. AI never sets the final rating; the user does. Dark app (only the reading page has a light option). No "Are you sure?" dialogs when Undo exists. No sounds, no picture-in-picture video. No counts or stat pills added just to fill a screen. The visual style is being reworked separately: report what is broken, not taste. If you think one of these choices is wrong for a persona, you may say so once in the "Opinions" section, not as a bug.

### How to work

- Play each persona below **in order**, for about 15–25 minutes or ~60 actions each. Stay in character: use the input style, pace and expectations described. Think aloud briefly in your notes ("I expected the ⋯ menu to have Rename").
- Before each action, form an expectation; after it, take a screenshot and compare. A mismatch is a finding.
- The app reacts fast (target under 100 ms) and some feedback is brief: **toasts with Undo last only a few seconds**, and there are short animations. Take a screenshot right after any delete, archive or rating so you don't miss them. If you think something "didn't happen", screenshot again after 1–2 seconds before concluding.
- AI steps (prequestions, quiz checking, grading, Ask) take roughly 5–30 seconds. Wait up to 45 seconds before calling one broken, and note the wait time.
- **Reproduce every bug a second time** before reporting it. If it doesn't reproduce, report it under "Unconfirmed" with what you saw, not as a bug.
- Computer use can mis-click or fail at drag and drop. If a drag fails, retry once slowly, then try the keyboard or menu alternative ("Move to…"). Only report a drag bug if the target never lit up or the drop landed somewhere visibly wrong, and say "may be a tooling limitation" if unsure.
- Don't invent internal causes ("the database failed"). Report what you saw on screen.
- Do not try to fix anything or open source code.

### Personas and missions

**1. Maya, first-time user (mouse and trackpad, has used Notion and Duolingo, never seen this app).**
Goal: figure out what the app is for and learn one article with it, without reading docs.
- From Home, work out what to do first. Note anything you didn't understand within 10 seconds.
- Add an article: paste a real article URL (e.g. a Wikipedia page on "Spaced repetition"), then paste a few paragraphs of plain text as a second source.
- Open it, read a bit, answer a prequestion, highlight 4 passages using each type, add a note to one, write a source note.
- Finish the source (the quiz). Then start review and do a few cards.
- Throughout: Was it clear what each highlight type does? Did anything feel intimidating or rewarding?

**2. Dev, keyboard power user (lives in Raycast and Linear, hates touching the mouse).**
Goal: do everything without the mouse.
- Navigate Home → To read → a source → back, using only keys. Use ⌘K to reach at least 8 different actions.
- Highlight text with keys only if possible (say so if not). Open the quiz with ⇧⌘↵ and complete it by keyboard (H highlights the focused paragraph).
- Run a full review session by keyboard: Fact and Explain cards, override a proposed rating, edit one card (E), retire one, open Ask (/), leave with Esc mid-session and come back with ⌘R.
- Open ⌘/, rebind one shortcut, confirm it works and its hover hint updates.
- Check: Does Tab reach every control? Is focus always visible? Does Esc close only the top layer? Does every control with a shortcut show it on hover?

**3. Sam, organizer (Raindrop and Notion user, cares about tidy structure).**
Goal: set up a personal structure for three subjects.
- Create a collection and two new skills in it. Give each an emoji and an icon and a colour. Rename one inline and one from its menu.
- Drag skills to reorder, into another collection, and reorder collections. Do the same via "Move to…".
- File a source under a skill. Rename a source. Archive a source and Undo it. Delete a skill (check what happens to its sources) and Undo if possible.
- For every object you meet (skill, collection, source, highlight, card, question, note), try: create, open, rename, move, reorder, delete/archive, via **⋯**, **right-click** and **⌘K**. Note any of the three that's missing or inconsistent.
- Open a skill page, write a skill note, add a question with the +, drag the column split.

**4. Priya, busy daily reviewer (10 minutes a day, wants to feel progress).**
Goal: do today's review and decide whether she'd come back tomorrow.
- On Home, set the daily goal and the weekdays-only option. Toggle skill chips, ⌥-click to solo one, then start review.
- Do a whole session. Notice the session bar, the goal, what happens when the goal closes, and the end-of-session line.
- Get some wrong on purpose, including one marked "Sure". Does the missed card return? Is the copy encouraging, not guilt-inducing?
- Resume a source you started earlier. Open a YouTube source if one exists (or add one), play, change speed, scroll away and use "Back to current".
- Rate honestly: would Priya return tomorrow, and why?

**5. Rex, chaos tester (tries to break things).**
Goal: find crashes, data loss and broken states.
- Junk input: a 300-character skill name, emoji-only names, names with `/ \ : " # <script>`, empty names, leading/trailing spaces, pasting 50 KB of text as a source, a broken URL, a non-article URL.
- Rapid fire: double- and triple-click buttons, press ⌘R and Esc quickly in a row, undo twice, delete three things fast then ⌘Z.
- Resize the window to very narrow (~700 px) and very wide; check the reader, skill page and Home for overlap, clipping and truncation without ellipsis.
- Navigate away and back mid-task (do not quit the app). Check that scroll position, selected tab, collapsed groups and selection survive.
- Esc and ⌘Z in every layer (popover, menu, dialog, quiz, review, chat).

### Severity scale

- **S1 Blocker**: crash, freeze, data lost or written to the wrong place, can't complete a core flow (add, read, highlight, finish, review).
- **S2 Major**: a feature is broken or gives a wrong result, with no reasonable workaround.
- **S3 Friction**: works, but confusing, slow, inconsistent, or missing an expected way to do it (no right-click, no Undo, no keyboard path).
- **S4 Polish**: visual glitch, alignment, truncation, copy, hover-hint gaps.

### Report format (one Markdown document at the end)

```
# Ore AI test report — <date>

## Summary
- Top 5 issues in priority order (one line each, with IDs)
- Overall: <3 sentences on what works and what doesn't>

## Persona sessions
### <Persona name>
- Missions: <each mission: ✅ done / ⚠️ done with trouble / ❌ couldn't>, approx actions taken
- Most confusing moment: ...
- Most satisfying moment: ...
- Ratings (1–5): Ease ___ · Speed/responsiveness ___ · Felt encouraging ___ · Would return ___
- One quote in the persona's voice

## Findings
### F-01 <short title>
- Severity: S1–S4 · Type: bug / friction / confusion / visual / missing-path
- Persona: ... · Screen: Home / Review / Reader / Sidebar / Skill page / Add / Palette / Shortcuts
- Steps to reproduce:
  1. ...
  2. ...
- Expected: ...
- Actual: ...
- Reproduced: 2/2 (or 1/2 → move to Unconfirmed)
- Evidence: <screenshot description or attached screenshot name>
- Note: "may be a computer-use limitation" if relevant

(repeat; sort by severity, then by how many personas hit it; merge duplicates and list every persona that hit it)

## Lifecycle matrix
Rows: skill, collection, source, highlight, card, question, source note, skill note.
Columns: create, open, rename, move, reorder, delete/archive, Undo, ⋯ menu, right-click, ⌘K.
Cell: ✅ works · ❌ missing/broken (with F-ID) · — not tried.

## Unconfirmed
Things seen once that didn't reproduce, with what you saw.

## Opinions
Design opinions per persona (including on the deliberate choices), clearly marked as opinion.
```

Be concrete and terse. Prefer 15 well-reproduced findings over 50 vague ones. If you run out of time, deliver the report with what you have and say which missions were skipped.
