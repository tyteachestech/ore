# /ore — Claude Code skill for Ore

Install (needs the `ore` CLI on PATH, from `packages/cli` via `bun link`):

    ln -sfn ~/Developer/ore/skills/ore ~/.claude/skills/ore

Modes, chosen from what you type after `/ore`:
- (nothing), "review", "quiz me": due cards one per turn: probe → confidence + answer → AI grade → reveal → you confirm the rating.
- `add <url|path>`: ingest, then ask the prequestions. "read" when done re-asks them with feedback (no FSRS).
- "this card is wrong / too broad": edit the card file. `research <question>`: pick sources by number to add.
- Anything else: library questions via `ore ls`, `ore search`, `ore stats`.
