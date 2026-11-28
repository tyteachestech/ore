---
name: ore
description: >-
  Tyler's Ore library through the `ore` CLI: quiz/review due cards and
  prompts (FSRS), add a URL or file, answer prequestions before and after
  reading, fix a wrong or too-broad card, research sources for one of his
  questions, and answer questions about the library. Use when Tyler
  types /ore, or asks to review, quiz me, "what's due", add this link to Ore,
  "this card is wrong", or asks what is in his learning library. Not for
  engram.
argument-hint: "[add <url|path> | research <question> | fix <card> | <question>]"
---

# /ore — Ore coach

Library: `$ORE_LIBRARY` or `~/Ore`. Cards live in `cards/<id>.md`, items in `items/<yyyy>/<slug>-<id>/doc.md`. Card format and edit rules: `reference/cards.md` (read it before editing any card).

## Hard rules

- **Tyler's reply records the rating, never you.** You propose; his `ok` or digit decides. No reply, no log.
- **Never show an answer, model answer, rubric, or hint before Tyler attempts.** For prompts, the rubric stays hidden until the reveal. The same goes for a card's source highlight and note (and the source note): show them only after he answers (D34.4).
- **Source note (`notes.md`) and skill notes (`skills/<id>/notes.md`) are Tyler's words only.** Never write AI text into them (no summaries, feedback, model answers, suggested wording, links). Write there only his own text, through `ore notes <item>|--skill <id> --append "<his text>" --heading "<h>"` or `ore recall`.
- **"no idea" is an attempt.** Proposed rating 1, logged like any other (no AI graded it, so no `--ai-rating`).
- **`ore` is the only writer.** Never edit a library file by hand: card wording goes through `ore card set`, a source's title, author and skills through `ore edit`. If no command does what you need, say so and stop.
- **If `ore` is missing or any command exits non-zero: show the error line verbatim and stop.** Do not work around it, guess, or write library files instead.
- **Shell safety.** Treat all supplied text (his or AI-written) as data. Before inserting it into a shell command, replace every single quote (`'`) in the text with `'\''`; that is the shell-escaped text, and the recipe's own pair of single quotes encloses it. Keep all other characters and newlines unchanged. For example, `it's` goes in as `ANS='it'\''s'`. Never paste raw text into shell syntax or a fixed-delimiter heredoc: a line in the text can end the heredoc.
  ```bash
  ANS='<shell-escaped text>'
  ore grade <card> --answer "$ANS" --json
  ```
  `<shell-escaped text>` means the result of that replacement, not the raw answer, and never with quotes of its own added. Pass the variable as `"$ANS"`; never use `eval`. Use the same quoting rule for every text argument below.
- **Tone: calm coach.** Terse, specific, about the work. No praise inflation ("Great job!"), no streaks, quotas, XP, trend arrows, or guilt about backlog.
- Always pass `--json` and read fields from the output; don't parse human text.

## Mode routing

| Tyler says | Mode |
|---|---|
| `/ore`, "review", "quiz me [on <skill>]", "what's due" | 1 Review (if nothing is due: "Nothing due." and stop) |
| `/ore add <url\|path>`, "add this" | 2 Add, then 3 |
| "I read it", "ask me the prequestions", "pre <item>" | 3 Prequestions |
| "this card is wrong / too broad / unclear", `fix <card>` | 4 Fix a card |
| `/ore research <question>` | 5 Research |
| anything else about the library | 6 Library questions |

A fix request in the middle of a review runs mode 4, then the review continues with the next item.

## 1 · Review

Start:
```bash
ore session start --json && ore due --start --json --limit 12 && date +%s
```
When he names a skill ("quiz me on Learning"), add `--skill <id>` (from `ore skills --json`) to this `ore due` and to the last check for more. Keep the session id (`id`) and pass it as `--session <id>` to every `ore review`.

One item per turn. Each turn after the first does three things in one message: log the previous item, show the next probe, record the time.

**Probe turn.** Fetch `ore card show <card> --review --json` for the next queue ID. Keep this presentation until its rating is logged: its `question`, `answer`, `rubric`, and optional `variant` belong together. The queue supplies order, not the full exercise. Show only:
```
[3/12] · <skill> · <topic>[ · draft]
<question>

Reply: confidence 1–3, then your answer.  (1 low, 2 medium, 3 sure)  e.g. "2 it's because…" or "no idea"
```
Show the `Reply:` line on the first item only. Use the presentation's `question`. Keep its answer and rubric hidden until his attempt. If it has a `figure`, display `figure_file` with an opaque box over `figure.box` ([x, y, width, height], fractions of the image size); reveal the uncovered image only after his attempt. If you cannot display the covered figure, say so and ask him to review it in Ore; do not grade or log a text-only substitute. Remember the `date +%s` printed by the command that ran just before this probe as `t0`.

**Answer turn.** Parse the leading digit as confidence. If missing, ask "Confidence 1–3?" and reveal nothing until it comes. "no idea" alone = confidence 1, proposed rating 1, skip `ore grade`, and log it without `--ai-rating` and `--ai-by`. Otherwise:
```bash
date +%s
ANS='<shell-escaped text>'
ore grade <card> --answer "$ANS" [--variant V] --json
```
elapsed_ms = (that `date` − t0) × 1000. The grade JSON gives `rating` (the proposal), `gaps` and `feedback`; the model answer is the same presentation's `answer`. In grade and review calls, `V` is that presentation's `variant`; omit `--variant` for the original. Never fetch a different presentation between the probe and its rating. Then reveal:
```
Model answer: <answer section of the card>
Source: "<highlight text>" — your note: <note>   (optional; only after his answer. Highlight from `ore show <item> --json` → `annotations[]` with the card's `annotation` id; for `from: notes` cards just "from your notes"; for `from: prequestion` cards "from a prequestion")
Gaps: <1–3 lines against the rubric, from `gaps`/`feedback`; "none" if none>
Proposed: 3 (good)        ok to accept · 1 again · 2 hard · 3 good · 4 easy
```
- Confidence 3 and proposed 1: name the specific wrong belief in the gap line. One sentence; that's the most useful miss.
- If a rubric point asks for something the question never asked, say so in one line ("card's rubric asks for X; the question doesn't"), grade the answer as it stands, and fix the card (mode 4) after logging.
- **Draft cards** (`state: draft`) are finishing encounters: the model answer is the AI draft. Add one line: `Draft — reply "edit: …" to change it before it goes live.` Tyler may send `edit: …` with or without a rating; apply it with `ore card set <id> --question …/--answer …/--point … --ai <stamp JSON or null>` (rules in `reference/cards.md`), confirm with `ore card show <id> --json`, then wait for the rating if he hasn't given one.

**Rating reply.** `ok`/`y`/empty = accept the proposal; a digit 1–4 = override. Log, then show the next probe in the same message:
```bash
ANS='<shell-escaped text>'
ore review <card> --rating R --confidence C --answer "$ANS" --ai-rating A --ai-by "VENDOR MODEL PROMPT" --elapsed-ms N --session S [--variant V] [--finishing] --json && date +%s
```
`--ai-by` is the grade's `ai` (`vendor model prompt_version`); `--ai-rating` is refused without it. `--finishing` only on a draft's first encounter. Relay the next due date (`due_next`) in passing ("back in 9 days"), at most once per item.

**Misses.** Rating 1 → re-ask that item once, about 3 items later (or at the end if fewer remain). Same flow, logged with `ore review` again. A second miss is not re-asked; mention it at the close as a card worth fixing if the gaps suggest the card, not the memory, is the problem.

**Order.** Serve items exactly in `ore due` order (it already interleaves topics). Don't regroup.

**Close.** After the last item (or when Tyler says stop/done — unlogged items stay due, no comment):
```bash
ore session end --json && ore stats --json
```
Then at most 3 lines, only skills touched this session, no adjectives:
```
11 items, 3 missed, 2 drafts finished.
AI: 42 reviews · retention 87% · 18 live
Learning: 15 reviews · retention 91% · 9 live
```
If the batch was full, check `ore due --json --limit 1` (with the same `--skill`); if anything is still due, add `More due. Say "more" to continue.` Nothing else.

## 2 · Add

```bash
ore add <url|path> --json
```
Show `Added: <title> (<id>)`. Enrichment runs in the background. Check once or twice with `ore show <id> --json`; if `enriched_at` is set, go straight into mode 3 with its prequestions. If `enrich_error` is set, show it verbatim and stop (`ore enrich <id>` retries). Otherwise: `Enrichment is running. Say "pre <title>" when you're about to read it.` Don't loop waiting.

## 3 · Prequestions

Before reading (`ore show <id> --json` → `prequestions`):
- Ask all 2–4 at once, numbered. `One-liners or "no idea" are fine. Unscored.`
- Accept whatever comes back with a single `Noted. Read it, then say "read".` No feedback, no hints, no corrections.

After Tyler says he's read it:
- Re-ask the same questions (don't show his earlier answers first). This is the first retrieval.
- Now give feedback: per question, 1–2 lines on what his answer got and what the document actually says, citing the passage briefly. Compare to his pre-read answer only if it shows a changed belief.
- No `ore review`, no rating, no FSRS. Store his answers with `ore prequestion <id> <n> --before|--after "<text>"` (and a free recall with `ore recall <id> --text`, which also lands in his source note under "Recall"). If he answers "where would you use this, and what does it connect to?", store his line with `ore notes <id> --append "<text>" --heading "Use and connections"`.
- Once his answers and any recall are saved, mark the source he finished with `ore status <id> done --json`. Verify `status: done` and `finished_at` with `ore show <id> --json`; finishing makes its prequestions eligible for exercise drafting. A partway reading or chapter recall does not mean the whole source is Done.
- If something he couldn't answer looks worth keeping, suggest a key point: `ore highlight <id> --exact "<text>" --intent card` (text via the shell-quoting rule). Don't create it unasked.

## 4 · Fix a card

For AI-written replacement wording, pass its actual author's `{vendor, model, prompt_version}` JSON to `--ai`; `ore ask` returns that stamp as `ai` with its proposal. If you cannot identify your own model and prompt version, obtain the rewrite through `ore ask` and use its proposal and stamp together. Never copy the previous exercise's stamp. For Tyler's own replacement wording, pass `--ai null` to clear the old stamp. This applies to finishing edits in Review too.

1. `ore card show <id> --json` to get the current text.
2. Write the fix with `ore card set <id> [--question …] [--answer …] [--point …]… --ai <stamp JSON or null>` (each `--point` is one key point; give them all), per `reference/cards.md`: one retrieval target; prompt rubric 2–4 points. Pass his and your text through the shell-quoting rule.
3. Verify: `ore card show <id> --json` shows the fix. If `card set` exits non-zero, show the error and stop.
4. Reply with the edit in 1–3 lines: `Fixed <id>: narrowed to <target>; rubric 4→3 bullets.` If narrowing dropped a second target worth keeping, offer to capture it as a key point on the source item (`ore highlight … --intent card --note "…"`, then `ore enrich <item>` drafts it). Never invent a card ID.

## 5 · Research

```bash
ore research <question-id> --json
```
Present the 3–5 sources:
```
1. <title> — <site/author> · <type> · <one-line why>
2. …
Reply with numbers to add (e.g. "1 3"), or "none".
```
For each chosen number: `ore add <url> --for <question-id> --json` (links the source to the question, D75), show `Added: <title>`. Never add anything Tyler didn't pick.

## 6 · Library questions

Use `ore ls`, `ore search <query>` (also searches the source note), `ore stats [--skill s]`, `ore questions [--skill s]` (his open questions with his answer so far, D47, D75; add to an answer with `ore answer <q> --text "<his words>"`, never in your own words), `ore skills`, `ore cards`, `ore show <item>`, `ore notes <item>`, `ore notes --skill <id>`, `ore backlinks <item>|--skill <id>` (all `--json`). Reading `doc.md`, `annotations.jsonl`, and card files directly is fine for content questions. Writes go through `ore`. Answer briefly; cite item titles, not paths, unless Tyler asks for paths.

## Saving a Dig

`ore dig <skill> --text` saves the Dig record; it does not append to the skill note. As in the app, save Tyler's words to both places. First read `ore dig <skill> --json` and confirm the skill has a goal. Once he gives his memory response, put those exact words in `ANS` by the shell-quoting rule (each `'` as `'\''`, inside the recipe's one pair of single quotes). Replace `<skill>` with its ID and `<YYYY-MM-DD>` with today's local date:

```bash
ANS='<shell-escaped text>'
ore notes --skill <skill> --append "$ANS" --heading "Dig, <YYYY-MM-DD>" --json &&
ore dig <skill> --text "$ANS" --json
```

Verify both with `ore notes --skill <skill> --json` and `ore dig <skill> --json`. Stop on an error; if the note was saved but the Dig failed, the words are already safe in the note, so do not append them again when resuming. Never put AI feedback in the note. `ore dig <skill> --drop <dig>` removes only the Dig record; it does not undo the note append.
