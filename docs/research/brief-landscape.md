# Landscape brief: AI-first personal learning app (capture → clean read → highlight/note → AI cards → spaced review)

As of 2026-10-09. Prepared for the planner of a Mac-first, dark, Raycast-style, local-files, single-user app.

Confidence key: **[O]** official docs/vendor page, **[C]** changelog/founder post, **[U]** user/forum report, **[3P]** third-party review/aggregator (often SEO, weight lower), **?** unverified.

---

## 1. Status snapshot (what changed 2025–2026)

- **Readwise Reader** shipped an official **MCP server + CLI** in March 2026, with read and write access, full-text plus semantic hybrid search, and full Markdown fetch [C]. It added **Global Ghostreader** (chat across the whole library, Aug 2026) [C] and rebuilt the Readwise mobile app as "Readwise 2.0" (Jul–Aug 2026) [C]. Markdown upload followed [C], and the default model for summaries and auto-tagging is now "GPT-6 Luna" (Sep 2026) [C]. It is the clear incumbent.
- **Omnivore** has been dead since Nov 2024. The team joined ElevenLabs, the hosted data was deleted, and the open-source code is unmaintained and hard to self-host (Postgres, Elasticsearch, several services) [U/3P]. **Pocket** closed in 2025.
- **Anki**: Damien Elmes announced in Feb 2026 that he is handing business operations and open-source stewardship to **AnkiHub**. The core stays open source [O forum]. FSRS-6 is the default scheduler, and the current release is 26.09.x [3P].
- **Zotero** moved to fast releases: Zotero 8 (Jan 2026) added annotation search, tagging and new annotation and full-text APIs; Zotero 9 added Read Aloud [O/3P].
- **Kortex** is pivoting into **Eden** (migration began Nov 2025) [O Eden help].
- **Reflect** launched **Reflect Open** (Jul 2026), a free, MIT-licensed Mac app that stores notes as plain Markdown files, with bring-your-own-key AI. The original Reflect added an MCP server that agents can edit through [O/3P].
- **Heptabase** shipped an AI Tutor (v1.88, Mar 2026) and Web cards [O roadmap]. The community MCP server for it was archived in May 2026 [3P].
- **Curius**: the Chrome extension was last updated Oct 2023, so the product looks stagnant [3P].
- **Capacities** discontinued its Beta API on 2026-09-01; the v2 API uses tokens scoped to one space [3P].
- **NotebookLM** now generates flashcards and quizzes from sources and exports CSV. Reports conflict on whether it has a real scheduler; the more credible ones say it does not [3P].
- **Newcomers worth watching** (all small): CuaderNote (Mac/iOS reader with multi-color highlights, AI cards and FSRS, free beta) [3P]; BeeMind (Apple-native snippet capture with SM-2 review) [3P]; Acorny (imports highlights and turns them into AI recall questions) [U]; Highlight Notes (Mac App Store app with a Safari extension, Oct 2026) [U]; Resurf (local-first Mac library) [U]; Karakeep (self-hosted, an Omnivore successor) [U]. None of them combine all the pieces locally with agent access.

---

## 2. Comparison tables

### 2a. Formats ingested

Legend: Y = yes, ~ = partial, via a plugin or indirect, - = no, ? = unverified.

| Product | Web | PDF | EPUB | YouTube | Podcast | X threads | Email/newsletter | Markdown | Img/OCR | Kindle | RSS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Readwise Reader | Y | Y | Y | Y (transcript, chapters) | Y (transcripts from Spotify, Overcast, Apple) | Y | Y (custom address) | Y (≤10 MB upload) | ~ (image highlights) | Y (via Readwise) | Y (+OPML) |
| Matter | Y | Y | - | Y (time-synced transcript) | Y | Y | Y (Gmail) | - | - | ~ (Premium) | Y |
| Omnivore (dead) | Y | Y | - | - | - | ~ | Y | - | - | - | Y |
| Zotero 8/9 | Y (snapshots) | Y | Y | - | - | - | - | - | - | - | - |
| MarginNote 4 | ? | Y | Y | ? | - | - | - | export only | Y (AI OCR) | - | - |
| LiquidText | ? | Y (+Word, PPT) | - | - | - | - | - | - | ? | - | - |
| Highlights.app | - | Y | - | - | - | - | - | export only | Y (on-device OCR) | - | - |
| Recall | Y | Y | - | Y | Y | ? | - | Y (bulk import) | - | - | - |
| Glasp | Y | Y | - | Y (transcript highlights) | ~ (audio transcriber) | - | - | - | - | Y | - |
| Curius | Y | - | - | - | - | - | - | - | - | - | - |
| RemNote | Y | Y | ? | Y | - | - | - | Y (import) | Y | - | - |
| Mochi | - | - | - | - | - | - | - | Y (cards are MD) | - | - | - |
| Anki | - | - | - | - | - | - | - | ~ | Y (image occlusion) | - | - |
| Obsidian + Web Clipper | Y (Defuddle) | ~ (viewer, plugins) | ~ (plugin) | ~ (clipper transcript ?) | - | Y (Defuddle via FxTwitter) | - | Y (native) | ~ | ~ (plugins) | ~ (plugins) |
| Heptabase | Y (web card/tab) | Y | - | ? | - | - | - | Y | - | - | - |
| Kortex/Eden | Y | Y | - | Y | - | - | - | - | - | Y | - |
| Reflect / Reflect Open | ~ | - | - | - | ~ (voice) | - | - | Y (Open = plain .md) | - | Y? | - |
| Capacities | Y (web highlights) | ~ | - | Y | - | Y? | - | Y (import) | Y | - | - |
| Readlang | Y | ~ | ? | ~? | - | - | - | - | - | - | - |
| Defuddle (lib) | Y → clean HTML/MD + metadata, math, footnotes | - | - | ? (transcript language option only) | - | Y (FxTwitter) | - | output | - | - | - |

### 2b. Highlight, review, AI, openness, client, price

| Product | Highlight/annotation UX | Review/learning | AI | Data openness and agent access | Mac client | Price (USD) |
|---|---|---|---|---|---|---|
| **Readwise Reader** | Select text with auto-highlight on and the highlight is created at once; Option-drag selects without highlighting. Keyboard: arrows move paragraph focus, **H** highlights, **N** opens a note (Enter saves), **T** tags. Drag handles to resize or merge. Notes and tags sit in the right margin. **No colors** (use tags). Keyboard highlighting is paragraph-level only [O] | Daily Review resurfaces highlights (rereading). Mastery Q&A cards via a `.qa` action tag [O]. No real generated-quiz SRS in Reader itself | Ghostreader: define, simplify, summarize, custom prompts, chat with a document and, since Aug 2026, with the whole library. Auto-summary and auto-tagging. BYO OpenAI key [C] | Cloud. **Reader API v3** and **Readwise API v2**, webhooks, official **MCP** (`https://mcp2.readwise.io/mcp`) and **CLI** (`@readwise/cli`, full Markdown out, read and write, skills for Claude/Codex) [O]. Exports: MD (Jinja template), CSV, OPML, ZIP of content, annotated PDF | Desktop app (Tauri per a third-party tracker, so a web view rather than native) [3P]. Web is the primary client | Full $9.99/mo billed annually ($119.88/yr) or $12.99 monthly. Lite (no Reader) $5.59. 30-day trial [O] |
| **Matter** | Long-press and drag. Apple Pencil on iPad. Highlight while listening [O] | None built in; reviewers note no system for retaining what you read [3P] | Speech synthesis and transcription. No AI co-reader named on the site [O] | Official Obsidian plugin (QR pairing, scheduled sync). **Undocumented API**, reverse-engineered by MacStories [U] | iPhone, iPad and web. No Mac app listed [O] | Premium $12.99/mo or $59.99/yr [3P] |
| **Omnivore** | n/a (dead) | - | - | Open-source code only | - | - |
| **Zotero 8/9** | Select text → popup with color swatches; types: highlight, underline, note, text, image area, ink. Annotations searchable and taggable in 8.0 [O]. Colors can be lost on KOReader import [U] | None (plugins exist) | None built in (community plugins) | **Local SQLite** plus an **official local API** at `localhost:23119/api/` (enable in Settings → Advanced; read-only by default) [O]. Several community MCP servers. Write access reported only for newer builds ? | Cross-platform Gecko-based app, not native | Free. Paid storage for sync |
| **MarginNote 4** | Select → "excerpt": **one excerpt is a PDF highlight, a mind-map node and a flashcard at once** [O]. Colors. Recall mode blurs excerpts until you recall them | **FSRS** built in. In-place card editor. AI flashcard generation (v4.2+) [O] | Book breakdown, Q&A, translation, OCR templates. Falls back to Apple Intelligence offline [O] | Proprietary database. Exports MD and OPML [O]. No API | Apple-native (iCloud across iPhone, iPad, Mac) | Free plus IAP, Pro/Max one-time or subscription, 14-day trial [O] |
| **LiquidText** | Drag a selection into the side workspace to make an excerpt that stays linked to its source. Ink links across documents. Multi-document projects [O/3P] | None | Not confirmed in 2026 sources | Proprietary project format. Real-time collaboration added Oct 2025 [C] | Mac and iPad (sync). Users complain of no dark mode [3P] | From ~$3.99/mo. LIVE subscription. One-time "Pro" historically [3P] |
| **Highlights.app** | Tools always visible, default color per tool, Pencil double-tap switches tools. **Stores standard PDF annotations** [O] | None | None listed | **Sidecar Markdown/TextBundle written next to each PDF automatically** (Pro). Exports to Bear, DEVONthink and others [O/U] | Apple universal (Mac, iPad, iPhone) | Free plus Pro (~$1.99/mo US listing) [3P] |
| **Recall** | Little user highlighting; "augmented browsing" auto-highlights terms already in your knowledge base [U] | **Quizzes plus spaced repetition** (Plus tier) [O] | Summaries, chat (your knowledge, the web or both), auto knowledge graph, smart tags, choice of model on Max [O] | Cloud. **MCP read-only** (`backend.getrecall.ai/mcp/`), write "coming soon" [O]. Public API documented | Web, browser extensions, iOS and Android. No Mac app. No offline mode [O/U] | Free (10 AI summaries/mo), Plus $10/mo yearly, Max $38/mo yearly [O] |
| **Glasp** | Extension highlighter for web, PDF and YouTube transcripts. Social, public by default [3P] | Kindle daily review. Flashcards ? | Summaries, chat with highlights, "Idea Hatch" | Exports MD, HTML, CSV, JSON. Obsidian plugin. API and MCP connector listed [3P] | Browser only | Free (public highlights). Pro $12.50/mo. Unlimited $30/mo [3P] |
| **Curius** | Extension highlights on a public shelf | - | - | - | Browser only | Free. Looks stagnant |
| **RemNote** | PDF highlight → card without leaving the document [3P] | Cards with **SM-2 or FSRS** [3P] | Auto cards, quizzes, summaries, AI grading of answers (metered credits) [3P] | Cloud-first. Plugin API. Export ? | Electron desktop | Free / Pro / Pro+AI. AI roughly doubles the price. USD unconfirmed |
| **Mochi** | n/a (card editor, Markdown) | SRS | "AI integration" on Pro [O] | **REST API** (`app.mochi.cards/api/`, Basic auth with API key, 1 concurrent request) [O]. Markdown content | Cross-platform desktop. Offline free tier | Free; Pro $5/mo [O] |
| **Anki** | n/a | **FSRS-6 default**. The best-in-class scheduler | None built in (add-ons) | Local SQLite collection, `.apkg`. **AnkiConnect** add-on gives a local HTTP API (port 8765) | Qt app, cross-platform, dated UI | Free (AnkiMobile is paid) |
| **Obsidian + Web Clipper + SR plugins** | Clipper highlight mode; `==highlights==` persist (v1.7, Jun 2026, Defuddle 0.15) [3P]. In-vault highlighting is Markdown `==…==` | Plugins: Spaced Repetition (`==cloze==`), FSRS, Remember, Retrieva, Mnemoloop (one card per .md file) [3P] | Community plugins | **Plain local .md files**, so any agent can read and write them directly | Electron | Free. Sync is paid |
| **Heptabase** | PDF highlight → card tied to page and line, arranged on whiteboards. Mobile PDF annotation still in progress (Mar 2026) [O/3P] | None | AI Tutor, suggested questions, related cards [O] | Export MD, JSON, Mermaid. No official API. Community MCP reads backups only and is archived [3P] | Electron | Pro $8.99/mo annual. Premium $17.99. No free plan [3P] |
| **Kortex → Eden** | Clips and highlights with source attribution | - | AI writing over your notes | Cloud | Web | Free / $10 / $17.50 (pre-pivot) [3P] |
| **Reflect / Reflect Open** | Note-centric; Kindle sync ? | - | BYO-key AI with citations into .md files (Open) | **Open: plain Markdown folder, iCloud/Git sync, MIT.** Classic Reflect: MCP read and edit | Mac app (Open: signed GitHub release) | Classic $10/mo. Open is free |
| **Capacities** | Web highlights integration (Pro) [3P] | - | Chat, auto-fill, auto-tagging (GPT, daily budget) [3P] | Cloud. API v2 (one space per token). Community MCP [3P] | Electron | ~$9.99/mo Pro (sources disagree). Believer ~$12.49 |
| **Readlang** | **Click a word for an instant translation popup, and every lookup automatically becomes a flashcard** [3P] | Built-in SRS, prioritized by word frequency [3P] | Context explanations and phrase translation (AI) | Cloud | Web and extension | Free / $6/mo / $15/mo [O] |
| **Defuddle** | n/a (parser) | - | - | **MIT library and CLI**: `npx defuddle parse <url> --markdown --json`. Returns title, author, date, schema.org metadata; normalizes MathJax/KaTeX and footnotes [O] | Node library | Free |

---

## 3. Answers

### A. Best-regarded highlight → popup → note flow

**Readwise Reader is the reference design for reading on the web and in documents.**
- A r/macapps thread from May 2026 calls its annotation experience "best in class" [U].
- Readwise itself positions highlighting as a "first-class feature", where other apps treat it as an afterthought [O].
- **Why it works.** Three things set it apart:
  - There is no decision popup in the default path. With auto-highlight on, selecting text *is* the highlight; Option-drag selects without highlighting.
  - It is keyboard-first: arrow keys move focus by paragraph, **H** highlights, **N** opens a note where Enter saves, **T** adds a tag.
  - Notes and tags live in the margin, and highlights can be resized or merged by dragging their handles [O docs].
- **Its known weaknesses** are exactly the gaps to design around:
  - There are no highlight colors. This has been a top r/readwise request since 2023 and drew another "why not?" thread in Nov 2025 [U].
  - Keyboard highlighting works only on whole paragraphs [O].
  - The web app slows down with large libraries or thousands of tags [U].
- One dissent: an Obsidian forum user preferred Matter's reading experience over Reader's, though they called Matter's export "barebones" [U].

**For PDFs and study, the best-regarded models are spatial or unified rather than popup-based:**
- **MarginNote 4**: one excerpt is at once a highlight, a mind-map node and a flashcard. "One capture, three places" is the strongest idea to steal. The cost is a steep learning curve that v3 users complain about [O/U].
- **LiquidText**: drag an excerpt out into a workspace and it stays linked to its source. It was Apple's most innovative iPad app of 2015 and MacSparky praised it, but users fault its subscription price and lack of dark mode [3P].
- **Highlights.app**: tools are always visible, each with a default color, and annotations are written to Markdown sidecar files automatically. Mac power users like it for its file-based output [U].

**Readlang** shows the purest capture-to-card coupling. Clicking a word triggers the lookup and the flashcard with no extra step.

**Design takeaway:** combine Reader's popup-less, keyboard-first selection with MarginNote's rule that a highlight is already a card candidate. Add a small set of semantic highlight types, which Reader lacks.

### B. Common complaints across these tools

1. **Shutdowns and pivots erode trust.**
   - Omnivore deleted user data in 2024 and Pocket closed in 2025.
   - Kortex is pivoting into Eden, and Curius looks abandoned.
   - The Heptabase MCP project was archived.
   - Users explicitly cite Omnivore as the reason they fear price jumps or closures [U].
2. **Subscription stacking and price creep.**
   - Reader costs about $120 a year, and "too expensive for what it is" is a common reaction [U].
   - Cubox's price jumped about 3–5x in 2025 [U].
   - LiquidText users say key features sit behind higher tiers [3P].
   - RemNote and Heptabase charge extra for AI credits.
3. **The highlight graveyard.** Highlights become a "dead archive" [U, Acorny post]. Daily Review is passive rereading rather than retrieval practice. Saving is so easy that people hoard ("you need a threshold to think twice" [U]).
4. **Too highlight-centric, too little control over full text and metadata.**
   - Reader users want analysis and export of full text, not just highlights [U].
   - A Feb 2026 thread from a paying user complained that basic metadata bugs had gone unfixed for years while AI features shipped. The founder suggested Zotero for metadata-heavy needs [C/U].
5. **Performance on large libraries.** Reader's web app gets sluggish with a large feed, tagging stalls with roughly 5k tags, and mobile scrolling has lagged [U].
6. **Parsing gaps.**
   - Reader handles RTL text and Telegram poorly [U].
   - It is weak on Instagram, Threads and Facebook [U].
   - Paywalls are inconsistent across all the tools.
7. **Distrust of AI-generated cards.**
   - A widely discussed r/Anki thread from Sep 2026 says AI card makers are unwanted. Users report needing more repetitions on AI cards and call card-making "an intense first review" [U].
   - A summary of Matuschak and Kirkby's work says LLMs draft cards adequately but judge card quality poorly, with no model above 70% accuracy at classifying prompt quality [3P].
8. **Tool sprawl.** Typical stacks run four to six apps (for example DEVONthink + Bear + Obsidian + mymind + Hookmark), plus "where does this go?" friction [U].
9. **Heavy or unfamiliar clients.** Most tools are Electron or web wrappers. Native Mac apps are PDF-only. MarginNote's UI moved around in v4. Obsidian has startup lag and weak Apple Pencil support [U].
10. **Missing basics.** No highlight colors (Reader), no offline mode (Recall), no dark mode (LiquidText), no Mac app (Matter, Recall).

### C. Gaps an AI-first, local-files, single-user Mac app could fill

1. **The whole loop, locally.** Today nobody does capture → clean Markdown → highlight → card → FSRS on plain local files.
   - Reader is cloud-only.
   - Obsidian needs a stack of plugins (Clipper, an annotator, SR plugins) that do not share a model.
   - MarginNote uses a proprietary database.
   - Recall is cloud-only with read-only MCP.
2. **Agent-native storage, with no rate limits.**
   - Store documents as `.md` with sidecar annotations (JSON, text-quote anchors) and cards as files or a small SQLite database.
   - Claude Code or Codex could then read and write directly. Compare Reader's limits of 20 list calls and 50 save calls per minute, and Recall's read-only MCP.
   - Reflect Open's "your graph is a folder" and Highlights' sidecar `.md` show the demand.
3. **Semantic highlight types that drive downstream actions.** Reader has no colors; Zotero has colors with no meaning attached. Map a few keys to intents, for example:
   - "remember" → card candidate
   - "question" → ask AI
   - "disagree" → note prompt
   - "reference" → no card
   Nobody routes highlights by intent.
4. **AI that drafts cards while the human keeps the judgment.** This answers B7:
   - Generate two or three candidate prompts per "remember" highlight.
   - Accept, edit or reject each with one keystroke, so making the card still serves as a first review.
   - Apply Matuschak-style quality rules (atomic, cue-specific, no giveaway).
   - Tie every card to its source anchor so review can jump back into context.
5. **Retrieval rather than rereading.** Replace the Daily Review's passive resurfacing with FSRS-scheduled prompts, AI-graded free recall, and interleaving of new reading with old cards. Readwise does rereading, Anki does retrieval, and nothing bridges the two.
6. **System-wide capture in a Raycast style.** A global hotkey captures the selection, URL or file from any Mac app into the inbox. There is clear demand (Highlight Notes, BeeMind, ActionClip and DoubleMemory all launched in 2025–26), but none of these closes the learning loop.
7. **One local reader for every format.** Today only cloud Reader covers web, PDF, EPUB, YouTube and podcast transcripts together. Locally, Defuddle plus yt-dlp subtitles or Whisper plus PDF and EPUB text layers could cover the same ground.
8. **Robust highlight anchoring across re-parses.** Use text-quote and position selectors, so that re-fetching an article or swapping parsers does not orphan highlights. Reader rejects highlights whose text does not match [O API].
9. **Native Mac quality for prose, not just PDFs.** No native Mac app covers web, EPUB and transcripts with a dark, keyboard-driven interface.

### D. Integrate rather than rebuild

| Need | Integrate | Concrete facts | Verdict |
|---|---|---|---|
| Web parsing | **Defuddle** (MIT) | `npx defuddle parse <url> --markdown --json`; Node: `import from "defuddle/node"` with linkedom or JSDOM; returns metadata, normalized math and footnotes; powers Obsidian Web Clipper [O] | **Use as the local default parser.** |
| Cloud capture of hard sources (newsletters, RSS, X, Kindle, podcasts, paywalls via extension) | **Readwise Reader** (optional connector) | **Save:** `POST /api/v3/save/` (50/min; supports `html` and `tags`). **List:** `GET /api/v3/list/?updatedAfter=…&withHtmlContent=true` (20/min, cursor pagination). Highlights are documents with `parent_id`, `highlight_location` and offset. Create a highlight with `parent_id` + `content` (must match the text). Webhooks available. **CLI** `@readwise/cli` returns full **Markdown** per document (`readwise login-with-token`). MCP: `claude mcp add --transport http readwise https://mcp2.readwise.io/mcp` [O] | **Optional importer, not the system of record.** Pull Markdown plus highlights into local files; avoid two-way sync. Costs the user $9.99/mo. |
| Kindle and other highlights | **Readwise v2 export** | `GET /api/v2/export/?updatedAfter=` with `pageCursor`; 240/min (list endpoints 20/min). Also `POST /api/v2/highlights/` (idempotent) and `GET /api/v2/review/` [O] | Good one-way import. Alternative: parse Kindle `My Clippings.txt` locally. |
| Academic PDFs | **Zotero local API** | `http://localhost:23119/api/` mirrors Web API v3 from the local database; enable in Settings → Advanced, otherwise 403 [O]. Annotations live in `zotero.sqlite` | Read-only import of items and annotations for users who already use Zotero. |
| PDF annotation sidecars | **Highlights.app** | Auto-writes `.md` or TextBundle next to each PDF (Pro) [O/U] | File-watch its sidecars; no API needed. |
| Scheduler | **FSRS** (open-spaced-repetition) | FSRS-6 is Anki's default. Rust (`rs-fsrs`), TS and Python ports exist; Obsidian plugins embed them [3P] | **Embed.** Do not rebuild the algorithm. Check whether a Swift port exists ?. |
| Mobile and power-user review | **Anki via AnkiConnect** or **Mochi API** | AnkiConnect: local HTTP API (default port 8765) to add notes. Mochi: `app.mochi.cards/api/`, Basic auth with API key, 1 concurrent request, Markdown cards [O] | Offer export or push of cards; keep the canonical cards local. |
| Obsidian users | **Write into a vault folder** | Clipper keeps `==highlights==`; SR plugins read `==cloze==` | Make the library folder Obsidian-compatible Markdown. |
| Avoid as dependencies | Matter (undocumented API), Recall (read-only MCP, cloud), Heptabase (no API), Capacities (API reset Sep 2026), Kortex (pivoting), Omnivore (dead), Curius (stale) | | Do not build on these. |

**Recommended architecture stance:**
- The **system of record is local**: `library/<doc>.md` plus `annotations/<doc>.json` (text-quote anchors, highlight type, note) plus a `cards` table with FSRS state in SQLite or as files.
- **Parse locally** with Defuddle.
- **Optional connectors** (Readwise CLI or API, Zotero local API, Kindle clippings) are one-way importers.
- **Export** to Anki or Mochi and to Obsidian-compatible Markdown.
- Expose an **MCP server or CLI** of your own, so Claude Code and Codex reach the same files.

---

## 4. Top takeaways for the planner

1. **Readwise Reader owns capture and reading** (every format, MCP and CLI since Mar 2026, a highly regarded keyboard highlight flow). Do not compete on parsing breadth; import from it.
2. **The open lane is the learning loop on local files.** Reader resurfaces highlights but has weak retrieval practice. Anki and Mochi have strong retrieval but nothing for reading. Nobody joins the two locally with agent read and write access.
3. **Steal three interactions:**
   - Reader's popup-less, keyboard-driven H/N/T flow.
   - MarginNote's "a highlight is already a card candidate".
   - Readlang's "a lookup is a card".
   Then add **semantic highlight types**: Reader's lack of colors is a long-running complaint.
4. **AI cards must keep a human in the loop.** Experienced SRS users reject one-click AI decks (r/Anki, Sep 2026; Matuschak and Kirkby). Have the AI draft, let the human accept with one key, and anchor every card to its source.
5. **Trust and longevity are features.** Plain Markdown, MIT-style openness and no lock-in answer the Omnivore, Pocket, Kortex and Cubox-price fear. Reflect Open's July 2026 pivot to "your graph is a folder" signals the same market pull.

---

## Sources

- Readwise Reader API: https://readwise.io/reader_api · Readwise API v2: https://readwise.io/api_deets · MCP: https://readwise.io/mcp · CLI: https://readwise.io/cli · Pricing: https://readwise.io/pricing
- Reader highlights/tags/notes docs: https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes · Reader docs index: https://docs.readwise.io/reader/llms.txt · Desktop apps: https://docs.readwise.io/get-started/desktop-apps
- Readwise changelogs (r/readwise): CLI/MCP https://www.reddit.com/r/readwise/comments/1s042y3/ · Global Ghostreader https://www.reddit.com/r/readwise/comments/1vnca43/ · GPT-6 Luna https://www.reddit.com/r/readwise/comments/1wtoy4j/ · WiseUp 79 https://wiseup.readwise.io/wiseup-vol-79-clean-up-your-reader-explore-the-new-readwise-and-upload-your-md-files/
- Reader complaints: colors https://www.reddit.com/r/readwise/comments/1ot9it2/ , https://www.reddit.com/r/readwise/comments/1gkathp/ · metadata/AI focus https://www.reddit.com/r/readwise/comments/1r72fc4/ · RSS limits https://www.reddit.com/r/readwise/comments/1vqoior/ · social gap https://www.reddit.com/r/readwise/comments/1rd5r0z/
- "Best in class" annotation comment: https://www.reddit.com/r/macapps/comments/1tn42po/ · Desktop Insights (Tauri): https://desktopinsights.com/apps/reader
- Matter: https://getmatter.com · Obsidian sync https://www.getmatter.com/updates/sync-to-obsidian · MacStories API https://www.macstories.net/stories/macstories-starter-pack-reverse-engineering-the-matter-api-and-my-save-to-matter-shortcut/ · Obsidian forum https://forum.obsidian.md/t/ipad-reader-app-for-highlighting-articles-and-importing-all-highlights-at-once-into-obsidian/51377 · pricing review https://makeheadway.com/blog/matter-app/
- Omnivore shutdown: https://spy.macrumors.com/threads/omnivore-shutting-down.2441423 · https://www.yaps.ai/blog/omnivore-alternative
- Zotero 8: https://www.zotero.org/blog/zotero-8/ · Local API: https://www.zotero.org/support/dev/web_api/v3/local_api · KOReader color issue https://forums.zotero.org/discussion/129908/
- MarginNote 4: https://apps.apple.com/us/app/marginnote-4-ai-notes-mindmap/id1531657269 · forum https://forum.marginnote.com/t/margin-note-4/9727
- LiquidText: https://www.capterra.co.uk/software/1033403/liquid-text · https://www.liquidtext.net/pricing-features · https://softwarefinder.com/legal/liquidtext
- Highlights: https://highlightsapp.net · https://talk.macpowerusers.com/t/pdf-annotation-workflow-using-highlights-app-and-hazel/34333
- Recall: https://www.recall.it/pricing · MCP https://docs.recall.it/public-api · review https://productivematters.substack.com/p/deep-dive-into-recall-ai
- Glasp: https://aiindigo.com/blog/glasp-review-2026-social-highlighting-or-just-another-bookmark-folder · https://glasp.ai · Curius: https://chrome.google.com/webstore/detail/curius/fbpnbdifockifjiimogdjndhpmmfgjkl
- RemNote: https://alpha.remnote.com/blog/remnote-vs-anki · https://apps.apple.com/ae/app/id1545429784
- Mochi: https://mochi.cards/pricing/ · https://mochi.cards/docs/api/
- Anki: https://en.wikipedia.org/wiki/Anki_(software) · stewardship https://forums.ankiweb.net/t/ankis-growing-up/68610 · AI-card thread https://www.reddit.com/r/Anki/comments/1ws2ih0/
- LLM flashcards critique: https://www.greaterwrong.com/posts/3LcyoqNTJuCZ65MbL/mo-putera-s-shortform/comment/gYcTraQTA6tbeXaqB · https://dev.to/alexrchen/why-llm-generated-flashcards-are-usually-bad-and-how-to-screen-them-20mi
- Obsidian: Web Clipper https://addons.mozilla.org/sr/android/addon/web-clipper-obsidian/versions/ · SR plugin https://community.obsidian.md/plugins/obsidian-spaced-repetition · FSRS https://community.obsidian.md/plugins/fsrs · Mnemoloop https://community.obsidian.md/plugins/mnemoloop
- Defuddle: https://github.com/kepano/defuddle
- Heptabase: https://wiki.heptabase.com/roadmap · https://toolradar.com/tools/heptabase/pricing · MCP (archived) https://github.com/LarryStanley/heptabase-mcp
- Kortex/Eden: https://eden.so/help/kortex-to-eden-everything-you-need-to-know · https://toolradar.com/tools/kortex/pricing
- Reflect Open: https://reflect.app/blog/reflect-open · https://yespress.io/products/reflect.md
- Capacities: https://toolradar.com/tools/capacities/pricing · MCP https://glama.ai/mcp/servers/Nyrest/capacities-mcp-v2
- Readlang: https://readlang.com · https://forum.readlang.com/t/is-readlang-free/47
- NotebookLM flashcards: https://bibigpt.co/en/features/notebooklm-flashcards-quizzes-explained
- Newcomers: https://beemind.app/blog/best-read-it-later-apps · https://cuadernote.com/en/blog/app-turns-notes-into-flashcards/ · Acorny https://www.reddit.com/r/SideProject/comments/1ugz85e/ · Highlight Notes https://www.reddit.com/r/macapps/comments/1wxk50n/ · Resurf https://www.reddit.com/r/macapps/comments/1t2j5k0/
- Read-later comparisons / sprawl: https://www.reddit.com/r/PKMS/comments/1gjc48i/ · https://www.reddit.com/r/macapps/comments/1tmdtlm/
