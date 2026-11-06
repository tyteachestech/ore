# Technical options brief: Mac-first, AI-first, local-first learning app

Date: 2026-10-09. Audience: the planner. Scope: shell, ingestion, highlight anchoring, storage for agents, FSRS, background AI, quick capture, then 3 stack options.

Confidence tags: **[V]** checked against a primary or near-primary source during this research; **[S]** secondary source (blog or aggregator); **[M]** from memory, not re-verified. Licenses are [M] unless marked.

---

## 0. The five decisions that matter most

1. **One canonical text form per document.** Convert everything (web, newsletter, transcript, X thread, Markdown, OCR'd images, EPUB chapters, and optionally PDFs) into one normalized HTML/Markdown representation. Then you need one highlight-anchoring system, not five. PDFs and EPUBs are the only formats where an "original layout" view is worth keeping.
2. **The reader is a web view, whatever the shell.** Every serious option ends up rendering documents in WebKit or Chromium (pdf.js, foliate-js, sanitized HTML). So the shell choice is about Mac polish, capture surfaces and background work, not about rendering.
3. **Files are canonical; SQLite is a disposable index.** Agents read and write plain files. The app rebuilds the index from them.
4. **One FSRS implementation, in one language.** Keep the scheduler where both the app UI and the agent CLI can call the same code. Priority is a queue-ordering layer on top, never a change to FSRS math.
5. **Deterministic jobs are separate from AI jobs.** Ingestion, transcription, indexing and scheduling run in the app or a LaunchAgent with no LLM. Only enrichment (summaries, card drafts, link suggestions, cleanup) goes to Claude Code or Codex, and that work must tolerate being skipped when the laptop is asleep.

---

## 1. App shell

### How Raycast is built (the reference point) [V]
Raycast 2.0 (public beta May 2026, replaced v1 around Aug 2026; Apple Silicon and Tahoe) moved from mostly-native Swift/AppKit to a **thin native host (Swift + AppKit on Mac, C#/WPF on Windows) + one React/TypeScript UI in WKWebView + a long-lived Node backend + a Rust core (data layer, file indexer)**. The native host owns windows, global hotkeys, the menu bar and process supervision. The team rejected Electron (didn't want to bundle Chromium, needed fine OS control) and Tauri ("less native control", young).

What they had to work around in WKWebView: keeping the window at alpha 0 with occlusion detection off so WebKit doesn't throttle rendering; keeping the web view at full size to avoid blank frames; overriding `NSWindow.setFrame` to stop resize stutter; using a private presentation-update hook to avoid flashes on open. Popovers and tooltips are native windows. They use translucency and Liquid Glass natively. Costs: memory went from about 200–300 MB to 350–450 MB, there are four runtimes to debug, and IME and drag-and-drop need extra work. Benefits: hot reload and much faster iteration.

**Takeaway:** "native shell + web UI" is what a top Mac-polish team picked in 2026. A learning app with a document reader fits this pattern even better than a launcher does.

### Comparison

| | Native SwiftUI/AppKit + WKWebView reader | Tauri 2 (Rust + web UI) | Electron | Pure web app (localhost + browser) |
|---|---|---|---|---|
| Mac polish (menus, shortcuts, vibrancy, Liquid Glass, window mgmt) | Best. Real NSMenu, NSPanel, `glassEffect`, Services, Share/Safari extensions in the same Xcode project | Good. Native menus, `global-shortcut` plugin, `window-vibrancy` crate, `tauri-nspanel` community plugin for Raycast-style panels [M]. No real Liquid Glass; Share/Safari extensions need a separate Swift target bolted on | OK. Vibrancy and `type: 'panel'` exist; Liquid Glass only through native add-ons [M]. Linear, Obsidian and Notion desktop are Electron, so "good enough" is achievable | Weak. No global hotkey, no panels, browser chrome. A PWA helps a little |
| Highlight rendering across PDF/EPUB/HTML | WebKit (WKWebView). CSS Custom Highlight API supported (Safari 17.2+) [M]. pdf.js and foliate-js run fine. PDFKit is an extra native option for PDFs | Same WebKit engine on Mac, so identical to native+WKWebView | Chromium: best pdf.js and DevTools experience, consistent rendering | Whatever browser you use |
| Dev speed with AI coding agents | Slowest for the Swift parts (Xcode project files, signing, entitlements, AppKit quirks). Fine if Swift is kept to a thin shell. This machine already has an Xcode MCP server, which helps agents build and run | Fast. Agents are strong at TS + Rust. Main friction is Rust compile times and Tauri capability/permission config | Fastest for JS-only teams; largest example corpus | Fastest of all |
| Bundle / memory | Small (Swift shell around 40 MB RSS plus WebContent) | ~5–15 MB bundle, low idle memory [S] | 100–200 MB bundle, 200–300 MB idle [S] | n/a |
| Background jobs | LaunchAgent/login item via `SMAppService`, `NSBackgroundActivityScheduler`, FSEvents, menu-bar agent | Rust threads, sidecar binaries, menu-bar tray; LaunchAgent possible but manual | Node main process; LaunchAgent manual | A server process you have to keep alive yourself (launchd) |
| On-device AI | Direct access to Foundation Models (on-device ~3B model, ~4K context [S]), SpeechAnalyzer, Vision `RecognizeDocumentsRequest` | Only through a Swift sidecar/plugin | Only through native modules | No |

**Gotchas**
- WKWebView runs out of process; one reused web view across many SwiftUI views is a known pain point [S]. Use one long-lived web view per window and switch documents inside it (Raycast's approach), not one per document.
- Tauri and native-with-WKWebView share every WebKit quirk. Pick Electron only if you need Chromium-specific behavior (none identified for this app).
- Anthropic shipped a Swift package that plugs Claude into Apple's Foundation Models framework (June 2026), but it targets **macOS 27** and uses an API key [V]. Only the native route gets this for free.

---

## 2. Ingestion and normalization

Target output for all sources: `doc.md` (or sanitized `doc.html`) + metadata + original kept as `source.*`.

### Web pages
| Tool | Runtime / license | Notes |
|---|---|---|
| **Defuddle** (kepano) | TS, MIT [M] | Readability successor built for Obsidian Web Clipper. Multi-pass (expands when it gets too little), normalizes footnotes and code blocks into one format, pulls schema.org metadata, outputs Markdown. Has a CLI (`defuddle parse <url> --md`). README still says "work in progress"; little automated testing; one report of failure in a Chrome service worker where Readability worked [S]. **Best default for this app.** |
| **Mozilla Readability** | JS, Apache-2.0 | Conservative; sometimes drops useful content; keeps the original DOM rather than normalizing. Good fallback. |
| **trafilatura** | Python, Apache-2.0 (since v1.8) [M] | Strong on news and blogs and boilerplate removal; good batch/server choice. |
| **Jina Reader** (`r.jina.ai`) | Hosted API; ReaderLM-v2 weights open [S] | Jina was acquired by Elastic in Oct 2025 [S]. Endpoint status after the acquisition is unverified. Sends URLs to a third party; use only as a fallback for JS-heavy pages. |
| **Firecrawl** | AGPL-3.0; self-host is a multi-container stack; anti-bot layer is cloud-only [S] | Overkill for single-user. Skip. |

**Pattern:** capture the DOM **in the user's browser** (extension or Share sheet) and run Defuddle on that HTML. This handles paywalls, logins and JS-rendered pages without server-side scraping. Fall back to server-side fetch + Defuddle, then Readability, then Jina.

### PDF
| Tool | License | Fit |
|---|---|---|
| **pdf.js** | Apache-2.0 | The viewer and text layer for an "original layout" view. Required if you want highlights on the real page. |
| **PyMuPDF / pymupdf4llm** | **AGPL** (commercial license available) [S] | Very fast, no models, no OCR. Fine for a personal app; a problem if this is ever distributed commercially. |
| **Docling** (IBM) | MIT [S] | Best table fidelity in one 2026 survey (0.882 overall vs Marker 0.861) [S], but heavy, and one report of it never finishing a 780-page document [S]. Granite-Docling small VLM with MLX support exists [M]. |
| **Marker** | GPL-3 code + restricted model weights [S] | Good quality, Apple MPS support. License is the blocker for anything distributed. |
| **Apple Vision** | System framework | `VNRecognizeTextRequest` for OCR; macOS 26 added `RecognizeDocumentsRequest`, which returns document structure (paragraphs, tables, lists) [M]. Free, on-device, fast. Best OCR path for a native or Swift-sidecar build. |
| **PDFKit** | System framework | Native text extraction, selection and `PDFAnnotation` highlights. Option if the PDF view is native rather than pdf.js. |

**Recommendation:** keep the original PDF and show it with pdf.js. Generate a `doc.md` with pymupdf4llm (personal use) or Docling (if license-sensitive) for search, agents and "reflow" reading. Use Apple Vision OCR for scanned pages.

### EPUB
- **foliate-js** (MIT [M]): actively maintained, powers Foliate and Readest (Tauri 2 + Next.js). It works on DOM `Range`s internally but ships an EPUB CFI module and an overlay module for annotations. Paginated and scrolled modes switch without reload. Fixed-layout rendering is unfinished [S]. **Pick this.**
- **epub.js** (BSD-2): older, described as no longer actively maintained in 2024 [S]. Avoid for new work.
- Readest is the closest open-source reference implementation of "web-tech reader with highlights across EPUB/PDF in a Tauri shell".

### YouTube
- **Transcripts:** `youtube-transcript-api` (MIT, Python) and `yt-dlp` (Unlicense) both work **from a home IP**. From cloud IPs they get blocked, and a newer failure mode (`PoTokenRequired` on some videos) can't be fixed by proxies [S]. This favors **running fetches locally on the Mac**, not in a cloud routine. Expect ongoing breakage; isolate behind one adapter with a fallback chain: captions API → yt-dlp subtitles → download audio and transcribe locally.
- **Local transcription on Apple Silicon:**
  - **Apple SpeechAnalyzer / SpeechTranscriber** (macOS 26+): one LibriSpeech benchmark on an M2 Pro shows about 2.1% WER clean / 4.6% noisy and roughly 3x faster than Whisper Small [S]. ~30 locales, weak custom vocabulary, no diarization. Free and on-device. **Default for English.**
  - **whisper.cpp** (MIT) / **WhisperKit** (Argmax, MIT, CoreML) [M]: 100+ languages, custom prompts.
  - **Parakeet TDT 0.6B v3** (NVIDIA, CC-BY-4.0) via **parakeet-mlx** or **FluidAudio** (Swift/CoreML) [M]: very fast and strong on disfluent speech [S]; no verified head-to-head numbers vs SpeechAnalyzer.
- Keep timestamps in the canonical transcript (e.g. `<span data-t="123.4">`) so highlights can link back to video time.

### Audio files
Same transcription path as above. Store `source.m4a` + `doc.md` with timestamp spans.

### Markdown and images
Markdown is already canonical (sanitize, then copy). Images: Apple Vision OCR (or a vision LLM for diagrams) → `doc.md` with the image embedded and OCR text below it.

### X / Twitter threads (2026)
- **Official API:** pay-per-use has been the default since Feb 6, 2026: about **$0.005 per post read**, the free tier is closed to new signups, Basic and Pro are closed to new signups [S]. A 30-post thread costs about $0.15. Legitimate but needs a developer account and prepaid credit.
- **Unofficial free:** `api.fxtwitter.com` (used by `x2md`) [S]. Free, no login, can break any time.
- **Paid scrapers:** Apify actors such as a thread unroller (~$5 per 1,000 threads) [S].
- **Most robust for single-user:** capture from the **logged-in browser DOM** with your own extension (walk the author's replies on the thread page, serialize to Markdown). No API cost and no third party; it breaks when X changes markup, so keep the selector logic in one small module agents can fix.
- **Recommended chain:** browser-DOM capture (primary) → fxtwitter (URL-only capture from Share sheet or hotkey) → official API (optional, paid).

### Newsletters
| Option | Pros | Cons |
|---|---|---|
| **RSS first** | Substack, Ghost and Beehiiv publications expose feeds. Zero infrastructure. | Not every newsletter has one; some feeds are truncated. |
| **Dedicated forwarding address** (Cloudflare Email Routing → Email Worker + `postal-mime` → store in R2/D1 → Mac pulls) [S] | Clean separation, works from any client, free tier. This is how Readwise Reader does it (`@feed.readwise.io`) [V]. | Needs a domain and a small cloud component, which breaks pure local-first; app must poll. |
| **Gmail API with a label filter** | No new infrastructure; local pull. | `gmail.readonly` is a restricted scope. **Unverified OAuth apps in "Testing" status get refresh tokens that expire after 7 days** [M], which breaks unattended sync. |
| **IMAP + app password** to Gmail or a dedicated mailbox | Simple, local, no OAuth churn. | App passwords require 2FA and are a credential to store in Keychain. |

**Recommendation:** RSS where available + a dedicated address (Cloudflare Worker) for the rest. Run each email's HTML through Defuddle.

---

## 3. Highlight anchoring

### Data model
Use the **W3C Web Annotation Data Model** shape (JSON). It is stable, agents understand it, and Hypothesis/Readwise-style tools map to it. Store **several selectors per highlight**, as Hypothesis does [V]:
- `TextQuoteSelector` { exact, prefix, suffix } (about 32 chars of context each side) — the durable anchor.
- `TextPositionSelector` { start, end } as offsets into the **canonical plain text** of the document — fast path.
- Format-specific selector when needed: `FragmentSelector` with `conformsTo: http://www.idpf.org/epub/linking/cfi/epub-cfi.html` for EPUB; for PDF `{ page, quads/rects }` plus a quote selector on that page's text.

### Re-anchoring algorithm (Hypothesis "fuzzy anchoring" pattern) [V]
1. Try position; verify the text at that position equals `exact`. Done if it matches.
2. Else exact-search `exact`; use prefix/suffix to pick among duplicates.
3. Else fuzzy match (bitap/approximate string search) near the expected position, scoring by quote + context.
4. Else mark the highlight **orphaned** and keep it (show in a sidebar with the quote). Never silently drop.

Libraries:
- **approx-string-match** (Robert Knight, MIT) [M]: the fuzzy matcher the Hypothesis client uses. Small and dependency-free.
- **diff-match-patch** (Apache-2.0) [M]: alternative bitap implementation.
- **Hypothesis client** (BSD-2) [M]: the reference implementation (`anchoring/` directory: html, pdf via pdf.js text layer, text-range). Read and copy patterns rather than embedding the whole client.
- **Apache Annotator**: **retired from the Apache Incubator on 2025-08-11** [V]. Don't depend on it; reading its selector code is still fine.
- **Recogito text-annotator-js** (BSD-3) [V]: maintained, vanilla + React wrapper, data model "aligns closely" with W3C but differs. Usable for the UI layer if you don't want to write selection/highlight UI.
- **dom-anchor-text-quote / text-position** (MIT) [S]: tiny standalone packages; older but simple.

### Rendering
- Prefer the **CSS Custom Highlight API** (`CSS.highlights`, `::highlight()`), supported in WebKit (Safari 17.2+) and Chromium [M]. It paints ranges without mutating the DOM, so it doesn't fight re-anchoring or React. Fall back to `<mark>` wrapping only where needed (e.g. click targets).
- **Normalize text before anchoring.** The canonical plain text (whitespace collapsed, NFC, soft hyphens removed) is what offsets refer to. Hash it (`text_sha256` in frontmatter) so you know when re-anchoring is needed. If an agent edits `doc.md`, highlights re-anchor through the quote selector.

### PDF specifics
- pdf.js text layer: map selection → page text offsets → quote selector, and store page quads for exact redraw. Hypothesis's PDF anchoring works this way.
- **react-pdf-highlighter-extended** (MIT, v8.x) [S]: stores viewport-independent coordinates; you supply the storage. Maintenance in 2025–2026 unverified; fine as a starting point or to copy.
- **pdf-annotate.js**: old, effectively unmaintained [M]. Skip.
- Native alternative: PDFKit `PDFSelection` → `PDFAnnotation(.highlight)`. Easy, but writes into the PDF (or needs a sidecar) and doesn't share code with the HTML reader.

### EPUB specifics
foliate-js gives a DOM `Range` per highlight and can serialize to CFI. Store **both** CFI and a quote selector on the chapter's text. Foliate's own issue tracker warns that renderer switches broke stored annotations [S]; quote selectors are the insurance.

### Cross-format
If every format except PDF/EPUB "original view" is canonical HTML, one anchoring module covers web, newsletters, transcripts, X threads, Markdown and OCR text. For PDF and EPUB, also keep the highlight anchored to `doc.md` (reflowed text) so agents see highlights in one consistent text space.

---

## 4. Storage that agents can read and write

### Conventions in existing tools
| Tool | Format | Lesson |
|---|---|---|
| **Obsidian** | Markdown + YAML frontmatter, wikilinks, Bases (`.base` YAML views), JSON Canvas | The de-facto agent-friendly format. kepano publishes official agent skills (`kepano/obsidian-skills`) teaching agents the Obsidian CLI, Bases and Defuddle [S]. |
| **Readwise exports** | Markdown per source, highlights as blocks with location and `^id` block refs | Highlight-per-block with stable IDs works well for agents. |
| **Anki `.apkg`** | Zipped SQLite (+ media) [M] | Fine for interchange; terrible for agent edits. Offer export only. |
| **Mochi** | Markdown cards, `---` separates front/back [M] | Good model for agent-authored cards. |
| **Logseq** | Was Markdown outlines with `id::` properties; its new "DB version" moves to SQLite [M] | Shows the pressure files put on rich block-level features. Avoid block-level structure in files; keep it in sidecars. |
| **Engram** (installed on this Mac) | `~/.claude/learning`: JSON graph + JSONL receipts, stdlib Python, FSRS-4.5, lockfile, shared across Claude Code/Codex/other agents [V] | Real local proof that "files + JSONL + lock + one CLI" works across agents. Note it is on FSRS-4.5. Decide whether this app reuses, imports or replaces Engram's state. |

### Recommended layout (files canonical, SQLite derived)
```
Library/
  AGENTS.md                      # schema + rules for agents (CLAUDE.md symlink)
  items/<yyyy>/<slug>-<ulid>/
    doc.md                       # canonical readable text, YAML frontmatter (id, type, source_url, title, author, captured_at, text_sha256, priority, tags, status)
    source.pdf|.epub|.html|.m4a  # original, never modified
    annotations.jsonl            # one W3C-style annotation per line (highlights + notes), append/patch by id
    assets/
  cards/<deck>/<ulid>.md         # one card per file: frontmatter (id, source item, annotation id, priority) + Q/A body
  reviews/2026-10.jsonl          # append-only review log: {card_id, ts, rating, elapsed, state_before, state_after}
  state/fsrs.json                # optional cached card states (rebuildable from review log)
  inbox/                         # drop folder: anything here gets ingested
.index/library.sqlite            # FTS5 + sqlite-vec embeddings + materialized due queue; gitignored, rebuildable
```
- **Review log is append-only JSONL** and the source of truth for scheduling; card state can always be replayed. This also feeds the FSRS optimizer.
- **Concurrency:** atomic writes (temp file + rename), JSONL appends, an advisory lockfile for multi-file operations, FSEvents in the app to pick up agent edits. Put the library under git for history and undo of agent changes. Use iCloud Drive only with care (sync conflicts); Syncthing or git are safer.
- **SQLite:** GRDB (Swift), rusqlite (Rust) or better-sqlite3/bun:sqlite (TS). `sqlite-vec` is maintained, still pre-v1 (0.1.x releases through mid-2026) [S], brute-force KNN is fine at personal scale. FTS5 alone covers most search.

### How Claude Code and Codex should access it
1. **Direct file reads/writes + `AGENTS.md`** — zero infrastructure, works in both agents and in scheduled runs. Required baseline.
2. **A small CLI** (`learn` or similar) with `--json` output for operations that must be correct: `learn add <url|path>`, `learn due`, `learn review <card> <rating>`, `learn reindex`, `learn search`, `learn card add`. Both agents use CLIs well, and the CLI enforces invariants (IDs, review log, re-anchoring) so agents don't hand-edit JSONL. Package agent **skills** that teach the CLI (as Readwise and Obsidian now do).
3. **MCP server** — optional and later. Useful for Claude Desktop or ChatGPT (no shell), not needed for Claude Code or Codex. If built, make it a thin wrapper over the CLI.

Patterns worth copying:
- **Readwise** (Mar 2026 [S]): hosted MCP (`mcp2.readwise.io`) **plus** an official CLI (`@readwise/cli`) **plus** agent skills, explicitly for Claude Code and Codex [V]. The deprecated local npm MCP server was replaced. This "CLI + skills, MCP for chat apps" split is the right model.
- **Anki MCP servers** (nailuoGG/anki-mcp-server, stefanwille/anki-mcp-server) wrap AnkiConnect on `127.0.0.1:8765` and require Anki running [S]. Copy their tool surface (find_notes, add_notes, update_note_fields) for card operations; avoid the "GUI app must be running" dependency.
- **kepano/obsidian-skills**: skills teaching agents the Obsidian CLI and Defuddle [S].

---

## 5. FSRS

### Implementations [V unless noted]
| Library | Language | Scheduler version | Optimizer | License |
|---|---|---|---|---|
| **fsrs-rs** | Rust | FSRS-6 | **Yes** (also runs in browser via fsrs-browser) | BSD-3 [M] |
| **ts-fsrs** | TypeScript | FSRS-6 | Yes via `@open-spaced-repetition/binding` (native binding over fsrs-rs) | MIT |
| **py-fsrs** | Python | FSRS-6 | **Yes** (built in) | MIT [M] |
| **swift-fsrs** | Swift | Claims FSRS-6 (21-param `w`); examples default to v5 (19 params); no tagged releases; 55 commits | No | MIT |

- **FSRS-6 vs 5:** FSRS-6 has **21 parameters**; it adds a trainable forgetting-curve decay (w20) and better same-day/short-term review handling [S]. Anki 25.07 made FSRS-6 the default. Gotcha: with old 19-param sets Anki behaves like FSRS-5 until you reset and re-optimize [S]. Use FSRS-6 defaults from day one and run the optimizer once there are ~1,000+ reviews (rule of thumb [M]).
- **Optimizer location:** Swift has none. Practical choices are fsrs-rs (Rust shell or CLI), ts-fsrs + binding, or py-fsrs in a CLI or scheduled job. The optimizer is a monthly maintenance job, a good fit for an agent-run scheduled task calling the CLI.

### Adding priority without breaking FSRS
- **Anki forum consensus:** FSRS only decides *when* a card is due; priority is a separate concern. The closest built-in lever is **per-deck desired retention** (e.g. 0.95 for important, 0.85–0.90 for the rest). Anki has no per-card priority; add-ons imitate it [V]. Anki's review **sort orders** (e.g. retrievability ascending, relative overdueness) are the other lever; "expected knowledge gain" ordering exists only as an add-on [S].
- **SuperMemo:** a priority queue orders items by importance so the most important material is reviewed first under time pressure; priority is independent of interval length. In incremental reading, priority shifts over time (rediscovered material is up-prioritized) [V for the concept; mechanics such as auto-postpone not verified].
- **Recommended design (two levers, both outside the FSRS math):**
  1. **Priority → desired retention.** Map priority bands to target retention (e.g. P1 = 0.95, P2 = 0.90, P3 = 0.85). FSRS computes intervals from that, so the math is untouched and the optimizer still learns correctly from the review log.
  2. **Priority → queue order and overload handling.** Each day, sort due cards by `priority weight × (1 − current retrievability)` or similar. When the queue exceeds the daily budget, postpone the lowest-priority, highest-retrievability cards (SuperMemo-style auto-postpone). Postponement only delays the review; FSRS handles the longer elapsed time correctly at the next review.
  3. Never alter stability or difficulty for priority, and never hide priority inside ratings. Both corrupt optimizer training data.
- **Source-level priority** (reading queue) follows the same rule: it orders the incremental-reading queue; it never touches card scheduling directly.

---

## 6. Scheduled and background AI work on a Mac

| Mechanism | Runs where | Local files | Unattended reliability on a laptop |
|---|---|---|---|
| **Claude Code cloud routines** | Anthropic cloud, fresh repo clone | **No** (only what's in the GitHub repo) | High (machine can be off). Minimum interval 1 hour [V]. Works only if the library is a git repo pushed to GitHub, which means the data leaves the Mac, and YouTube/X fetches from cloud IPs get blocked. |
| **Claude Code Desktop scheduled tasks** | Your Mac | Yes | Medium. Runs only while the desktop app is open and the Mac awake; a missed run triggers **one** catch-up run on wake (last 7 days). Prompt stored at `~/.claude/scheduled-tasks/<name>/SKILL.md`; minimum interval 1 minute [V]/[S]. **Best fit for nightly library maintenance.** |
| **`/loop` in a session** | Your Mac | Yes | Low. Session-scoped, recurring tasks expire after 7 days [V]. For short babysitting only. |
| **launchd LaunchAgent + `claude -p`** | Your Mac | Yes | Medium-low in mid-2026. User-filed issues: "Not logged in" under launchd despite valid Keychain credentials; hangs at bootstrap in some 2.1.2xx versions; OAuth refresh-token races between headless and interactive sessions. Workarounds: `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN` (but setup tokens don't carry claude.ai connector grants), pin a known-good version, wrap with timeout and logging [S]. |
| **Codex app Automations** | Your Mac (desktop app) | Yes (worktree or local mode) | Medium. Needs the app running and the Mac awake; results land in a review inbox, empty runs auto-archive; RFC 5545 schedules [S]. |
| **`codex exec` under launchd** | Your Mac | Yes | Medium. Non-interactive, JSONL event stream, JSON-schema output, `--sandbox workspace-write` [S]. Auth is file-based (`~/.codex/auth.json`) by default [M], which may avoid the Keychain-under-launchd problem. Verify. |
| **ChatGPT scheduled Tasks** | OpenAI cloud | No | Reminders and web lookups only. Not useful for local library maintenance. |

**What actually runs reliably unattended on a laptop in 2026:** nothing that requires the machine to be asleep. Design for **"runs when awake, catches up once"**:
- Deterministic work (ingest queue, transcription, re-indexing, due-queue materialization, newsletter pull) runs in the **app's own LaunchAgent/menu-bar helper** with no LLM dependency. That part is highly reliable.
- AI maintenance (draft cards from new highlights, summarize, tag, link, find orphaned highlights, monthly FSRS optimize) runs as a **Claude Code Desktop scheduled task or Codex automation** that calls the app's CLI and is idempotent (each job processes "everything not yet processed", tracked in files).
- Optional: `pmset repeat wake` to wake the Mac at a fixed time on power [M], or a dedicated always-on Mac mini.
- Cloud routines only if the planner accepts a GitHub-hosted library repo.

---

## 7. Quick capture on the Mac

| Surface | What it captures | Effort | Notes |
|---|---|---|---|
| **Global hotkey + floating NSPanel** | Typed note, clipboard, frontmost browser URL/title, selected text | Medium (native) / medium (Tauri with `tauri-nspanel`) | Non-activating `NSPanel`, floating level, `canJoinAllSpaces`/`fullScreenAuxiliary` collection behavior [M]. Must work when the main window is closed: keep a login-item helper (2Do and Things both hit this) [S]. Reading selected text or other apps' URLs needs Accessibility or AppleScript/Automation permission. |
| **Raycast extension** | Same, plus Raycast's own selection/browser APIs | **Low** (React/TS) | Strong shortcut for the "Raycast-style" goal: capture and search commands inside Raycast that call the CLI. Works with any shell choice, including the pure-web option. |
| **Share Extension** | URLs, files, text from any app's Share menu (and iOS later) | Medium; Swift target in the Xcode project | Native shell gets it almost free; Tauri/Electron need a separate Swift target. |
| **Safari Web Extension** | Full logged-in DOM of the page (best for paywalls, X threads, newsletters in webmail) | Medium | Ships inside the Mac app bundle; `xcrun safari-web-extension-converter` / `safari-web-extension-packager` [V]. Same WebExtension code also runs in Chrome. Native messaging to the containing app is possible [M]. |
| **Chrome extension** | Same, for Chrome/Arc/Helium | Low–medium | Can POST to a localhost endpoint or write via native messaging. |
| **Bookmarklet** | URL + selection, sometimes DOM | Lowest | Blocked by strict CSP on many sites [M]; fine as a fallback only. |
| **Finder drop folder** (`Library/inbox/`) | Any file (PDF, EPUB, audio, images, .md) | Low | FSEvents watcher; also the simplest way for agents to add things ("write to inbox/"). |
| **Clipboard watcher** | Copied URLs/text | Low | Privacy-sensitive; make it opt-in and show a capture toast, not silent. |
| **Services menu / Quick Action** | Selected text or files from any app | Low (native) | Cheap native win. |
| **Email address** | Newsletters, forwarded articles | Medium (see §2) | |

**What others do:**
- **Raycast:** global hotkey → floating launcher window; v2 is a native host window wrapping a web UI [V].
- **Things 3 Quick Entry:** global hotkey → small floating panel; **Autofill** pulls the frontmost app's link (per-browser adapters added release by release, e.g. Helium, ChatGPT Atlas; a macOS 26.1 Apple Mail workaround) [V]. Also a Spotlight/Control Center path that works even when Things isn't running [S].
- **Alfred:** hotkey + workflows/file actions [M]. **Linear:** global "create issue" hotkey in the desktop app (Electron) [M].

**Minimum capture set for v1:** hotkey panel (with frontmost-URL autofill), browser extension (Safari + Chrome, DOM capture), drop folder, Share extension if native. Add the Raycast extension early; it's cheap and fits the brand.

---

## 8. Stack recommendations

### Option A — "Raycast pattern": native Swift shell + TypeScript core + web reader
- **Shell:** SwiftUI + AppKit (menus, NSPanel quick capture, Liquid Glass, Share extension, Safari extension, Services, login-item helper, SpeechAnalyzer, Vision OCR, Foundation Models for cheap on-device work).
- **Reader and review UI:** one TypeScript/React bundle in a single long-lived WKWebView per window: canonical-HTML reader, pdf.js, foliate-js, CSS Custom Highlight API, Hypothesis-style anchoring with approx-string-match, ts-fsrs for the review screen.
- **Core + CLI:** the same TypeScript package compiled into a Bun CLI (`learn`) for ingestion (Defuddle, Readability), FSRS (ts-fsrs, optimizer via binding), indexing (bun:sqlite + FTS5 + sqlite-vec). Python helpers called by the CLI where Python is better (yt-dlp, youtube-transcript-api, pymupdf4llm/Docling).
- **Storage:** files canonical + SQLite index (as §4).
- **Background:** Swift login-item helper (FSEvents inbox, ingestion queue, transcription) + Claude Code Desktop scheduled tasks / Codex automations for AI maintenance.
- **Trade-offs:** best Mac polish and the only route to Share/Safari extensions, SpeechAnalyzer, Vision and Foundation Models without glue. Two languages plus Xcode. Highest memory of the three on paper (WebContent + shell), still well under Raycast 2.
- **AI-agent build speed:** medium. Agents produce the TS reader/CLI quickly; the Swift shell is where they stall (project files, signing, entitlements, WKWebView/NSPanel quirks listed in §1). Keep Swift to roughly 1–2k lines and the rest in TS. A polished v1 is realistic, but budget extra human QA time for window behavior and capture permissions. The Xcode MCP server on this machine helps agents build and run.

### Option B — Tauri 2: Rust shell + TypeScript UI
- **Shell:** Tauri 2 with `global-shortcut`, `tauri-nspanel` (Raycast-style panel), `window-vibrancy`, tray/menu-bar, sidecar binaries (Bun CLI, Python tools).
- **Core:** the same TS reader/review UI as Option A. Rust side holds fsrs-rs (scheduler **and** optimizer natively), rusqlite + sqlite-vec, the FSEvents watcher (`notify` crate), and the ingestion queue. The CLI can be the same Rust binary (one FSRS implementation for app and agents).
- **Mac-specific gaps:** Share extension, Safari extension and SpeechAnalyzer/Vision/Foundation Models need a small Swift target or helper. Liquid Glass is approximated with vibrancy. Readest proves the reader side works (Tauri 2 + foliate-js).
- **Trade-offs:** about 85–90% of native polish with a single web-tech UI. Smallest bundle; easy cross-platform later. Rust compile times; plugin ecosystem is younger; WebKit-only debugging via Safari Web Inspector.
- **AI-agent build speed:** fast. Agents are strong at TS and Rust and the docs are plentiful. Fastest route to a polished-looking app; the last 10% of Mac feel (panel focus behavior, menus, multi-display) needs targeted human testing.

### Option C — Local web app + CLI first, shell later
- **Shape:** a Bun (or Node) localhost server + the same TS UI in the browser (or installed as a PWA), the `learn` CLI, files + SQLite. Capture comes from a **Raycast extension** (hotkey panel substitute), a browser extension (DOM capture), and the drop folder; a LaunchAgent keeps the server and ingestion queue alive.
- **Trade-offs:** no real global panel, no Share extension, browser chrome around the reader, weakest "Mac app" feel. But nothing is wasted: the UI, CLI, storage and anchoring are exactly what Option A or B wraps later.
- **AI-agent build speed:** fastest. Agents can build and test it end to end headlessly (Playwright, CLI tests) with no Xcode or signing. Good for validating the learning loop (capture → read → highlight → card → review) within days, then choosing A or B with real usage data.

### Not recommended
- **Electron:** works (Linear, Obsidian), but it gives up the native frameworks that matter here (SpeechAnalyzer, Vision, Foundation Models, Share/Safari extensions) while adding ~150 MB and Chromium, and the Chromium rendering advantage isn't needed for this app.
- **Pure SwiftUI with native renderers** (PDFKit + custom EPUB + attributed-string HTML): three separate highlight systems and the weakest AI-agent velocity. Use WKWebView for documents.

### Shared across all three
Defuddle + pdf.js + foliate-js + canonical HTML; W3C annotations with quote + position selectors in `annotations.jsonl`; append-only review log; FSRS-6 with priority mapped to desired retention and queue order; `AGENTS.md` + CLI + skills for agents (MCP later, as a CLI wrapper); local deterministic jobs plus awake-time AI maintenance.

---

## 9. Open questions that change the outcome
1. **Is this ever distributed or sold?** Answered 2026-11-06 (D120): open source under the AGPL, never sold, so AGPL/GPL pieces (PyMuPDF, Marker) are allowed on the Mac; the iPhone app stays permissive.
2. **Will an iPhone/iPad companion follow?** Favors Option A (shared Swift + Share extension) or Option B (Tauri 2 mobile, less mature).
3. **Is a GitHub-hosted library acceptable?** That's what enables cloud routines for maintenance while the laptop is closed.
4. **Reuse Engram?** It already has local FSRS (4.5), JSONL receipts and multi-agent skills in `~/.claude/learning`. Import its history, integrate with it, or keep it separate.
5. **Target macOS version.** macOS 26 gets SpeechAnalyzer, Vision document recognition, Foundation Models and Liquid Glass; the Claude Foundation Models package needs macOS 27.

---

## Sources
- Raycast technical deep dive (2.0 architecture): https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast
- Raycast 2.0 beta coverage: https://devtoolpicks.com/blog/raycast-2-public-beta-windows-indie-hackers-2026
- Claude Code scheduling comparison: https://code.claude.com/docs/en/scheduled-tasks
- Desktop scheduled tasks summary: https://agentsroom.dev/blog/claude-code-routines-cloud-vs-local-scheduled-tasks ; https://rickhigh.substack.com/p/claude-code-the-two-claude-code-schedulers
- launchd + `claude -p` issues: https://claudeissues.com/issue/77213-not-logged-in-when-the-process-tree-starts-at-launchd-despite-valid-unexpired-ke ; https://claudeissues.com/issue/76052-headless-claude-p-wedges-at-bootstrap-when-spawned-by-a-macos-launchagent-regres ; https://claudeissues.com/issue/76905-macos-keychain-concurrent-sessions-race-on-oauth-refresh-setup-token-workaround ; https://amitkoth.com/claude-code-local-schedule/
- Codex automations / exec: https://openai.com/academy/codex-automations ; https://codex.danielvaughan.com/2026/04/08/codex-desktop-automations/ ; https://codex.danielvaughan.com/2026/05/03/codex-cli-non-interactive-pipelines-exec-resume-structured-output/
- Defuddle: https://cdn.jsdelivr.net/gh/kepano/defuddle@main/README.md ; https://hn.nuxt.dev/item/44067409
- PDF tools: https://themenonlab.blog/blog/best-open-source-pdf-to-markdown-tools-2026 ; https://www.file2markdown.ai/blog/pymupdf4llm-vs-docling
- Jina/Elastic: https://www.stocktitan.net/news/ESTC/elastic-completes-acquisition-of-jina-ai-a-leader-in-frontier-models-mcyv7yvvazne.html ; Firecrawl: https://webscraping.ai/faq/firecrawl/is-firecrawl-open-source-and-can-i-self-host-it
- foliate-js / Readest: https://github.com/johnfactotum/foliate-js ; https://readest.com/compare/readest-vs-foliate ; https://community.kde.org/GSoC/2024/StatusReports/Ajay_Chauhan
- YouTube transcript blocking: https://github.com/jdepoix/youtube-transcript-api ; https://github.com/jdepoix/youtube-transcript-api/issues/592 ; https://dev.to/jamhimself/why-your-youtube-transcript-scraper-started-returning-empty-strings-and-how-to-fix-it-in-2026-20ed
- SpeechAnalyzer vs Whisper: https://www.developersdigest.tech/blog/apple-speechanalyzer-vs-whisper-benchmark ; https://rohitraj.tech/notes/apple-speechanalyzer-vs-whisper-on-device-stt-2026
- X API pricing: https://bundle.social/blog/x-api-pricing-2026-costs-limits ; https://opentweet.io/how-to/x-api-pay-per-use-explained ; x2md: https://awesome.ecosyste.ms/projects/github.com%2Fyshmarov%2Fx2md ; Apify unroller: https://apify.com/lurkapi/x-twitter-thread-unroller
- Newsletters: https://docs.readwise.io/reader/docs/faqs/email-newsletters ; https://flaviocopes.com/cloudflare-email-workers.md
- Anchoring: https://web.hypothes.is/blog/fuzzy-anchoring/ ; https://incubator.apache.org/projects/annotator.html ; https://github.com/recogito/text-annotator-js ; https://pypi.org/project/anchorpoint/0.5.3/
- PDF highlighting: https://github.com/DanielArnould/react-pdf-highlighter-extended ; https://www.nutrient.io/blog/pdfjs-text-highlight-annotations/
- sqlite-vec: https://github.com/asg017/sqlite-vec ; https://rubygems.org/gems/sqlite-vec?locale=en
- Readwise MCP/CLI: https://docs.readwise.io/tools ; https://awesome.ecosyste.ms/projects/github.com%2Freadwiseio%2Freadwise-cli
- Anki MCP: https://mcpservers.org/servers/nailuoGG/anki-mcp-server ; https://glama.ai/mcp/servers/stefanwille/anki-mcp-server
- Obsidian skills: https://x-cmd.com/install/obsidian-skills
- FSRS: https://github.com/open-spaced-repetition/awesome-fsrs ; https://github.com/open-spaced-repetition/swift-fsrs ; https://github.com/open-spaced-repetition/ts-fsrs ; https://forums.ankiweb.net/t/bug-new-fsrs-6-parameters-not-appearing-after-reoptimizing/64921
- Priority: https://forums.ankiweb.net/t/does-fsrs-solve-priority-like-sm18-thx/38299 ; https://forums.ankiweb.net/t/ordering-request-reverse-relative-overdueness/50051 ; https://forums.ankiweb.net/t/expected-knowledge-gain-and-anki-vs-questions-dilemma/67322 ; https://supermemo.guru/wiki/Priority_queue
- Foundation Models: https://infoq.com/news/2026/03/apple-foundation-models-context ; https://claude.com/blog/claude-for-foundation-models
- Tauri vs Electron: https://dev.to/devtoolpicks/tauri-vs-electron-for-indie-hackers-in-2026-honest-comparison-o0e ; https://tech-insider.org/tauri-vs-electron-2026/
- Things Quick Entry: https://culturedcode.com/things/releasenotes/ ; https://en.wikipedia.org/wiki/Things_(software) ; 2Do: https://www.2doapp.com/docs/macos/quick-entry
- Safari extensions: https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari.md
- Engram (local): ~/.claude/plugins/marketplaces/engram/README.md, scripts/engram.py
