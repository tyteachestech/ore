# Product

<!-- impeccable:product-schema 1 -->

<!-- Written by `impeccable init` without an interview: facts come from the owner's brief, AGENTS.md, CONTEXT.md and docs/DECISIONS.md. Settled decisions live in docs/DECISIONS.md; this file does not override them. -->

## Platform

web (Tauri 2 desktop shell on macOS; WKWebView)

## Users

One user: Tyler, the owner. He reads articles, PDFs, EPUBs, transcripts and notes on his Mac, mostly from the keyboard, and wants what he reads to last.

## Product Purpose

Ore is a Mac-first, AI-first, local-files learning app: capture anything, read it, highlight it, answer AI-written prequestions, finish with a closed-book recall, then review AI-drafted cards on an FSRS schedule. Success is remembering what he read, not time spent in the app.

## Positioning

A personal reading-to-memory loop over plain files Tyler owns. The library files are canonical; every write goes through the `ore` CLI (D30).

## Operating Context

- Surfaces: Home with the daily goal and Start review (D58), the review mode (D59), the sources list, skill pages and ⌘K palette (Operate), and the reader with its prequestion strip, highlight popup and finish quiz (Read).
- Used alongside the `/ore` Claude Code skill.
- Keyboard first: ⌘K palette, ⌘N add, ⌘O open file, ⌘R review, ⌘1–2 lists, 1–3 highlight types, ⌘↵ finish, Esc back.

## Capabilities and Constraints

- Built: add (links, files, courses), To read/Done, the reader with highlights and notes, video, Listen, skill pages, the finish quiz, Home, review with the daily goal, the quick quiz, skill strength as gems, and an iPhone app (D78).
- Terms: source, highlight, highlight type (Keep, Card, Question), note, prequestion, finish, free recall, skill (CONTEXT.md).
- AI never sets a rating (D21). Notes are always Tyler's own words; no AI summary replaces them (D29).

## Brand Commitments

- Shell: Raycast. Dark, compact, keyboard-first, list rows with shortcut hints, no chrome (D26).
- Reader: Notion. Calm type, one column of 55–70 characters (D27).
- Overall: as quick as Raycast, as calm as ChatGPT desktop, and as rewarding as a Duolingo lesson: motion and small celebrations for real progress (D62).
- The system font (SF Pro via -apple-system) is intentional. Do not swap in a web font.
- Dark, by choice. The one exception is an optional light reading page (Settings › Reading page; the sidebar and side panel stay dark, D26).

## Product Principles

- Reward what he remembers and the effort he spends, never volume (D62): a daily time goal that never resets to zero, skill strength from solid memories, motion and a short celebration when the goal closes. No XP, badges, leaderboards, hard-reset streaks, guilt copy or reading-speed metrics (D27).
- Labels and placement carry meaning. Minimal text: explanations live in hover hints or an ⓘ, never in standing copy.
- Keyboard everywhere. Every control with a shortcut shows it on hover (`Hint`), not as a standing badge.
- Smallest complete solution. Add a feature only when the behaviour needs it.

## Accessibility & Inclusion

No product-specific requirement beyond good practice: full keyboard operation, visible focus, ≥4.5:1 text contrast, reduced motion respected.
