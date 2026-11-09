# Ore spec

Read `docs/DECISIONS.md` first. Evidence and option research live in `docs/research/`. This file is the build contract for v0 and v1.

## 1. Loop

capture → (AI: prequestions, skills, topics) → read + highlight (one highlight, marked ★ Key point or Question if he wants, optional note; D118) + a source note in his own words (section lines, chapter and finish recall) → (AI: draft cards and prompts from key points at once and, after the finish, a planned few from his highlights, plus the source note and the prequestions; D118) → review (confidence → answer → AI grade proposal → your rating → FSRS) → skill-level stats.

## 2. Library layout (`~/Ore`, override with `ORE_LIBRARY`)

```
AGENTS.md                      # rules for agents editing this folder (CLAUDE.md symlinks to it)
skills.yaml                    # Tyler's skills: id, name, priority (P1|P2|P3), hook; optional goal (D102), icon (mc:<name>, a pixel skill icon, D157; emoji and ph:<name> from before it still draw), color, collection (D36); optional `review: {goal_minutes, weekdays_only, new_per_day, remix, plan, reminder}` (D60, D66, D67; defaults 10, false, 10, true, "", ""; reminder is local "HH:MM")
topics/<slug>.md               # frontmatter: id, name, status (active|wanted), skills[], aliases[]; body: AI summary
items/<yyyy>/<slug>-<id>/
  doc.md                       # canonical text + frontmatter (below)
  thumbnail.<ext>              # picture for lists and the reader (D77), 480 px; absent for pasted text and snippets
  source.<ext>                 # original file, never modified (absent for snippets)
  annotations.<device>.jsonl   # one annotation per line, append-only; edits append a new line with same id and higher `rev`; one file per device (D78), read together with an older `annotations.jsonl`
  notes.md                     # Source note (D31): plain Markdown, no frontmatter, Tyler's writing only; absent until first write; outside doc.md, so never changes text_sha256
  map.excalidraw               # planned (D35): Tyler's map, Excalidraw JSON; absent until first drawn
  assets/<hash>.<ext>          # images the source shows (D96): downloaded or unpacked at add, named by content hash, linked from doc.md by relative path
  images/<slug>.<ext>          # images in the source note (D38), copied by `ore notes --attach`, linked by relative path
  diagrams/<name>.excalidraw   # D40, D103: drawings in the source note, Excalidraw's JSON format one element per line, drawn in the app's own editor, linked as ![Diagram](diagrams/<name>.excalidraw); written only through `ore diagram`
feeds.yaml                     # feeds he follows (D107), in his order: url, title, site, skills
feeds/read.<device>.jsonl      # which Feed posts he has read (D107), latest mark per post wins
skills/<skill-id>/notes.md     # skill note (D41): his writing only, like the source note; images/ beside it
cards/<id>.md                  # one review item per file (kind card|prompt)
cards/<id>.variants.jsonl      # remixed versions of that card (D66), append-only with `rev` like annotations.jsonl
reviews/<yyyy>-<mm>.<device>.jsonl    # append-only review log, one per device (D78); source of truth for scheduling
sessions/<yyyy>-<mm>.<device>.jsonl   # session start/end receipts (habit metric)
inbox/                         # dropped watcher (D95): a file added from here with `ore add` is removed after ingest
.index/feeds.json              # fetched Feed posts (D107), rebuilt by `ore feed --refresh`
.index/library.sqlite          # FTS5 index + materialized card states; gitignored; `ore reindex` rebuilds
.ore/                          # lock, open-session marker, last-snapshot marker, background enrich logs (gitignored)
```

History (D5): every `ore` command snapshots the library into its local git repo when the last snapshot is over ten minutes old (`ore session end` always does); never pushed, never fails a command.

IDs: ULID (26 chars). Slugs: kebab-case title, max 60 chars. Timestamps: ISO 8601 UTC.

References stay valid (maps, D35, and anything else that points at library objects): core never renames or deletes item folders, `cards/<id>.md` or topic files; edits keep IDs. When topic merging (D25) is built, the merged-away slug goes into the survivor's `aliases[]` and every lookup by slug resolves aliases.

### doc.md frontmatter
```yaml
id: 01J...
type: article | pdf | youtube | markdown | snippet | epub
title: ...
url: https://...            # optional
author: ...                 # optional
captured_at: 2026-10-09T...
source_app: Safari          # snippets only
text_sha256: ...            # of the body; anchoring checks this
status: inbox | reading | done
skills: [ai, learning]      # AI-assigned (only obvious fits, may be empty), user-editable
suggested_skill:            # optional: AI-proposed skill when none fits; accept or dismiss (D25)
  name: Web Development
  hook: ...
topics: [slug, slug]        # AI-assigned
video:                      # optional: a page that plays a video (D92): its YouTube link; transcript.vtt beside source.html
course:                     # optional: a lesson of a course (D79); lessons share id, listed by part
  id: 01J...
  title: AI Fluency: Framework and foundations
  part: 3                   # 1-based place in the course
  url: https://academy.claude.com/courses/...   # the course's link; adding it again adds only missing lessons
prequestions:               # AI-written, 2–4, broad; never regenerated once attempted
  - q: ...
    before: no idea         # optional: Tyler's attempt before reading (D18), unscored
    after: ...              # optional: his closed-book answer at finish
recall:                     # optional: finish step (D18)
  text: ...                 # free recall; a new text replaces it and drops feedback
  at: 2026-10-21T...
  feedback:                 # AI, after the attempt; never a score
    feedback: ...           # on the recall (or the after-answers as a whole)
    questions: [{ n: 1, feedback: ... }]   # per answered prequestion, n 1-based
    missed: [...]           # 0–3 central ideas he did not recall
    section_lines: ...      # one line on whether his section lines (D32) state main ideas in his own words; null when he wrote none
    ai: { vendor, model, prompt_version }
chapter_recalls:            # optional: EPUB closed-book recall per chapter (D18); n = the `<!-- chapter N -->` marker that starts it
  - n: 3
    text: ...               # a new text replaces it and drops feedback
    at: 2026-10-22T...
    feedback: { feedback, missed: [...], section_lines, ai }   # AI, after the attempt; that chapter only (section lines whose heading is in it)
notes_drafted: ...          # sha256 of notes.md text the last enrich drafted from; a different non-empty notes.md is pending
enriched_at: ...            # absent until AI enrichment ran
```
Body: Markdown. For YouTube, paragraphs carry `[mm:ss]` markers at the start. For PDFs, `<!-- page N -->` comments between pages. For EPUBs, `<!-- chapter N -->` comments between spine documents.

### annotations.jsonl (W3C-style)
```json
{"id":"01J...","rev":1,"item":"01J...","ts":"...","intent":"keep|card|question|apply",
 "exact":"selected text","prefix":"32 chars before","suffix":"32 chars after","start":1234,"end":1300,
 "note":"optional one line","status":"open|done|deleted"}
```
`deleted` hides a highlight: omitted from `ore show --annotations`, search, anchor checks and drafting. Cards already drafted from it stay.
Anchoring: TextQuoteSelector (exact, prefix, suffix) + TextPositionSelector (start, end) over the doc body. Re-anchor by position first, then exact match, then fuzzy (approx string match) when `text_sha256` changed.

### cards/<id>.md
```yaml
id: 01J...
kind: card | prompt
item: 01J...                 # source item
annotation: 01J...           # source highlight (absent for items drafted from the source note or a prequestion)
from: notes | prequestion    # optional: drafted from the source note, credited "from your notes", or from a prequestion after the finish (D19)
prequestion: 2               # with from: prequestion, its number (1-based)
skills: [ai]
topics: [slug]
content_type: definition | concept | procedure | fact   # drives interleaving (D24)
state: draft | live | retired
created: ...
```
Body for `card`: question, a line `---`, answer. Cloze allowed with `{{c1::text}}`.
Body for `prompt`: question, `---`, model answer, then `## Rubric` with 2–4 bullets (prefixes `Optionally…` and `Avoids…` allowed).

### reviews/<yyyy>-<mm>.jsonl
```json
{"ts":"...","card":"01J...","session":"01J...","confidence":1|2|3,"answer":"what I typed","ai_rating":3,
 "rating":1|2|3|4,"elapsed_ms":12000,"state_before":{...fsrs},"state_after":{...fsrs},"finishing":true}
```
Each device appends to its own file (`<device>` is `ORE_DEVICE` or the computer's name, slugified; `iphone` on the phone); readers take every file of the month, including older files with no device part and a synced folder's conflicted copies, and count a review (card + ts) once. Taking a review back appends `{"ts":"...","card":"01J...","undo":"<ts of the review>"}` instead of rewriting the log. `finishing: true` marks the first encounter of a draft (D20); the card file keeps `state: draft`, and a draft with a review counts as live (the index and `ore cards` read it from the log), so finishing never rewrites the card. `variant: <id>` marks a review of a remixed version (D66); `in_head: true` an Explain card answered in his head and self-marked (D68). Card FSRS state is derived by replaying the log in order; `.index` caches it.

### cards/<id>.variants.jsonl (D66)
```json
{"id":"01J...","rev":1,"card":"01J...","type":"new-case|predict|diagnose|choose|name-it","setting":"planning a YouTube explainer",
 "question":"...","answer":"...","rubric":["..."],"maps":[0,1],"status":"ready|rejected","reason":"why rejected",
 "created":"...","ai":{...},"check_ai":{...}}
```
`maps[i]` is the original key point (its answer, for a card with no rubric) that `rubric[i]` tests. Uses are counted from the review log.

## 3. Scheduling
- ts-fsrs, FSRS-6 defaults. Desired retention per card = max over its skills' priority (P1 0.92, P2 0.88, P3 0.80; D65).
- Due queue: all cards with `due <= now` plus drafts never seen. Drafts take every fifth place while due cards last (D144). Order of the due cards: interleave topics round-robin; within a topic, sort by `priority_weight × (1 − retrievability)`; place `concept` items that share a topic adjacent; keep `definition` items from one source together. A draft first comes up the day after it was written; new drafts enter only while the daily goal has room after the due cards, up to `review.new_per_day` (D65).
- A rating of 1 schedules one relearn pass later in the same session, or the next one that day if the session ends first (the goal closing, D65).
- Remixing (D66) changes how a card is asked, never when: one FSRS state per card. Variants start after two Good or Easy reviews of the original since the last miss and rotate variant, variant, original; a miss returns to the original; each variant is shown at most twice, never twice in a row.
- Never compress intervals to catch up. Never alter stability/difficulty for priority.
- Optimizer: `ore optimize` runs the ts-fsrs binding over the review log when ≥1,000 reviews exist; writes `skills.yaml`-adjacent `fsrs-params.json`; the daily catch-up runs it when the last fit is a month old (D95).

## 4. CLI `ore` (v0)
All commands accept `--json`. Exit non-zero with a one-line error on failure. Never hand-edit JSONL from the UI; go through core.

```
ore init [path]                       create library skeleton, AGENTS.md, skills.yaml, git init
ore add <url|path> | --stdin | --tab [--skill s] [--type t] [--for <q>] [--no-enrich]   ingest → items/, status inbox → {id, title, type, path, enrich: started|skipped}; --stdin pasted text as Markdown, --tab the frontmost Safari or Chrome page (D96), --for links it to a question (D75); triggers `enrich` in background unless --no-enrich
ore snippet --text|--stdin [--url] [--app] [--intent] [--note] [--skill s] [--no-enrich]   capture a selection as a snippet item + annotation
ore ls [--status] [--skill] [--topic] [--archived]   items (archived ones only with --archived); JSON adds dir and source_file (absolute; the original kept at capture, if any), thumbnail (absolute; thumbnail.* beside doc.md, D77) and has_notes (the source note has text)
ore backfill [item]   fill in missing thumbnails and PDF authors on sources added before D77 (all sources without an item)
ore show <item>                       frontmatter + body (or --annotations); JSON adds path, body, annotations (with anchor status), prequestions ([] when none), enrich_error (why background enrich failed, while never enriched), dir and source_file like ls, and for YouTube `transcript: {video, words: [[seconds, word]…]}` from source.vtt (D49), and for kept audio `audio: {file, words}` (D167)
ore highlight <item> --exact "<text>" --intent keep|card|question|apply [--note] [--start N]
ore highlight <item> --at N --note "<his line>" [--intent card|question]   # Card here (D99): a line anchored at the sentence around offset N
ore annotate <annotation> --note|--intent|--status open|done|deleted   appends a new rev
ore scope <item> [--reached N] [--leave-out "text"]   a partway finish (D100): leaves out prequestions answered only past body offset N, and (AI) those his note rules out
ore questions [--skill s | --item i]  his questions (D47, D75), open first → [{...annotation, item_title, answers, matches, here?}]; status done = answered
ore answer <q> [--text t [--item i] [--quote q]] [--done|--card] [--remove ts]   add to his answer; --card also drafts a card in the background (D75)
ore tries [--skill s]   techniques he plans to try (Apply highlights, D127), to try first → [{...annotation, item_title}]; note = his plan, reflection = how it went, uses = earlier rounds (D148)
ore tried <t> [--text "how it went"] [--next "plan"] [--undo]   check a try off; --text also drafts one Explain card in the background (D127); --next keeps the round in `uses` and opens the try again with that plan (D148); --undo steps back
ore match <source> <q> [--drop]       a source that may answer a question, or "not answered here" (D75)
ore prequestion <item> <n> --before "<text>" | --after "<text>" [--confidence 1-3]   record a prequestion attempt (n 1-based; confidence only with --after) → {item, n, q, before?, after?, confidence?}
ore notes <item>                      Source note → {item, text, path, dir} (text "" when absent; path relative to the library; dir its folder, absolute)
ore notes --skill <s> [...]           the same for a skill note (D41) → {skill, text, path, dir}; every option below works on it too
ore notes <item> --attach <image>     copy an image into images/ beside the note (unique slug name) → {..., attached: "images/<name>"}; text unchanged
ore notes <item> --set "<text>" [--base "<text>"]   replace notes.md as given ("" empties it, file kept) → same shape + merged; with --base (the text the edit started from), a file changed since is merged line by line instead of overwritten (both versions kept where they collide, his first)
ore notes <item> --append "<text>" --heading "<h>"   append rule below → same shape
ore diagram <item> <name> [--set]    diagrams/<name>.excalidraw → {item, name, path, scene} (scene null when absent); --set reads an Excalidraw scene from stdin (checked, atomic); --rename <new> renames the file (the note's link is the caller's to change); `--skill <s> <name>` does the same beside a skill note
ore diagram <item> --new             first free name `diagram-N` (no file, no link in notes.md); writes nothing
ore status <item> inbox|reading|done [--at <iso>]   set reading status; done records finished_at (orders unseen drafts, freshest source first); --at puts back the one it had (Undo of a move out of Done)
ore archive <item> [--undo]           sets archived_at: hidden from lists, questions and search; files kept, its cards keep reviewing
ore reimport <item> [--undo]          fetches a linked source's original again and updates it in place (D93); --undo puts the old version back, again redoes
ore tables <item> | --install | --remove | --status   reads a PDF's tables and display formulas with Docling into its text, highlights kept (D125); `ore show` gives `tables: reading|read` or `tables_error`; --install downloads Docling (about 2 GB, optional), --remove deletes it
ore cut <item> --from N --to M [--section]   removes junk from a source's text (D111): the blocks the body offsets touch, or the section under the heading at N; highlights after it shift exactly, ones inside it go (cards and questions stay); `--undo <cut-id>` puts it back, `--redo <cut-id>` takes it out again. Not inside a video transcript
ore pin <item> [--undo]               sets pinned_at: listed first, in the order pinned, in every source list it is in
ore add <url> --course [--skill s]     a Claude Academy course (or lesson) or YouTube playlist: one source per lesson, in order (D79); again: only missing lessons, and page text for lessons added as bare videos (D92)
ore course preview <url> | set <course> [--title t] [--skills a,b] | archive <course> [--undo] | lessons <course>
ore feed [--refresh] | find <url> | follow <url> [--skill s] | unfollow <feed> | arrange '["<feed url>",…]' | set <feed> [--name n] [--skill s] | read|unread <post url>… | open <post url> | close <item>   the Feed (D107): posts of the last 14 days; open reads a post as a preview (`preview` set, never listed), close keeps it only if it has a highlight or a source note, else deletes it
ore edit <item> [--title t] [--author a] [--skills a,b]   rename a source, set its author ("" clears it), or file it under exactly these skills ("" for none); its cards follow, its topics gain new ones
ore skills                            list skills (id, name, priority, hook, goal, icon, color, collection)
ore skills set <skill> [--name n] [--icon mc:name] [--color gray|red|orange|yellow|green|teal|blue|purple|pink] [--collection c] [--hook "why"] [--goal "what I could show"]   --name renames it (the ID stays, so links hold); "" clears any other field; hook is his one line on why (≤140 chars, D63), goal what he could show he can do (≤140 chars, D102); edits skills.yaml in place, keeping comments
ore skills add <name> [--collection c]   new skill at P2 (the sidebar's + on a section header); refuses a name that matches an existing skill
ore skills arrange '<layout json>'   the sidebar in one write: [{"collection":"Work","skills":["ai",...]},{"collection":"","skills":[...]}], every skill exactly once; sorts skills.yaml into that order (a collection sits where its first skill is) and sets or clears each collection. Drag, Move to, renaming, reordering or deleting a collection, and their Undo all use it
ore skills rm <skill> [--archive]      delete a skill: drops it from skills.yaml and untags its sources, cards and topics (cards keep reviewing, the skill note stays on disk); --archive also archives sources filed only under it
ore suggested-skill <item> accept|dismiss|undo <json>   accept creates the suggested skill (P2) if new and files the item, its cards and topics under it; undo takes back an accept (its `undo` record) or a dismiss
ore enrich [item...|--all-pending]    runs AI (several items one after another): prequestions, skills, topics, card/prompt drafts from Card highlights, changed the source note and, once the item is done, its prequestions
ore research <question>               AI finds 3–5 sources for one of his questions and prints them; writes nothing (D95); `ore add <url> --for <q>` any
ore explain <item> --exact "<term>" [--start N]   AI explains a term in its paragraph and in general (Explain, D97); writes nothing
ore catch-up                          the daily catch-up (D95): enrich pending sources (not ones added in the last hour), refit FSRS when a month old with ≥1,000 reviews; `ore today`, `session start` and `remind` start it in the background at most once in 20 hours
ore key-points <item>                 AI: 2–4 key points per prequestion with the passages that support them (D56); skips prequestions that have them
ore check <item> <n> [--covered 1,0,1]   AI marks which key points his closed-book answer covers (D56); --covered stores his own marks instead
ore cards [--state] [--item] [--skill]
ore card show|edit|set|retire|restore <id> [--review] [--variant v] [--question] [--answer] [--point]... [--state draft|live]   set replaces the question, answer or key points (--point per point, in order: an Explain card's whole rubric, one line each, at least one), meta kept (D59), or the variant's with --variant (its points one for one); restore undoes a retire; show --review returns the version to review now: a variant in its turn, as kind prompt with its question, answer and rubric plus `variant` and `original` (D66); for the original, `in_head_ok` (D68)
ore due [--limit N] [--skill s]...    ordered queue as above; unseen drafts written before today take every fifth place while due cards last, up to `review.new_per_day` a day (D60, D65, D144), freshest source first; --skill keeps cards of those skills (D58)
ore review <card> --rating 1-4 --confidence 1-3 [--answer] [--ai-rating] [--elapsed-ms] [--finishing] [--session id] [--variant v] [--in-head]   → {card, ts, rating, due_next, state_after, finishing, session?}; then writes variants ahead in the background when the card needs them (D66)
ore review <card> --undo <ts>         takes back the card's latest review (ts from its output) by appending an undo line
ore remix [<card>...] [--pending]     write variants ahead (D66): two ready per remixable card; also run in the background at session start
ore variant reject|restore <card> <variant> [--reason]   B in review drops a variant, the reason kept for the writer; restore is its Undo
ore grade <card> --answer "<text>" [--variant v]   AI grades against rubric (the variant's with --variant) → proposed rating, gaps, feedback, covered (one per rubric point) (does not log)
ore ask <card> --message "<text>" [--answer "<his>"] [--session id] [--variant v]   Ask about this (D61): one chat turn on his plan → reply, proposal (a better card or null; apply with card set), session (pass back to continue)
ore ask-library "<question>" [--earlier <json>]   Ask your library: retrieves passages through the FTS5 index (no embeddings), the AI answers only from them → {found, answer with [n] markers, citations[{n, item, title, heading, quote, start, end}]}; found false says the library doesn't cover it (no AI call when no source has the words)
ore tutor "<message>" [--item <source>] [--source <source>]… [--skill <skill>]… [--earlier <json>] [--stream <id>]   The tutor (D128): one chat turn over the open source's and the @-mentioned sources' passages first, then the library's (only the @-mentioned skills' sources when any), then the library's → {reply with [n] markers, citations[{n, item, title, heading, quote, start, end} or, from a web search when his sources don't hold it (D137), {n, url, title, site, quote}], general, searched}; general true marks a reply from the AI's own knowledge, hint true a reply that holds back the answer (the app offers Show me), card a card worth keeping or null; practice gets hints, not answers; --stream <id> writes {"progress": {stream: id, reply}} lines on stderr as the reply is written, and {stream: id, searching: true} when a web search starts (D138; claude only)
ore tutor-card <source> --card <json> --ai <json>   keep the card a tutor reply proposed: a draft (from: tutor) on that source, with its skills, first topic and the reply's ai stamp
ore recall <item> --text "<text>"     store free recall (clears old feedback), append to the source note under "Recall" → {item, recall: {text, at}, notes}
ore recall <item> --feedback          AI feedback on recall + after-answers + section lines, stored in recall.feedback → {item, feedback, questions: [{n, feedback}], missed, section_lines}
ore recall <item> --chapter N --text "<text>" [--heading "<title>"]   upsert chapter_recalls[N] (drops its feedback), append to the source note under "Chapter N recall" → {item, chapter, recall: {text, at}, notes}
ore recall <item> --chapter N --feedback        AI feedback on that chapter's recall (and its section lines) only, stored in chapter_recalls[N].feedback → {item, chapter, feedback, missed, section_lines}
ore stats [--skill]                   with --skill adds strength {solid, growing, new, win_back, peak, level, next_level_at, explain[{id, question}]} (D63) and growth: solid memories at each of the last 12 week ends (D62); per-skill and total: items read, items live, reviews, retention (Anki-adapted), retention_own_words / retention_no_note (+ _n), session starts; JSON without --skill adds remix {variant, original: {reviews, pass_rate}} for watching variant drift (D66) and calibration {sure_n, sure_right} (D69)
ore session start|end                 writes session receipts (habit metric); the end receipt adds kept, rescued (passed with recall chance under 85%), cut (the first skill of each card that became a solid memory this session, D90) and caught_up when nothing was left (D60, D62); on the week's first end with reviews, the output adds calibration {sure_n, sure_right} once 20 Sure answers exist (D69)
ore today                             Home (D58, D60): the review settings (goal_minutes, weekdays_only, new_per_day, remix, plan, reminder (D67)), counts (today counts toward the goal), active_ms (elapsed per review, capped at 3 min), goal_ms, met, caught_up, due, new_today, new_waiting (drafts held back by the daily limit), estimate_ms, slice_ms (today's slice, D65), week [{date, status met|open|off, active_ms}], days_met, skills [{skill, due, solid, growing, ready, ready_today, new, win_back, peak, level, next_level_at}] (level from peak, D63)
ore goal [--minutes N] [--weekdays-only true|false] [--new-per-day N] [--remix true|false] [--plan "<cue>"] [--reminder HH:MM|off]   daily review settings, `review:` in skills.yaml
ore remind                            the day's one reminder (D67) → {notify, title, body}; notify only when a reminder is set, today counts, the goal is unmet and cards wait. Run by the app's LaunchAgent, which starts the app binary with `--remind` to call it and post the notification
ore settings [--ai claude|codex] [--model m]   the app's Settings (⌘,): library folder, AI vendor (`ai:` in skills.yaml; ORE_AI overrides), its model (`models:`, D116; ORE_AI_MODEL overrides), daily review
ore models [claude|codex]   the models to pick from (D116)
ore backlinks <item> | --skill <s>    lines in other notes that link here (D39) → [{from: {kind, id, title}, heading, line}] (heading: nearest above the link; line: links shown as text)
ore search <query> [--limit N]        FTS over docs, annotations, the source note (kind notes, ref = item id), skill notes (kind skill-notes, ref = skill id), cards, topics
ore reindex                           rebuild .index from files
ore optimize                          FSRS optimizer when enough reviews
ore doctor [--fix]                    validate files, anchors, orphans, note links that no longer resolve; --fix re-anchors highlights after doc edits
```
Append rule (recall, chapter recall, `notes --append`): if the trimmed text already occurs verbatim in notes.md, nothing changes. Else, if a line `## <heading>` exists, the text goes at the end of that heading's block (before the next `## ` line or EOF) after a blank line; otherwise `## <heading>` and the text go at the end (no leading blank lines in a new file). Chapter recall needs the `<!-- chapter N -->` marker in the body.
Links (D39): a Markdown link whose URL is `ore:item/<id>` or `ore:skill/<id>`, in the source note or a skill note; the text is his, the ID survives renames. A skill link opens that skill's note. AI never adds one (D34.2).
Stats D34.8: "own words" = cards with `from: notes` or whose source annotation (latest rev) has a non-empty note; "no note" = annotation-drafted cards whose annotation has no note; `from: prequestion` items count in neither. Same retention metric, null below 10.

## 5. AI adapter
`core/ai/`: one interface `runAgent(task, inputFiles, schema) → JSON`. Implementations: `claude` (`claude -p --output-format json` with a system prompt and the file paths), `codex` (`codex exec --json`). Chosen by `ORE_AI` env or `skills.yaml` setting; default `claude`. The model is per vendor (`models:` in skills.yaml, D116): Sonnet by default for Claude, Codex's own default for Codex; `ORE_AI_MODEL` overrides. Prompts live in `core/ai/prompts/*.md` and are versioned. Every AI write records `ai: {vendor, model, prompt_version}` in frontmatter or the JSONL line. Grading prompt returns `{rating, gaps[], feedback, covered[]}` (covered: one boolean per rubric point, D59). Recall-feedback prompt (`recall-feedback`) reads the doc and returns `{feedback, questions[{n, feedback}], missed[]}`: about Tyler's attempts only, second person, no summary in place of his recall (D9), never a score. It also gets `section_lines` ([{heading, text}]: the source note blocks under `## ` headings other than "Recall", "Chapter N recall", "Use and connections" and the older "Use or dispute") and returns `section_lines`: one sentence on whether they state main ideas (not details) in his own words, or null when there are none (D18, D32). With a `chapter` input (plus `chapter_lines`) it reads only that chapter, gets no prequestions and only the section lines whose heading text appears in that chapter, returns `questions: []`, and `missed` covers that chapter only.

Enrichment prompt rules (from the evidence brief): prequestions are broad and integrative, not trivia. Card drafts: one retrieval target per card; one or two drafts per highlight, two only for a central idea, as a pair (definition card + application prompt) (D34.9); prefer `prompt` for concepts and `card` for terms; 2–4 rubric points; include enough context to stand alone in interleaved review; opinion or contested claims say "According to <author>, …" (D34.9); bias toward drafting (D9) but never from Keep-only highlights with no note.
Source note input: `notes` = full notes.md text when non-empty and its sha256 ≠ `notes_drafted`, else null; `notes_cards` = questions of this item's `from: notes` cards. The model drafts from ideas in his notes worth retrieving (his explanations, applications, metaphors), skipping restated highlights; those drafts carry `annotation: null, from_notes: true` and are written with `from: notes`. Model answers stay faithful to the document and may correct his notes, never quoting his errors as true. After writing drafts, `notes_drafted` = sha256 of the notes text sent.
Prequestion input (D19): `prequestions_to_draft` = [{n, q}] for an item with status `done`, one per prequestion with no `from: prequestion` card yet (never before the finish, while they are still being answered); `missed` = `recall.feedback.missed` (or []). The model returns exactly one `prompt` draft per entry (`prequestion: n`, `annotation: null`, `from_notes: false`): the prequestion made standalone for interleaved review, a model answer faithful to the document, 2–4 rubric points from the document including a missed idea that belongs to that question. Written with `from: prequestion` and `prequestion: n`.

## 6. Ingestion (deterministic)
The core promise (D122): every type people learn from comes in whole, as the same `doc.md` (own title and outline, images, tables, math, code, timestamps), or is refused with the next step.
Coverage per content type, what each keeps and misses, and the plan (D96): `docs/reviews/2026-10-28-import-coverage.md`. Every type has a saved example in `packages/core/test/fixtures/intake/` checked by `test/intake.test.ts`; `bun run intake:live` re-adds real links of each type.
- Routing (`ingest/index.ts`): by link shape first (YouTube, other video sites, links refused with a reason), then rewrites (`links.ts`), then the server's content type and the file name. Audio, video and feeds are refused before their body is read; nothing over 200 MB is read.
- Check (`check.ts`): a page that is a bot check, a login wall or under 50 words is refused with what to do next, never saved. An author that isn't a name and a date that isn't one real date are left blank.
- Web: Defuddle (Markdown) → fallback @mozilla/readability, both on linkedom. Store original HTML as `source.html`. A page that embeds one YouTube video keeps its transcript too (D92). Before extraction, embedded YouTube, Vimeo and Loom players become a "Video: <title>" link where they stood, and merged table cells are spread out (a cell spanning rows repeats in each). Tables an extractor kept as HTML become GFM tables; inline TeX becomes `$$…$$` by Pandoc's rule (no space inside the `$`, no digit after the closing one), so prices stay text.
- Images (`assets.ts`): every remote image an article or Markdown source shows is downloaded (6 at a time, 15 s each, image types only) and saved as `assets/<sha256 prefix>.<ext>`; one that fails, is under 100 bytes (a tracking pixel), over 5 MB, or past 80 images or 60 MB a source keeps its web link. Re-import saves them again.
- Rewrites: a GitHub repo → its README (the API names it; raw README guesses when the API is refused), relative links and images pointed at the repo; a GitHub or nbviewer file → its raw file; a shared Google Doc or Slides deck → its .docx or .pptx export (one that isn't shared, answered with a sign-in page or an error, says to share it as Anyone with the link); an arXiv abstract → its full HTML version, else the PDF.
- PDF: pdfjs-dist text with page markers; lines set clearly larger than the body text and followed by body text become `##`/`###` headings (rotated text never does); a metadata title that is a number or a file name loses to page 1's largest line. Its figures (D122, `pdf-figures.ts`): the pictures each page draws, pictures that touch joined into one, drawn into a PNG (at most 1,400 px wide) and placed after that page's text; icons under 40 pt, a page's own scan behind its text, and a picture on three or more pages (a logo) are left out, at most 80 a PDF. Figures drawn as vector paths (most charts in papers) aren't pictures and aren't kept yet. `source.pdf` kept. A PDF with no text layer (scanned pages) is read with text recognition (below).
- EPUB: fflate unzip → `container.xml` → OPF spine; each XHTML document → Markdown via turndown (no article heuristics), its images saved as assets (an SVG-wrapped plate too), documents with no text (a cover) skipped, `<!-- chapter N -->` markers; title/author from `dc:title`/`dc:creator`. A file that won't unzip (EPUB, Word, PowerPoint) says it is damaged and to download it again. `source.epub` kept.
- Word (.docx): mammoth → HTML → turndown with GFM tables; embedded images saved as assets. Title and author from `docProps/core.xml` (a tool's default name, "python-docx", is no author). `source.docx` kept.
- PowerPoint (.pptx): slides in the presentation's order, each `<!-- slide N -->`, `## <title>`, its text as nested bullets, its pictures after the text (saved as assets; one on three or more slides is a logo and left out, Windows metafiles skipped) and `> **Speaker notes:** …`. `source.pptx` kept.
- Notebook (.ipynb): Markdown cells as text, code cells fenced in the notebook's language, text output (cut at 2,000 characters) fenced as `text`, and plots (PNG, JPEG, SVG output) saved as assets in place of their `<Figure …>` text.
- Subtitles (.srt, .vtt): a transcript source like a video's, `[mm:ss]` paragraphs.
- YouTube: `yt-dlp` subs (VTT) → de-duplicated paragraphs with `[mm:ss]`, chapters as `###` headings (a paragraph never spans one), then the description under "## From the description". Captions are English first, then the video's own language; a video with none is heard (D122): yt-dlp downloads its sound (an m4a, else the mp4) and the Mac transcribes it in the video's language. A video a page only embeds is never downloaded to be heard; a course lesson's video is. Runs on the Mac (home IP). The VTT is kept as `source.vtt`; the reader's player (D48–D50) reads word times from it, inline for auto-captions, spread over each cue otherwise.
- Other video sites yt-dlp reads (Vimeo, TED, Loom, Dailymotion): the same transcript as an `article` source played on its own site; a caption track served as an HLS playlist (TED) is fetched segment by segment.
- Audio (`audio.ts`, `swift/transcribe.swift`): audio files (mp3, m4a, wav, aac, aiff, flac), audio links and podcast episode links (Apple Podcasts through Apple's lookup API; Spotify through the same episode in the show's public feed, found by Apple's podcast search and matched by title or, failing that, the one episode of its day, D122; other players through the audio their page links) are transcribed with Apple's on-device SpeechAnalyzer (macOS 26+) into a timed transcript like a subtitle file's; so are video files (mp4, mov, m4v: lecture recordings, Zoom, downloaded courses), whose sound the helper exports to an m4a first, read where they lie with no size limit (D122). An audio file or episode is kept whole as `source.<ext>` with its transcript as `transcript.vtt`, and plays in place (D167); a video file keeps only `source.vtt`. Progress goes to stderr as `{progress}` lines (the app's add bar). Older macOS and a show only on Spotify (locked audio, no public feed) say what to do instead. `ORE_TRANSCRIBE` names a stand-in helper for tests. Every download stops at 200 MB.
- Refused with a reason: YouTube playlists added as a plain link (offered as a course, D79), links straight to a video file (add the page it plays on, or download it and add the file), feeds. X posts and pages that need a sign-in are refused by link with the browser tab as the next step.
- From the browser (`tab.ts`, `ore add --tab`, the add box's Browser tab button, ⌘K): the page in the frontmost Safari or Chromium window, read through AppleScript (JXA) as he sees it signed in. Its rendered HTML when the browser allows JavaScript from Apple Events, else Safari's page source and visible text; a page whose HTML holds no article comes in as its visible text. A video, PDF or other link Ore reads better by fetching is added by its link. A tab still on a sign-in says to sign in there.
- Text recognition (`ocr.ts`, `swift/ocr.swift`): scanned PDFs and images (png, jpg, heic, tiff, webp, gif) read with Apple's Vision framework through a Swift helper compiled with `swiftc` on first use (cached in `~/Library/Caches/ore/helpers/` by source hash); lines join into paragraphs, larger short lines become `##` headings. An image keeps itself above its text as an asset. Mac only; `ORE_OCR` names a stand-in helper for tests.
- Markdown/text: read as is. Snippets: body = selection.
- Inbox watcher: dropped (D95).

### Implementation notes (v0, 2026-10-10)
- FSRS-6 defaults with learning/relearning steps empty and fuzz off, so replay is deterministic; the single relearn pass (D21) comes from the queue (owed by a card's only review today being a miss), not from FSRS minute steps.
- Retention metric: rating 2 counts as a fail; "early" means reviewed on a calendar day before the due day; null below 10 qualifying reviews.
- Web extraction runs Defuddle on linkedom (jsdom's selector engine rejected Defuddle's selectors); Readability fallback on the same DOM.
- `ore highlight` retries matching with whitespace and Markdown emphasis ignored, so text copied from a rendered page matches the Markdown body.
- `ore enrich` on an already-enriched item only drafts from new Card highlights, changed the source note and undrafted prequestions of a finished item; it does not regenerate prequestions, skills, or topics. `--all-pending` (what the daily catch-up enriches, D95) includes items whose notes changed and finished items with undrafted prequestions.
- Default AI vendor is set per library in `skills.yaml` (`ai: claude|codex`); `ORE_AI` overrides. Tyler's library is on `codex` until the `claude` CLI is logged in.

## 7. v0 deliverables
1. Bun workspace: `packages/core`, `packages/cli`, `apps/raycast` (later `apps/desktop`). Tests for anchoring, scheduling order, review replay, frontmatter round-trips.
2. `ore` CLI as in §4, installed on PATH via `bun link`.
3. Library `AGENTS.md` describing the layout and the rule "use `ore` for writes that have invariants".
4. Claude Code skill `/ore` (in `skills/ore/SKILL.md`, installed to `~/.claude/skills/ore`): quiz me from `ore due`; probe only → confidence → my answer → `ore grade` → reveal + gaps → I confirm rating → `ore review`. Also `ore add` on request, and "fix this card" by editing the card file.
5. (Removed by D104; rebuild later.) Raycast extension `apps/raycast`: commands Capture as Keep, Capture as Card and Capture as Question (the selection, optional note; Research removed by D91), Add Link (frontmost browser URL or clipboard), Review Due (opens the skill flow instruction or shows the queue). Reuse patterns from `~/Desktop/projects/raycast-personal/extensions/webpage-to-markdown` and `fetch-youtube-transcript`.

## 8. v1 (Tauri app) outline
First build (D29): `apps/desktop`. Sources list (To read, Done, filter by skill; D28), add source, reader with highlights (1–3 types, notes), prequestion attempts, finish step (closed-book re-ask + free recall + AI feedback). Calls `ore … --json` (D30). Full outline:
Window: To read / Done tabs over the sources list, sidebar (skills; Library, Review), command palette (⌘K), reader (D27), review screen (D21), capture panel on global hotkey (URL / clipboard / selection via Swift Accessibility helper / drop). Stats per skill. Dark default, optional light reading surface. Details specified when v0 has been used for real.

Reader rendering: react-markdown with GFM; raw HTML never renders. Images in `assets/` load from the source's folder through the asset protocol; `$$…$$` renders with KaTeX (remark-math, rehype-katex, HTML output) and stays out of the highlight skeleton and read-aloud, so a highlight across a formula still anchors (D96).

Active note-taking (2026-10-22, D15, D18, D31–D34), all through the CLI:
- Highlight note placeholder (D94): highlight "Note…" (D126), key point "This works because…", Question "My question… my guess:". Never prefilled. Older `research` highlights read as `question` (D91).
- Source note as the right pane of a split screen (D44): the divider drags (280 px to 60% of the window, double-click resets, width kept in localStorage); editable whenever the source is open, autosaves with `ore notes <item> --set`. With it closed, a top-right button reads "+ Note" (empty) or "Note •" (has text).
- Position bar and floating outline (D45): a 2 px bar under the title bar for scroll position; H1 to H3 of the rendered text as short lines at the right edge (deepest level dropped while there are more than 40), the current one brighter, hover lists the titles, click jumps. Both hidden during recalls.
- Skill page (D46, D72), opened from the sidebar skill (an "All sources" row above the skills goes back to the full list): strength in the header (`ore stats --skill`, as gems, D90), the skill note (D41; an empty one offers the closed-book recall, which hides the page), questions (D47, D75: `ore questions --skill`; Answer writes with `ore answer`; Begin research runs `ore research <annotation>` and each source adds with `ore add <url> --skill <s> --for <q>`; Mark answered and Reopen set the annotation status; the quote opens the source scrolled to the passage), To try (D127: `ore tries --skill`, shown once he has one; the check box runs `ore tried`, then "How did it go?" saves with `ore tried --text`; its "Next time I'll…" line saves with `--next` and the try goes back to To try with that plan, D148; Used lists each idea tried with every round), then the skill's sources (the list title is the To read / Done / Archived view menu, D74) with a dot on sources that have a source note.
- Note editor (D38, `apps/desktop/src/editor/`): Milkdown over the Markdown file; `/` menu (text, headings 1–3, lists, to-do, quote, callout, toggle, code, divider, image, link); `[[` picks a source or skill and inserts a link (D39); a click on a link opens it. Saving keeps every block he did not edit byte for byte (`preserve.ts`). Other raw HTML shows as literal text, never rendered. Images load through Tauri's asset protocol, scoped to the library at startup.
- "Linked from" (D39) under the source note and skill notes: `ore backlinks`, each row opens the linking note.
- Skill notes (D41): edited in place on the skill page (D46); an empty one offers "Warm up from memory". An empty note opens on "What do you know about <skill>, across what you've read?" with sources and notes hidden; ⌘↵ saves it under "Recall" (`ore notes --skill <s> --append --heading Recall`), Esc skips. Enrich does not draft from skill notes or links yet ("from your notes" / "from your links" items, D39, D41).
- Section lines (D32): removed from the reader 2026-11-03; `## ` blocks he writes in the source note still count as section lines for the feedback.
- EPUB chapter recall at each chapter end (D115): a sign opens the source note with the chapter title and three placeholder prompts, the source hidden; ⌘↵ runs `ore recall <item> --chapter N --text "<what he wrote>" --heading "<title>"`, then `--feedback`. The book end keeps the full finish.
- Finish step: after the free recall (D18), one optional line "Where would you use this, and what does it connect to?" saved with `ore notes <item> --append "<t>" --heading "Use and connections"`. Enrich starts after the feedback, so the prequestion prompts (D19) can use what he missed. The finish and chapter feedback show `section_lines` as one quiet line under the main feedback when it is non-null.
- D34: no notes archive or review screen; nothing from AI before his attempt; the finish step and chapter recalls hide the text, highlights, notes and the source note; no AI text in note fields or the source note.

Maps (D35, deferred by D95; `docs/research/brief-diagramming.md`), all through the CLI:
- Editor: the app's own diagram editor (D103, `apps/desktop/src/draw/`), in Excalidraw's file format, in the reader's place during a recall and beside it afterwards.
- Finish and chapter recalls offer "Type it" or "Map it"; one recall, one format. Saving runs `ore map <item> --set` (stdin, schema-checked, atomic); the app never writes the file itself (D30).
- A shape that points at a library object stores `customData.ore` = `item:<id>`, `highlight:<id>`, `card:<id>`, `prequestion:<item>#<n>` or `notes:<item>` plus `{heading, quote}` (TextQuote over notes.md, resolved with `anchor()`; never ID markers in notes.md). `ore resolve <ref…>` returns them in one call; `ore doctor` reports refs that no longer resolve.
- Search: a `map` FTS kind whose body is the map's text elements and arrow labels.
- AI after the attempt: reads the map's text, arrows and bindings plus a PNG export; returns feedback and its own map (as `A -label-> B` lines, laid out read-only beside his by the editor's typed-map layout, D103), never edits his file. Enrich drafts `prompt` items from drawn relationships with `from: map`.
- Before building: a spike of Excalidraw inside the Tauri webview (untested); read the full texts flagged in `brief-diagramming-evidence.md`.

## 9. v2+ parking lot
System-wide capture with screenshot + OCR (D16). EPUB layout view (foliate-js; EPUB text is v1, D13). X threads. Newsletters, audio (SpeechAnalyzer). Browser extension. MCP wrapper over the CLI. n-of-1 experiments: AI-drafted vs self-made cards, prompt vs card retention, importance weighting.
