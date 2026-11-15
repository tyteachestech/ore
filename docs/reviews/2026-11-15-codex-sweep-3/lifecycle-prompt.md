Your name is `lifecycle`. First read `codex-out/preamble.md` and follow it.

Your ports: Mac app page http://localhost:1710/ with `window.__ORE_BRIDGE = 1711` (library `/Users/tylerpoelking/Developer/ore-wt/sweep3/codex-out/libs/lifecycle`); iPhone app http://localhost:1712/ (its seed is a copy at `/Users/tylerpoelking/Developer/ore-wt/sweep3/codex-out/libs/lifecycle-phone`; the page's writes stay in IndexedDB). WebKit server: `ws://[::1]:1719/`. The `ore` CLI: `ORE_LIBRARY=/Users/tylerpoelking/Developer/ore-wt/sweep3/codex-out/libs/lifecycle bun packages/cli/src/ore.ts`.

## Your focus: the end of things, and what hangs off them
Each object in Ore has a life: a source, a highlight, a note, an exercise, a skill, a diagram, a course. Read `.claude/skills/interaction-check/SKILL.md` (full lifecycle, undo for every change) and the decisions on archive, retire, delete and restore in `docs/DECISIONS.md`.
1. **Cascades.** Archive, then delete, a source that has highlights, Key points, a note, exercises with reviews, and a diagram. What happens to its exercises in Review, its counts on the skill page, links to it from other notes, and the tutor's citations? Then restore it: does everything come back as it was, reviews and FSRS state too?
2. **Skills.** Rename a skill, merge two, move a source between skills, delete a skill that still has sources and exercises, give a new skill the old name of a deleted one. Is any exercise orphaned, double-counted or moved without a word?
3. **Exercises.** Edit, retire, restore, move to another skill, delete the highlight it came from, delete the source text it quotes (reimport a changed page). What does Review show, and is its history kept?
4. **Undo across screens.** Make a change, go to another screen, make another, come back and ⌘Z (and the Undo toast, and on the iPhone its Undo): which change does it undo, and does it ever undo one he can't see?
5. **Empty after.** Delete or archive the last of each thing: the last source of a skill, the last skill, the last exercise due. Every screen should show a useful empty state with the next step, never a blank or a stale count.
On the iPhone too: archive, restore, rename and delete where the phone has them.
