# How note-taking worked in NotionRPG (workflow, not gamification)

Harvested 2026-10-22 for Ore. Extends `~/Developer/ore/docs/research/brief-notionrpg-engram.md` (highlight types, cards, XP — not repeated here).

Labels: **[F]** observed fact with a citation. **[I]** my inference.

Abbreviations:
- `INV` = `~/Desktop/projects/notionrpg-app/docs/research/notion-inventory/`
- `RPG` = `~/Desktop/projects/notionrpg/`
- Notes DB = https://app.notion.com/p/25a38a618226803a8381da4273492466 (data source `collection://25a38a61-8226-81bb-8791-000b177a54b7`)
- Highlights DB = https://app.notion.com/p/2a638a61822680c8a063efc7f9e32894

The Notion pages were read live through the Notion MCP on 2026-10-22, read-only.

---

## 0. Bottom line

- [F] Out of 18 `🌐 Source` notes, Tyler wrote anything in **My Notes** in only **2**, and marked passages in only **3**. Everything else was ingested or generated and then left untouched (section 3).
- [F] The two notes he did fill are substantial: **953 words** (Make It Stick ch. 8) and **468 words** (Better Hooks). Both are structured syntheses in his own words, not excerpts.
- [I] What "seemed solid" is one page per source split into **My Notes on top, verbatim Source Material below**. A few numbered markers (K1, Q1, A1) tied his synthesis back to passages. Most of the value sat in the free-form My Notes synthesis written during or after reading. Ore has no equivalent today: D15 allows only a one-line note per highlight, and D29 defers margin notes.

---

## 1. The templates, in the order Tyler saw them

### 1a. Source Note (the main template)

Live template: https://app.notion.com/p/33438a61822680039e0bee1bb4711ffc. It is mirrored in `INV/04-templates.md:1301-1368`.

**Page header (properties) [F]**
- Pinned under the title, labels hidden: `Pin`, `Skills`, `Project`, `Tags`, `URL`.
- Then `Highlight Progress` (per-type pills such as "💎 4 ❓ 2 🛠 3", or "🏆 All Complete") and `More Info`, both shown only when non-empty.
- Every other property is hidden: Type, counts, Flashcards, etc.
- Source: the Notes data-source `page-layout` (live fetch of `collection://25a38a61-…`), and the formula text in `INV/db-learning.md:67-105`.

**Body, top to bottom [F]** (`INV/04-templates.md:1345-1366`):
1. A two-column row.
   - Left: the button **"1. Open Split"**, which opens this same page in side peek. That puts the note and its source side by side (`INV/03-buttons-automations.md`, "1. Open Split").
   - Right: a collapsed toggle **"2. Nav Side Panel"** holding a table of contents.
2. A callout containing the H1 toggle **"⛏️ Highlights"**:
   - Three buttons, **"💎 + Key point"**, **"❓ + Question"** and **"🏹 + Application"**.
   - An inline Highlights database for this note.
3. **`# 💎 My Notes`**, followed by two empty paragraphs. There is no prompt and no sub-headings: it is a blank canvas.
4. **`# 🪨 Source Material`**, which must be the last section so that appends land under it (`RPG/.agents/skills/source-ingest/SKILL.md`, "Verify scaffold").

**Properties preset by the template [F]**
- Type `🌐 Source`, Pin off, Knowledge Summary relation, and `_Count: Key Points/Questions/Applications` = 0.
- Status was preset to `Not Complete` until Status was deleted on 2026-10-06 (`INV/04-templates.md:1307-1317`; `RPG/changelog.md:64-70`).

**Older variant [F].** Storytelling Ultimate Guide was created 2026-06-07: https://app.notion.com/p/37838a6182268056b4a2d6d3886cbb2d
- `💎 My Notes` is an H1 *toggle* (collapsed) rather than an open heading.
- It is followed by an H4 toggle **"Pre-Reading: Struggle First"** with "💭 Prediction" sub-toggles and `- [ ]` prompts.
- The prediction prompts came from the AI-generated guidebook, not from the template. The same prompts recur before each unit inside the source text.

### 1b. Highlight templates (the K/Q/A records)

Sources: `INV/04-templates.md:715-817` and `INV/03-buttons-automations.md:1374-1512, 1708-1990`.

**How a highlight was made [F]**
1. Click "+ Key point" (or Question or Application) in the note's callout.
2. An automation creates a Highlights row:
   - `RefID` = the next number for that type in this note.
   - Its title and `Inline Reference` are set to a styled marker: **"💎 K1."** in blue, **"❓ Q1."** in red, **"⚔️ A1."** in green.
   - The note's `_Count` is bumped.
3. Tyler types a short title after the marker and an optional `Details`.

**Row fields:** `Highlight` (title), `Details` ("Highlighted text or detail copied from the source"), Type, Status (Active / Complete / Archived), RefID, Inline Reference, Source Note (`INV/db-learning.md:262-370`).

**Page buttons, which form a "highlight walk"** (each opens the next Active highlight of the same type, in RefID order) [F]:
- Key point: **Back**, **Complete**, **Archive**.
- Question: **Transfer to Inquiry Note**, **Mark Answered**, **Archive**.
- Application: **Transfer to quest**, **Archive**.
- A **Skip** button on all three was deleted on 2026-08-24/25 and Tyler chose to keep it removed (`RPG/memory/user-summary-button-deletions-2026-08.md`).

### 1c. Inquiry template

Live template: https://app.notion.com/p/3c838a618226808f9195e1f7b0a68bfd; mirror at `INV/04-templates.md:1242-1281`.

[F] The body has two buttons, **Add Source Note** and **Commit to research** (formerly "Add Reminder Quest"; `RPG/changelog.md`, 2026-08-27), and then:

```
# ✅ Answer
*(In Own Words)*
```

[F] "Transfer to Inquiry Note" pre-fills the new Inquiry as follows (`INV/03-buttons-automations.md:1814-1838`):
- Title = the question.
- More Info = "See ❓ Q1. in <highlight>" plus Details.
- Skills and Project are copied from the Source Note.

### 1d. Project Note

[F] The Project Note template has no body (`INV/04-templates.md:1283-1299`). It is out of scope here.

---

## 2. The workflow, step by step

### Capture: manual first, AI later

1. **Manual paste [F].** Click **"📝 New Note"** (Knowledge Summary) or **"Add Source Note"** (on a Quest). This creates a Source Note, opened full page, and the source text is pasted under Source Material.
   - "Ingestion is paste-first" (`RPG/AGENTS.md:285-287`).
   - The actions are listed at `INV/06-actions.md:390-414` and `57-68`.
   - The AI's role was "AI may summarize a pasted source. The human chooses the source, checks the summary" (`INV/06-actions.md:400`).
2. **Readwise bridge [F].** From 2026-04-27 to 2026-07-07, Readwise highlights were injected as yellow spans and stub notes were created (`RPG/changelog.md:1771`). It was retired; see section 4.
3. **`source-ingest` skill [F, from 2026-08-08].** Any URL or file becomes a Source Note.
   - Extraction is deterministic (trafilatura, yt-dlp VTT, pdftotext/pymupdf, pandoc).
   - **Verbatim floor**: no summarizing.
   - The source is chunked by its own structure, using toggles above 5,000 words. Books over 50,000 words become a hub with one child page per chapter.
   - Skills are seeded at creation.
   - It ends by reminding that "the note is ready for mark-while-reading" (`RPG/.agents/skills/source-ingest/SKILL.md`; commits `90c3ea7`, `cac18e2`, `b8a3604` in `RPG`).
4. **Real use [F].**
   - Five notes were ingested on 2026-08-09 by the skill: Building Effective Agents, Nielsen, Oakley, Dunlosky, and the full Make It Stick book.
   - Nine AI-generated guidebooks were bulk-created on 2026-08-27 at 00:12:32.
   - Both sets come from a Notes DB query (section 3).

### Read

5. **Reading surface [F].** Tyler read the Source Material inside Notion. "1. Open Split" let him keep the source in side peek while writing in My Notes (`INV/03-buttons-automations.md`, "1. Open Split").
6. **Marking while reading [F].** Make It Stick ch. 8 shows the actual mechanics:
   - Tyler clicked "+ Key point", named the idea (for example "💎 K2. The 3 keystone study strategies"), and pasted the colored marker inline before the relevant source heading or passage, with a **blue background** on the passage.
   - He re-used **one marker for many passages**:
     - K1 marks 4 places.
     - K2 prefixes 3 section headings: Retrieval, Spacing and Interleave.
     - K4 prefixes Elaboration, Generation and Reflection.
   - Native **yellow** highlight was used separately and rarely: 3 spans.
   - Sources: the live page https://app.notion.com/p/3b538a61822680e19c1dc8bbfcc49e72, parsed (37 marks; markers in headings such as `### 💎 K2. Practice Retrieving…`), and the Highlights DB rows listed in section 3.
7. **Questions and applications while reading [F].** These became Q and A rows, often with Tyler's own tentative answer or caveat in Details. Examples, paraphrased:
   - Q1 asks whether drawing a diagram counts as elaboration. His Details answer says no, because it is dual coding (a sensory link) rather than meaning.
   - A2 proposes "a small additional optional prompt in the beginning of source notes", with the caveat "Need to be careful about adding too much complexity."
   - Rows: https://app.notion.com/p/3b538a61822680839f27c18f8a6dd644 and https://app.notion.com/p/3b538a618226806b97e0cd944aca3b8c.

### After reading

8. **Write My Notes [F, timing I].**
   - [F] A free-form synthesis at the top of the page; examples in section 3.
   - [F] For MIS ch. 8 the note was created 2026-08-07 00:15. Highlights were created 00:35–01:17, with Q2 added at 20:17 the same day.
   - [I] So it was one reading session of about an hour, with a later follow-up question. The page does not record when the My Notes text was written.
9. **Process highlights (the walk) [F].**
   - Each K could be closed with Complete. In MIS ch. 8 all four K rows are `Complete`, while Q1, Q2, A1 and A2 stayed `Active`.
   - Questions ended in **Mark Answered** or **Transfer to Inquiry Note**. Applications ended in **Transfer to quest**.
   - The rule was "Questions are a menu, not a backlog… no obligation to close" (`RPG/memory/knowledge-inquiry-loop-design.md`).
   - [F] Only one Inquiry was ever created. Its title came from a Storytelling Q1, created 2026-08-30, and the page is blank: https://app.notion.com/p/3cc38a61822680b3a57ac760369dd004.
   - [I] It looks like a button test, not real use.
10. **Note lifecycle [F].**
    - `Status` was Not Started / Active / Complete, then two-state (2026-08-26), then deleted (2026-10-06).
    - Changelog: "Tyler does not start or activate notes, so the middle state carried no decision" (`RPG/changelog.md:326-330`). Afterwards `Pin` stands for priority and `Last edited` for recency (`RPG/memory/notes-status-two-state.md`).
    - The `Turn In` button was deleted. The `Schedule Review` button made a "Review <Note>" Quest dated tomorrow (`RPG/changelog.md:343`).

### Cards and inquiries

11. **Cards were AI-made on request [F].**
    - `learning-make-cards` was run by Claude or Codex: MIS ch. 8 cards were all created 2026-08-08 22:31–22:33, and Better Hooks cards 2026-09-18 01:41–02:41.
    - Sources: the Flashcards query, and `RPG/.agents/skills/learning-make-cards/SKILL.md`.
    - Scope evolved over time:
      - 2026-07-07: markup only (`RPG/changelog.md:977`).
      - About 2026-08-07: widened to "union of highlights + My Notes writing + source sections the notes discuss; bias toward more cards" (`RPG/changelog.md:671-676`; `RPG/AGENTS.md:285-292`).
      - 2026-08-08: provenance classes **Source / Synthesis / Open question**, so Tyler's own framing is never credited to the author ("In your notes…") (`RPG` commit `1231189`).
    - [F] **Contradiction left in place.** The live ⚙️ Knowledge Implementation Spec (last pass 2026-08-30, https://app.notion.com/p/2d638a618226800db18fda954353a0b0) says the opposite: "My Notes, native colored highlights, and nearby source text are context only; they never seed cards independently". AGENTS.md and the skill still say My Notes is card-eligible.
    - [I] The spec was rewritten to match the native-app design (Discovery model, 2026-08-30), while the working skill kept the looser rule that actually produced cards.
12. **Manual vs AI, summarized.**

| Step | Manual | AI-assisted |
|---|---|---|
| Create note | Button + paste | `source-ingest` (deterministic extract, agent writes) |
| Mark passages | Buttons + paste marker + color | none |
| My Notes | Entirely Tyler | none (spec: AI may "summarize a pasted source", never observed in My Notes) |
| Q/A resolution | Buttons | none |
| Inquiry answer | "In Own Words" | Agent "may investigate or propose an answer" (`INV/06-actions.md:441-452`) |
| Cards | Possible via templates; not observed | `learning-make-cards`, all observed cards |

---

## 3. What Tyler actually did (live Notes DB, 23 rows)

Source: SQL over `collection://25a38a61-8226-81bb-8791-000b177a54b7`, plus page fetches. The 13 notes not opened individually here were checked by a read-only sub-agent.

| Note | Created | My Notes | Passage marks | Highlight rows | Cards (reviewed ≥1) |
|---|---|---|---|---|---|
| [Storytelling Ultimate Guide](https://app.notion.com/p/37838a6182268056b4a2d6d3886cbb2d) (AI guidebook, ~46k words) | 06-07 | **empty** (toggle). Answered ~6 of 322 `- [ ]` prediction prompts in the first Pre-Reading block | ~41 in Chapter 0, ~1 elsewhere, out of 10 chapters | 5 K (06-26) + 1 Q + 1 A (test-like) | 5 (0) |
| [Make it stick Chapter 8](https://app.notion.com/p/3b538a61822680e19c1dc8bbfcc49e72) (~16k words) | 08-07 | **953 words** | 37, all in the first 32% of the chapter ("Learning Tips for Students") | 4 K, 2 Q, 2 A | 19 (14) |
| [Better Hooks](https://app.notion.com/p/3dd38a61822680daa781e88e9d24e7ee) (YouTube transcript, ~7k words) | 09-16 | **468 words** + 1 screenshot | 0 in transcript | 1 K | 49 (0) |
| Building Effective Agents, Nielsen, Oakley, Dunlosky, Make It Stick (full book) | 08-09 | empty | 0 | 0 | 0 |
| 9 guidebooks (Psychology of Success, Breaking Habits, Focus, Creativity, Building Habits, Creator Business, Reflection, Teaching, Goal Setting) + Learning Science Guidebook | 08-27 | empty | 0 | 0 | 0 |
| [Beyond Belief](https://app.notion.com/p/3da38a618226817eb809f663f43c07f3) | 09-13 | no template; agent-written excerpts + Quest link | 0 | 0 | 0 |

**Counts [F]**
- Of 18 `🌐 Source` notes:
  - **2** have My Notes filled.
  - **3** have passage marks or highlight rows.
  - **3** have cards.
  - **1** has reviewed cards.
- None of the 9+ AI guidebooks has a single filled exercise blank or quiz answer (sub-agent audit).
- Live Highlights DB: **16 rows**, all linked to these 3 notes. On 2026-08-28 there were 110 rows (`RPG/changelog.md:303`).
  - [I] That fits the "highlights are throwaway, purged monthly" rule in `RPG/memory/knowledge-inquiry-loop-design.md`, so older highlight counts are no longer visible.
- Earlier notes ("Made to Stick", "Self Compassion") received cards on 2026-07-03 (`RPG/docs/science-schema-contracts/learning.md:117`) and are no longer in the DB.

**Style of Tyler's own notes [F]**
- **MIS ch. 8.** It opens with a prose thesis paragraph in his voice: the effective techniques feel hard, the ineffective ones feel easy. Then comes an own reduction, "two things seem to increase learning the most: Recalling… Connecting", followed by "it seems to me that every effective technique is the product of these two."
  - `## 3 Keystone Learning Techniques` uses one `###` per technique, each with three bullets: **Definition / Why it works / Easy + ineffective evil brother**. The third bullet is his own framing and matches his K3 highlight.
  - `## Other Techniques` covers Elaboration, Generation, Reflection and Calibration as Definition / "Why it works (which it intermingles)". It includes notes where he goes past the text, for example that Generation is "not explicitly mentioned in chapter 8. I almost feel like this is a brother of elaboration".
  - `## My own metaphor` is a weightlifting analogy ending in a product jab: learning apps that focus on reviews and summaries are "the textbook example of inefficient learning".
  - Overall: paraphrase plus own structure, an own metaphor, and own extensions. No questions in My Notes; those went to Q rows.
- **Better Hooks.** It follows the video's timeline: `### Seconds 0-5. The Hook`, `### Seconds 5-10. The Lock in zone`.
  - Dense nested bullets and numbered lists name the framework parts (Interrupt theory, then orienting response, then 2 questions, then 4 ingredients "Subject/Stakes/Speed/Super clear"; then text, spoken, visual and caption hooks).
  - It contains a pasted screenshot, a formula callout ("[Subject repeater] + [Pain point reminder OR Dream outcome teaser…]"), and 🏅 marks on the two highest-leverage points.
  - [I] It reads as a notes-while-watching outline. The transcript itself was never marked.
- **Highlight titles.** They are short concept labels ("neural coupling", "Interrupt theory") or Tyler's own retrieval questions (K3: "For each of the Keystone study strategies name the common failure mode…").
  - Details holds a 2–6 word cue ("4x triggers of curiosity", "the equation") or a short list.
  - [I] The K titles were working as his own outline headings and prompts, not as excerpts.
- **Cards drew on My Notes [F].** MIS card examples:
  - "Map your weightlifting metaphor onto learning: what plays the role of muscle-fiber breakdown?"
  - "You reduced every effective learning technique to two ingredients. Name them…"
- **Sections that stayed empty [F].**
  - `More Info` on every note except agent-written ones.
  - `Tags` (only `Anthropic Engineering` and `readwise-stub` options exist; no row uses them).
  - Inquiry bodies.
  - Exercises and quizzes embedded in AI guidebooks.
  - My Notes on every ingested or generated source.

---

## 4. Tried and dropped, and why

| Thing | When | Why dropped | Source |
|---|---|---|---|
| Readwise → Source Notes sync | 04-27 → retired 07-07 | "zero references" | `RPG/changelog.md:1771`; prior brief §6 |
| `learning-ingest-book` (auto book ingest) | removed 06-29 | Book material "hand-transferred… manually for now"; it also had a data_source_id bug | `RPG` commit `71f976e` |
| Markup-only card scope (cards only from marked text) | 07-07 → widened ~08-07 | Tyler's call; "Do not assign annotation chores", "No structured Key Points… required" | `RPG/changelog.md:977, 671-676`; `learning-make-cards/SKILL.md` |
| Notes Status (Not Started/Active/Complete) → 2-state → none | 08-26, 10-06 | "Tyler does not start or activate notes"; 0 of 11 notes ever reached Complete; Pin + Last edited suffice | `RPG/changelog.md:64-70, 326-345`; `RPG/docs/science-schema-contracts/learning.md:141` |
| `Turn In` on notes | 10-06 | Dead with Status | `RPG/changelog.md:64-79` |
| Highlight `Skip` buttons; User Summary `💎 New Source` | 08-24/25 | Removed; Tyler kept them removed | `RPG/memory/user-summary-button-deletions-2026-08.md` |
| Highlight types Connection, Thought | never templated | Leftovers (prior brief §1) | `INV/db-learning.md:364-370` |
| `Change Style (rm?)` full/compact inline reference | marked "rm?" | Cosmetic plumbing | `INV/db-learning.md:284-290` |
| Notes self-relation for multi-source inquiries | rejected 08-26 | Two properties for a list only a human reads; use @-mentions + Add Source Note | `RPG/memory/knowledge-inquiry-loop-design.md` |
| Inquiry open/closed state | removed 10-06 | "an answer written in the body is the natural end of an inquiry" | same |
| "Highlight identifiers into self-written summaries" (auto-linking K markers inside My Notes) | parked ~08-07 | Its own worth-it gate | `RPG/changelog.md:679-680` |
| `Knowledge Summary` relation on Highlights | 08-28 | 110 identical links, no information | `RPG/changelog.md:301-305` |
| Toggles for every section in ingested sources | 08-09 | "on a page scoped to one reading session they just add a click per section and break reading flow"; plain headings ≤5k words | `RPG` commit `b8a3604`; `source-ingest/SKILL.md` "Collapse threshold" |
| Native app (notionrpg-app) Source Note | 08-30 → ~09-10 | Kept My Notes / Source Material, renamed Highlight rows "Discoveries", replaced RefID markers with stored References, used a section switcher instead of a stacked page. Learning was never put to real use (prior brief §4) | `notionrpg-app/docs/design/spec-learning-foundation.md:18-60`; app commits `785e0873`, `0913ca93` |

---

## 5. What looks solid and transferable vs what was friction

### Solid (worth reusing)

1. **Two zones per source: my writing above, verbatim source below** [F: template; both real notes].
   - The live brief lists this first among behaviors to keep: "A Source Note keeps My Notes and Source Material in separate areas" (`notionrpg-app/docs/research/notion-brief-learning-notes.md`).
   - [I] Ore has per-highlight one-line notes (D15) and closed-book free recall at finish (D18). It has **no place for a source-level synthesis**, and that was the only thing Tyler wrote at length.
   - Smallest port: a per-source `My notes` Markdown area, open-book and editable any time. The reader would show it beside or above the text, and the finish step could seed it. D29's "never show an AI summary in place of Tyler's own notes" already protects it.
2. **One idea, many passages.** K2 tags three sections; K4 tags three [F]. [I] Tyler grouped passages under his own concept names and then wrote My Notes to that outline. The Ore equivalent would be letting a note or highlight cover several anchors, or letting a My-notes heading link to several highlights. D15 is currently one note per highlight.
3. **Questions captured during reading, with his own tentative answer** (Q1's dual-coding answer) [F]. [I] This maps to D15 Question plus note. The "menu, not backlog" rule (no counts, no obligation to close) is worth keeping.
4. **Applications as a distinct intent tied to his work** (A1: reword a quote for a long-form video; A2: a product idea) [F]. [I] D15 folds this into a note ("How I will use this" is a note, not a button). That fits, since Tyler made only 3 Application rows in total.
5. **AI cards drawn from his own synthesis, with provenance kept separate** [F: the metaphor and "two ingredients" cards; commit `1231189`]. These are the cards most clearly tied to D1 (explain in own words, apply). Ore's D19 limits items to Card-intent highlights "and Key-Point-like notes". [I] Explicitly including the source-level My notes as draft material, with "In your notes…" attribution, would carry this over.
6. **Verbatim, structure-preserving ingest with plain headings for single-session sources** [F]. Ore already does deterministic ingest (D8). The rule "no toggles/collapsing under ~5k words" is a reader-layout lesson.
7. **Pre-reading prediction prompts** [F]: Tyler answered the first block in Storytelling, and his own A2 asked for "a small additional optional prompt in the beginning of source notes". This is already D18.

### Friction (avoid)

1. **Marking cost.** One highlight took a button, a title, a pasted styled marker and a manual background color [F: mechanics]. [I] That is why marking stops early: 32% into MIS ch. 8, Chapter 0 of 10 in Storytelling, nothing in a transcript. Ore's select-to-highlight with an intent key (D15) already fixes this.
2. **Ingest outpaced reading.** 14 of 18 source notes were ingested or generated, then never annotated or noted [F]. Bulk-created guidebooks (9 in one minute) got zero engagement. [I] Supports Ore's Inbox/Reading/Done split and D17 "never auto-ingest". Capture volume is not learning.
3. **Exercises embedded in the source text went unanswered**: 322 checkbox prompts in Storytelling, about 6 answered, and 0 of hundreds of guidebook blanks [F]. [I] Prompts buried in the reading surface are ignored. Ore's prequestion strip (D18) is separate from the text, which is the right call.
4. **Lifecycle states nobody set** (Status, Turn In, Complete) [F]. [I] Ore's Inbox/Reading/Done should derive from behavior (opened, finished) rather than ask for a status.
5. **Post-reading processing chores.** The highlight walk (Complete/Archive per K) and the inquiry transfers saw almost no use: 1 test inquiry, monthly purges [F]. "Do not assign annotation chores" became doctrine (`learning-make-cards/SKILL.md`). Matches D29: never add a "review your highlights" screen.
6. **Card volume vs review.** 49 cards from one 468-word note were never reviewed, and only 14 of 73 cards have any rep [F]. [I] "Bias toward more cards" produced supply that outran review. That argues for D20's "finishing in first review" and for fewer, synthesis-level prompts.
7. **Spec drift on whether My Notes can seed cards** (section 2, step 11) [F]. [I] Ore should decide this once in DECISIONS rather than leave it implicit.

### Not useful here

- The "NotionRPG Review - *.png" screenshots on `~/Desktop` (dated Aug 30) were not opened. Their filenames say they show flashcard review, not notes.
