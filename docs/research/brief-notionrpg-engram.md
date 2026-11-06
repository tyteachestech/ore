# Fact brief: NotionRPG, NotionRPG-app and Engram (harvested 2026-10-09)

Two NotionRPG generations: Notion system at ~/Desktop/projects/notionrpg; native Swift app at ~/Desktop/projects/notionrpg-app (last commit 2026-10-05). App renamed: Notion "Highlight" record -> Discovery; "Highlight" = colored text only; passage->Discovery link = Reference.

## 1. Highlight types
Notion (notionrpg-app/docs/research/notion-inventory/db-learning.md:262-370): Key Point (blue), Question (red), Application (green), Connection (brown), Thought (gray). Connection/Thought undefined leftovers; templates exist only for first three.
App (docs/design/spec-learning-foundation.md, founder-confirmed 2026-08-30):
- Highlight = colored mark, "optional signal, not a record, card, or progress event".
- Discovery = title + Details + type (Key Point / Question / Application).
- Key Point: "the thing worth remembering"; only type that may produce cards (0..n).
- Question: something the source hasn't answered; ends Answered or Continue as Inquiry. Never makes cards.
- Application: possible use of the idea; ends Complete or Turn into Quest. Never makes cards.
- Selected-text menu: Highlight / + Discovery (Key Point, Question, Application) / Add Reference.
Science rationale (docs/research/evidence-learning-notes.md): highlighting = small memory benefit, no reliable comprehension benefit, bad highlighting harmful (Ponce 2022; Mason 2024) -> no credit for highlighting. Self-explanation/paraphrase help; storing links has no effect (Bisra 2018; Chi 1989). Zero cards per idea is valid. AI-authored cards not proven equal to self-made; never call AI generation "active learning". Three-action menu is a cognitive-load inference, untested.
Inquiry loop (notionrpg/memory/knowledge-inquiry-loop-design.md): questions are "menu, not backlog"; pretesting d=0.44 to >2.0 (Pan & Carpenter 2023); self-explanation g~0.35; "answered inquiries are prime flashcard material; offer, never require".
Later loosening (notionrpg/.agents/skills/learning-make-cards/SKILL.md; AGENTS.md:285-300): card material = union of engagement signals (yellow highlights, RefIDs, Highlight rows, Tyler's own notes, passages his notes discuss). "No structured Key Points required." "Bias toward more cards rather than fewer." "Do not assign annotation chores." "Highlights as pointers, not boundaries."

## 2. Knowledge/skill model, weighting, XP
Notion: Source Notes (Source/Project/Inquiry) -> Skills (Priority Override P1-P4 -> weight 4-1, else inherit max linked Identity priority; Add To Review toggle) -> Flashcards (Open-ended/Q&A/MC; Bloom Recall/Apply/Analyze; FSRS fields; Confidence 0-100) -> Practice Log (one row per graded card, session start receipts, Voided flag).
Skill-weighted ordering history: 2026-04-27 Importance Boost = weight x 15 added to Today Score. 2026-07-07 removed. 2026-07-19 "Separate learning importance from FSRS urgency": priority ranks Skills for review SCOPE only. Current rule (AGENTS.md, PRODUCT_DOCTRINE.md, ADR-0010): "Skill or Identity importance must never boost or reorder FSRS cards"; skills are optional filters; all due cards enter queue. No documented rationale for weighted FSRS beyond this reversal.
XP: quest XP deleted 2026-06-24; knowledge XP flat 1/attempt 2026-07-01; banked XP deleted; XP Log -> Practice Log. Doctrine bans badges, streaks, variable-ratio rewards, leaderboards, XP, point balances.
FSRS: Notion ran FSRS-4.5 via one automation; no optimizer (3 lifetime grading events). App scheduler is NOT FSRS: Missed 10m, Partial 1d, Recalled x2 (<=180d), Easy x3 (min 4d, <=365d); ReviewLog kept for future replay.

## 3. Research docs
1. notionrpg/docs/science-schema-contracts/learning.md (2026-07-02): retrieval default g=0.51; instigation habit; spacing integrity; feedback ~30% of testing effect; reward behavior not accuracy; interleave discrimination material, block definitions (g=-0.39). Excluded: schedule-shape optimization, learning styles, modality, volume rewards, "rate your understanding", separate elaboration module. KEY: binding constraints were instigation (starting sessions) and card supply, not review mechanics. Built Needs Cards queue, Start Review receipt, daily target min(quota, done+due), calibration/hypercorrection from Engram. Rejected Anki/Readwise as sync seams.
2. notionrpg-app/docs/research/evidence-learning-notes.md (2026-08-30): see section 1. No OSS Notion-clone editor; keep domain model editor-independent.
3. notionrpg-app/docs/research/notion-brief-learning-notes.md: preserve My Notes separate from Source Material, one Discovery referenced from many passages, exact-passage backlinks, daily quota, Skills as filters.
4. notionrpg-app/docs/design/spec-learning-foundation.md: 4 card types: Open Recall (expected-point checklist), Q&A, Fill-in-the-Blank, Application (scenario/response/reasoning checklist). AI never sets rating or schedule; "Review with AI" advisory. Space reveals, 1-4 rates. Precedents: Apple Notes, Notion, Quizlet, Mochi, RemNote, Anki.
5. notionrpg-app/docs/research/metrics/review-retention.md (2026-09-10): retention metric adapted from Anki; exclude first rating, re-asks after miss, early reviews; partial = fail; never show trend (n=10 -> CI 49-94%).
6. notionrpg/.agents/skills/learning-make-cards/references/*: open-ended + Q&A default; MC only for confusable concepts; atomic; 2-4 element rubric; "Optionally..."/"Avoids..." rubric prefixes; utility filter.
7. notionrpg/docs/notionrpg-rubric/principles.md LS-01..07: retrieval before rereading, feedback, spacing integrity, process rewards, content-type interleaving, learning vs performance mode, session-start habit.
8. Audits: machinery "unusually evidence-literate"; corpus 6 cards from 1 of 10 source notes; 3 grading events ever.
9. Primary evidence source: ~/Desktop/library/guidebooks/learning-science/Learning-Science_Design_Reference.md.

## 4. UX lessons / abandoned
- Failure mode named: "built but dormant" (PRODUCT_DOCTRINE.md). "Validate before extending; expect the finding to be simplification."
- Cut: Skip buttons, summary buttons, Notes Status/Turn In, banked XP, Deck, Daily Gain, Readwise-sync props, separate Submit/Next (now one rating click), RefID plumbing.
- App drift: days spent on gateway hardening not core workflows; Mac selection menu never built ("needs a selection publisher in the block editor"); scheduler still simple; founder real-use acceptance pending. Scope too large: 7 domains, Mac+iPhone equal.
- Taste notes (finish-app-intent-2026-09-04.md): Raycast minimalism, calm dark frame, autosave, easy capture, keyboard reachability.
- AI access: MCP server + CLI (notionrpgctl), BYO subscription, no hosted inference (ADR-0003); 8 learning_* tools; full read/write without approval by default (ADR-0015).

## 5. Engram
- Third-party plugin (github.com/nagisanzenin/engram) v1.15.1 at ~/.claude/plugins/cache/engram/engram/1.15.1.
- Storage ~/.claude/learning/ (ENGRAM_HOME): learner-model.json (FSRS params, desired_retention 0.9, interval_multiplier, goals, commitment cue), graphs/<topic>.json, receipts/<topic>.jsonl (append-only), misconceptions.json, sessions.jsonl, experiments.json, artifacts/, audits/, gold/, exports/. Older home ~/.claude/learning-claudecode/.
- Graph node: claim, probe, rubric[], transfer_probe, why_chain[], edges{requires, derives_from, contrasts_with, analogous_to}, arbitrary, threshold, kind (concept/procedure/fact), viz, fsrs{s,d,due,last,reps,lapses,dose}, state, artifact, arc. Capstone node per topic.
- Receipt: id, ts, topic, node, kind (encode/review/pretest/transfer/audit), probe, production (<=2400 chars), confidence, grade (recalled/partial/lapsed), rating, misconceptions, rubric_notes, s_before, s_after, interval_days, retrievability, ...
- FSRS-4.5 default weights; optional refit (>=50 receipts); retention clamped 0.70-0.97; first two intervals capped 3 and 9 days; due --cap orders by retention saved per minute; failed transfer probe doesn't touch schedule.
- /learn: re-anchor -> intake -> curriculum-architect builds graph -> pretest/frontier -> 8-beat encode (gap, predict, struggle, resolve, self-explain, connect, verify, close) -> confidence before feedback -> blind assessor grades -> capstone -> implementation intention -> log-session.
- /review: session-start, due --cap ~12 (5 quick), interleaved; probe only -> free recall -> confidence -> reveal + gap analysis -> rate; miss -> relearn loop; mature nodes get transfer probe; amnesty after absence; assessor audit for >=8 items; no streaks.
- CLI: python3 engram.py <cmd> JSON stdout: init, path, session-start, topics, add-topic, next, topic-status, due, rate, receipt, stash, model, focus, visuals, artifact, misconception, experiment, log-session, stats, adherence, retention, decay, commit, refit, report, export, retire, edit-node, doctor, gold, assessor-audit, grader-health, transfer, capstone, propose, adaptations, selftest. Mutating cmds lock. Concept-node based, not passage based; no skill weighting.
- State: 3 topics (async-tech-video-pedagogy 21 nodes/7 due; storytelling 7/3; typescript 7 new); 26 receipts; last learn 2026-08-14; last session 2026-08-29; ~40 days overdue. Cue: "in the morning after my physical therapy."

## 6. Capture tooling
- Readwise bridge skill (2026-04-27) retired 2026-07-07 ("zero references").
- Data-flow sketch: Books, Newsletters, YouTube, RSS, AI Deep Research, Audiobooks, Podcasts; tools Snipd and Reader; "Flashcards weighed against associated goal, skill priority, current mastery".
- source-ingest skill: web trafilatura -> curl+pandoc -> browser; YouTube yt-dlp VTT; PDF pdftotext/pymupdf; epub/docx pandoc; verbatim floor; chunk by source structure; books >50k words split by chapter; audio out of scope.
- Inbox: macOS Shortcuts Quick Add / Voice Capture into Notion; ChatGPT desktop recurring task routes twice daily.
- Not found: Zotero, Raindrop, Matter, Instapaper, Pocket, Kindle.
