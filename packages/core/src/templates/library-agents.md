# Ore library — rules for agents

This folder is Tyler's Ore library: captured material, highlights, review items and the review log. Files here are canonical. `.index/` is a disposable cache (`ore reindex` rebuilds it).

## The one rule

**Use `ore` for every write that has invariants**: creating items, highlights and annotation edits, review logging, sessions, enrichment, card state changes. Run `ore --help` for commands; every command accepts `--json`. Never hand-edit `*.jsonl` files or the `id`, `item`, `annotation`, `state`, `created`, `text_sha256` fields.

Never edit a library file by hand: `ore` checks what it writes and keeps the lock, the review history and the index right. Card wording goes through `ore card set <id> --question … --answer … --point … --ai <stamp JSON or null>`, a source's title, author and skills through `ore edit`, its status through `ore status`, skills through `ore skills`. When no command does what Tyler asks, say so instead of editing the file.

For AI-written replacement exercise wording, `--ai` is its actual author's `{vendor, model, prompt_version}` JSON. `ore ask` returns the rewrite as `proposal` with its `ai` stamp; use them together when your own model and prompt version are unknown. Never reuse the previous author's stamp. For Tyler's own wording, use `--ai null`.

**`notes.md` (the source note, and each skill note in `skills/<id>/notes.md`) is Tyler's own writing.** Never edit it except through `ore notes` (when Tyler gives you his words) and `ore recall`. Never write AI text into it: no summaries, suggestions, corrections, links or "cleaned up" versions. Read it freely for questions about his library. A link in a note is `[text](ore:item/<id>)` or `[text](ore:skill/<id>)`; `ore backlinks <item>` (or `--skill <id>`) lists the notes that link somewhere.

## Layout

```
AGENTS.md                      this file (CLAUDE.md links here)
skills.yaml                    Tyler's skills: id, name, priority P1 Focus|P2 Normal|P3 Light (new skills start P3), hook; optional archived: true (its cards wait out of review); optional goal (what he could show he can do; each dig at it is `## Dig, <date>` in the skill note and a record in skills/<id>/digs.json, `ore dig <skill>`), icon, color, collection
topics/<slug>.md               frontmatter: id, name, status (active; older research topics are wanted), skills[], aliases[]; body: summary
items/<yyyy>/<slug>-<id>/
  thumbnail.<ext>              picture shown in lists and the reader (absent for pasted text)
  doc.md                       canonical text + frontmatter (id, type, title, url, status, skills, topics, prequestions with before/after attempts and the quiz's key points and check, recall, text_sha256, ...)
  source.<ext>                 original file, never modified (absent for snippets)
  annotations[.<device>].jsonl highlights, append-only, one file per device; an edit appends the same id with a higher `rev`
  notes.md                     Source note: Tyler's own Markdown about this source (absent until he writes); enrich drafts from it
  images/                      images in the source note, linked by relative path
  diagrams/<name>.excalidraw   his drawings in the source note (Excalidraw's JSON format), linked as ![Diagram](diagrams/<name>.excalidraw); write only through `ore diagram`
skills/<id>/notes.md           skill note: Tyler's own Markdown about one skill, across sources (absent until he writes)
cards/<id>.md                  one review item per file; kind card (Q --- A) or prompt (Q --- model answer + ## Rubric)
cards/<id>.variants.jsonl      remixed versions of that card, append-only; write only through `ore`
reviews/<yyyy>-<mm>[.<device>].jsonl   append-only review log, one file per device; the source of truth for scheduling
sessions/<yyyy>-<mm>[.<device>].jsonl  review session start/end receipts
chats/<id>.json                his tutor chats as the app shows them (title, @ context, turns); written only through `ore chat`
inbox/                         links added on the iPhone (`<id>.link.json`), waiting for the Mac to import them (`ore inbox --import`)
.index/library.sqlite          search index and cached card states (gitignored)
.ore/                          lock, open-session marker, background logs (gitignored)
```

Highlight intents: keep (a plain highlight), card (a ★ key point), question (older `research` highlights read as questions), apply (a Try it: a technique to try, D127). Key points are drafted at once; enrich plans a few cards from an item's plain highlights (grouped into ideas, `also` on the card) once it is done, or while it is still being read once its highlights are six hours old (D180, the daily catch-up); once it is done it also drafts its source note and prequestions (D19, D118); cards drafted from the source note carry `from: notes`, from a prequestion `from: prequestion` and `prequestion: <n>`.

## Learning rules
- Tyler's rating is what gets logged. An AI grade is only a proposal.
- No streaks, XP, quotas or trend arrows.
- Skill priority sets desired retention only; it never changes FSRS math.

## Saving a Dig

`ore dig <skill> --text` saves the Dig record; it does not append to the skill note. As in the app, save Tyler's words to both places. First read `ore dig <skill> --json` and confirm the skill has a goal. Once he gives his memory response, put those exact words in `ANS` by the shell-quoting rule (each `'` as `'\''`, inside the recipe's one pair of single quotes). Replace `<skill>` with its ID and `<YYYY-MM-DD>` with today's local date:

```bash
ANS='<shell-escaped text>'
ore notes --skill <skill> --append "$ANS" --heading "Dig, <YYYY-MM-DD>" --json &&
ore dig <skill> --text "$ANS" --json
```

Verify both with `ore notes --skill <skill> --json` and `ore dig <skill> --json`. Stop on an error; if the note was saved but the Dig failed, the words are already safe in the note, so do not append them again when resuming. Never put AI feedback in the note. `ore dig <skill> --drop <dig>` removes only the Dig record; it does not undo the note append.
