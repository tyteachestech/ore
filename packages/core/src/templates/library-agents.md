# Ore library — rules for agents

This folder is Tyler's Ore library: captured material, highlights, review items and the review log. Files here are canonical. `.index/` is a disposable cache (`ore reindex` rebuilds it).

## The one rule

**Use `ore` for every write that has invariants**: creating items, highlights and annotation edits, review logging, sessions, enrichment, card state changes. Run `ore --help` for commands; every command accepts `--json`. Never hand-edit `*.jsonl` files or the `id`, `item`, `annotation`, `state`, `created`, `text_sha256` fields.

Plain edits you may make directly:
- Card wording in `cards/<id>.md` (question, answer, rubric, `skills`, `topics`, `content_type`). Then run `ore card show <id>` to check it parses.
- Topic summaries in `topics/<slug>.md`.
- Item frontmatter fields `skills`, `topics`, `status`, and prequestion wording (`prequestions[].q`). Record Tyler's attempts with `ore prequestion`, `ore recall` and `ore check`, not by hand.
- `skills.yaml` only when Tyler asks.

If you edit `doc.md` body text, run `ore doctor --fix` afterwards so highlights re-anchor.

**`notes.md` (the source note, and each skill note in `skills/<id>/notes.md`) is Tyler's own writing.** Never edit it except through `ore notes` (when Tyler gives you his words) and `ore recall`. Never write AI text into it: no summaries, suggestions, corrections, links or "cleaned up" versions. Read it freely for questions about his library. A link in a note is `[text](ore:item/<id>)` or `[text](ore:skill/<id>)`; `ore backlinks <item>` (or `--skill <id>`) lists the notes that link somewhere.

## Layout

```
AGENTS.md                      this file (CLAUDE.md links here)
skills.yaml                    Tyler's skills: id, name, priority P1|P2|P3, hook; optional goal (what he could show he can do; tries are `## Goal try, <date>` in the skill note), icon, color, collection
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
inbox/                         unused (no watcher); add files with `ore add`
.index/library.sqlite          search index and cached card states (gitignored)
.ore/                          lock, open-session marker, background logs (gitignored)
```

Highlight intents: keep (a plain highlight), card (a ★ key point), question (older `research` highlights read as questions). Key points are drafted at once; once an item is done, enrich plans a few cards from its plain highlights (grouped into ideas, `also` on the card), and drafts its source note and prequestions (D19, D118); cards drafted from the source note carry `from: notes`, from a prequestion `from: prequestion` and `prequestion: <n>`.

## Learning rules
- Tyler's rating is what gets logged. An AI grade is only a proposal.
- No streaks, XP, quotas or trend arrows.
- Skill priority sets desired retention only; it never changes FSRS math.
