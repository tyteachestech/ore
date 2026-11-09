# Review: place, process and in-app AI

> **Status:** accepted 2026-10-24 and built. Recorded as D58 to D62 in [`DECISIONS.md`](../DECISIONS.md). This is the plan Tyler approved; the decisions file is the source of truth where they differ.

## Summary

The app opens on a Home page with a daily time goal, skill strength, recent sources and a Start review button. You can pick skills first, or just press ↵. Review itself is a full-window focus mode where each card takes a few keystrokes. In-app AI works on both of Tyler's subscriptions, with no API keys, when the app drives the official `claude` and `codex` programs, as it already does for enrich. That gives an "Ask about this card" chat after each answer. For motivation, build delight and growth now: motion, a goal ring and skills that visibly grow. Social comes later.

Decisions (each one is in the last section):

1. Home becomes the default page, with review started from it, as a full-window mode.
2. Fact cards are flipped and self-rated; only Explain cards are typed and graded by AI.
3. A daily time goal (10 minutes, weekends optional), plus a limit of 10 new cards a day.
4. Chat about a card, only after you've answered it, through the CLIs.
5. Replace D23's "no streaks, no XP" with an evidence-checked list of what's allowed.

## In-app AI on your subscriptions

Yes, on both, as long as the app drives each vendor's own program and never handles your login itself. That's how enrich and grading already work (D7). Neither vendor needs to approve a personal app that runs on your own Mac.

| Route | Allowed for Ore? | What it gives us |
| --- | --- | --- |
| Run the unmodified `claude` program, signed in with your Pro/Max plan | Yes. Anthropic's terms say they don't prevent "an end user from signing in to the unmodified Claude Code binary with their own Claude subscription" ([legal page](https://code.claude.com/docs/en/legal-and-compliance)) | Streaming chat: one `claude -p` process per conversation in stream-json mode, resumable by session id |
| Agent SDK, or reading Claude's login tokens, on the subscription | No. "Including the Agent SDK" is named as not permitted ([The Register](https://www.theregister.com/software/2026/02/20/anthropic-clarifies-ban-on-third-party-tool-access-to-claude/5014546)) | Avoid |
| `codex app-server`, signed in with ChatGPT | Yes. This is OpenAI's own way to embed Codex: JSON-RPC over stdin and stdout, with streamed message deltas and saved threads ([overview](https://codex.danielvaughan.com/2026/04/21/codex-app-server-architecture-custom-client-integrations/)) | The same streaming chat for ChatGPT |
| "Sign in with ChatGPT" developer kit | Yes, without a waitlist. Plan usage is open to "personal projects that run locally" ([OpenAI cookbook](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt)) | Calls without any CLI installed. Useful only if we ship the app to other people |

OpenAI's partner program for paid, hosted apps (Notion was one of 16 launch partners on 29 September 2026, [details](https://max.nardit.com/articles/notion-chatgpt-token-sharing)) has a waitlist; a local personal app doesn't need it.

How it's built: the AI adapter gets one streaming `chat()` call beside `runAgent()`, with a Claude implementation and a Codex implementation, picked by the same `ai:` setting. No plugin is needed. Starting the `claude` program takes a few seconds, so review never waits on it. The model answer shows immediately, and the AI's rubric marks arrive a moment later, the same pattern as the quiz (D56).

If the app ever goes to other people, each person signs in to their own CLI, which both vendors allow. Running Claude Code inside a product we distribute falls under Anthropic's commercial terms, so this needs another look at that point.

## Home, and where review lives

The app opens on a Home page, and that's where review starts. ⌘R and a sidebar count are ways to reach it. A home answers "what should I do now?" at a glance, the way Duolingo's home does, and it gives skill strength a place to live. "All sources" stays one click away in the sidebar.

| Home section | What it shows | Keys |
| --- | --- | --- |
| Today (top) | A ring for today's goal ("6 of 10 min"), what's due, a Start review button and a row of skill chips | ↵ starts review. ⌘R does the same from anywhere |
| Skills | Skills grouped by collection, each with its icon, its strength (solid memories plus a small growth line) and how many cards are due today | Arrows to move, ↵ opens the skill page |
| Continue reading | The 3 to 5 sources read most recently, each with its position bar | ↵ resumes where you stopped |

Picking skills: every chip is on by default, so Start review is still one key. Clicking a chip toggles it, and clicking a collection name toggles all of its skills. ⌥-click solos one skill, the way ⌥-click solos a track in Final Cut and Logic; ⌥-click it again turns all back on. The choice holds for the rest of the day. Leaving a skill out only means its cards wait. They aren't penalized, since FSRS handles a late review well. The one cost is less mixing of topics in that session.

In a session, review is a full-window focus mode: a thin bar for the session, one card at a time, and a key-hint footer. After you answer a card drafted from a highlight, its passage opens at the right (D55); it never shows before you answer (D34.4). Other ways in: the end of a finished source, the skill page header ("Review AI · 4", which pre-selects that skill), and Raycast's Review Due, which opens the app straight into review.

## The review process, card by card

A Fact card takes 2 keystrokes; an Explain card takes your typed answer plus 3. Typing answers to facts is slow and adds little. Explaining in your own words is the main goal (D1), so only Explain cards are typed and checked by AI.

**Explain card** (open-ended prompt with a rubric)

1. Read the question and type your answer, or press ⌘⌫ for "No idea".
2. Say how sure you are: 1 Guess, 2 Think so, 3 Sure (before you see anything, D21).
3. ⌘↵ Check: the model answer and its 2 to 4 rubric points appear at once. The AI's got-it or missed-it marks arrive a few seconds later, and you can click a mark to flip it (as in D56).
4. The AI proposes a rating. ↵ accepts it, and keys 1 to 4 (Again, Hard, Good, Easy) override it. Your rating is what FSRS records (D21).

**Fact card** (term or fact)

1. Read the question and recall the answer in your head.
2. Press 1, 2 or 3: that records how sure you were and reveals the answer in one keystroke.
3. Rate with 1 to 4, or ↵ for Good.

**On every card**

- A miss (Again) comes back once, about three cards later (D21). A miss you marked Sure adds one line: "You were sure about this one. Worth a careful look."
- A new draft says New. After you answer it, E edits the question or answer in place, and ⌘⌫ retires it. That first review is how a draft is finished (D20); changes save through `ore card edit`.
- After you answer, / opens "Ask about this": a chat that sees the card, its rubric, your answer and the source passage. It can explain, give an example, or suggest a better card, which you apply with one click. It's never available before you answer, and it never sets the rating.

## Daily goal and daily shape

The goal is time, not a card count. A count rewards rushing; a time goal gives full credit to one slow, careful Explain answer. Only active time counts: each card adds at most 3 minutes, so a card left open while you're away doesn't fill the ring.

| Piece | Proposal | Why |
| --- | --- | --- |
| Daily goal | Minutes a day, 10 by default, set on Home. A "Weekdays only" switch makes Saturday and Sunday neither count nor break anything | A daily cue builds the habit fastest (brief §10). Skipping weekends is the grace the evidence asks for |
| When nothing is left | Once due and new cards run out, today counts as complete even short of the goal: "All caught up, today counts." | The goal must never push you into cramming cards that aren't due yet (brief §5) |
| A missed day | Nothing resets to zero. Home shows "4 of 5 days this week" and your total review days | Hard resets raise quitting by 32%; repair keeps most of the streak's benefit (brief §10) |
| Goal reached | A short celebration on the ring, then "Keep going" or Done | The delight moment, tied to effort spent, not cards counted |
| New cards | Up to 10 new drafts enter review each day, freshest source first (`new_per_day` in `skills.yaml`) | Each finished source adds 3 to 8 cards, so without a limit sessions balloon |
| Reviews | Never capped, and never squeezed to catch up | Late is cheap; cramming is costly (brief §5) |
| Reminder | One macOS notification at a time you pick, only when the goal isn't met yet. The menu bar shows the ring | One reminder plus a cue is the brief's minimal nudge |

## Delight and gamification

One rule makes gamification safe here: reward what you remember, never how much you did. Volume counts (cards reviewed, minutes) are easy to game and barely predict learning, and "% correct today" runs against durable learning (brief, "not supported" list). Feedback that tells you something keeps intrinsic motivation intact. Expected rewards for an interesting task cut it (d = −0.40, Deci 1999).

| Mechanic | When | How it stays on the right side of the evidence |
| --- | --- | --- |
| Motion and feel: the card springs in, rubric marks tick in one at a time, a key press gives a tiny response, the session bar fills | Now, with Review | Pure feel. Off under Reduce Motion |
| End-of-session moment: "18 memories kept, 4 rescued just before you'd have forgotten them" with a short animation | Now | "Rescued" means a card whose recall chance had dropped below 85%, a real number taken from FSRS |
| Skill growth: each skill counts its solid memories (cards that hold for 21 days or more), shown as a growing line on the skill page, with levels at thresholds | Now | It rises only as retention rises, and dips gently when you forget. It can't be farmed |
| Daily goal ring: "4 of 5 days this week", weekends optional, total review days beside it | Next | Broken streaks drop you below baseline (45% vs 65%), while repair rescues most of it (85% vs 69%). So it never resets to zero; each week simply starts fresh |
| Calibration: "When you say Sure, you're right 86% of the time" | Next | Uses the confidence you already record. The brief ranks this #8 |
| Social: share a skill's growth, keep weekly rhythms with friends | Later | Kept private by default. No global leaderboards until we look at the evidence for a social version |
| XP for volume, hard-reset streaks, random rewards, guilt notifications ("your streak is dying") | Never | The brief's "not supported" list |

## Decisions and build order

| # | Decision | Changes | Recommendation |
| --- | --- | --- | --- |
| 1 | Home is the default page: today's goal and Start review, skill picking with ⌥-click solo, skills with their strength, and Continue reading. Review runs as a full-window mode. ⌘R and Raycast lead there too | D28 (navigation), D29 (Review was "later"), D46 (skill page keeps its role) | Yes |
| 2 | Fact cards: 1 to 3 reveals the answer, then you rate. Only Explain cards are typed and graded by AI | D21 (typed answer on every card) | Yes |
| 3 | A daily goal in minutes of active review (10 by default, weekdays-only switch) that counts as met when nothing is left. Up to 10 new cards a day; reviews never capped | D23 ("no quota, no daily cap") | Yes |
| 4 | "Ask about this" chat after each answer, through the `claude` program and `codex app-server` on your plans | D7 (adds streaming chat), D34.3 stands | Yes |
| 5 | Motivation: build the mechanics in the table above that reward memory and effort, and rule out volume rewards and hard resets | D23, D26, D57 (motion, goal ring, celebration) | Yes. Sound stays off unless you want it |

Build order:

1. Data-safety fixes from the [foundation check](../reviews/2026-10-24-foundation-check.md): automatic local commits in the library, and a note save that refuses to overwrite a file someone else changed.
2. Home and review core: the new-card limit, active time and goal in `ore due` and `ore stats`, the Home page, the Review mode with skill picking, and the Raycast deep link.
3. Delight v1: motion, the end-of-session moment, and skill growth (`ore stats` gains a solid-memories series).
4. Chat: `chat()` in the adapter for both vendors, plus "Ask about this".
5. Next: weekly rhythm, calibration, and the menu-bar reminder.
