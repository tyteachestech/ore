Your name is `tutor`. First read `codex-out/preamble.md` and follow it.

Your ports: Mac app page http://localhost:1753/ with `window.__ORE_BRIDGE = 1754` (library `/Users/tylerpoelking/Developer/ore-wt/sweep5/codex-out/libs/tutor`); iPhone app http://localhost:1755/ (its seed is a copy at `/Users/tylerpoelking/Developer/ore-wt/sweep5/codex-out/libs/tutor-phone`; the page's writes stay in IndexedDB). WebKit server: `ws://[::1]:1759/`. The `ore` CLI: `ORE_LIBRARY=/Users/tylerpoelking/Developer/ore-wt/sweep5/codex-out/libs/tutor bun packages/cli/src/ore.ts`.
Your library is seeded with `seed-big.ts`.

## Your focus: the tutor chat, rebuilt on 2026-11-15
The tutor chat was out of scope for earlier sweeps while it was rebuilt (#426, D290–D297). Read those decisions, `docs/guides/ask-library.md`, and the chat's code (`apps/desktop/src/` files named Tutor, Ask or Chat; `packages/core/src/ai/`). No AI runs here: fake its replies with `window.__ORE_REPLY = { <command>: <reply> }` (read `tauri.js` for the shape), and its waits and failures with `__ORE_SLOW` and `__ORE_FAIL`.
1. **A long chat.** Fifty turns in one source (D293: a long chat keeps its start) and in Ask your library, with replies that are long, full of Markdown, tables, code, math, citations, and replies that cite a passage that is not there, a deleted source, or another library's file. Does each citation open the right place, and does the page stay quick?
2. **Interruptions.** Close the chat mid-reply, switch source, start Review, reload, ask a second question before the first answers, type while it waits. Is the question kept, the reply kept or dropped cleanly, and never shown under the wrong source?
3. **History.** Reopen old chats, rename, delete and undo; the same source in two windows; the turn log on disk (D295) against what the chat shows.
4. **What it is told.** The context the chat sends (log the request): the whole open source, where he is, what he marked and what he last missed (D294), never another source's private notes or a file outside the library.
5. **From review.** Ask about an exercise during Review and on the end screen: does it know which exercise, and does its reply show as it is written, and does Stop end it (D296)? Does asking ever change the rating (D21 forbids it)?
On the iPhone where the chat exists.
