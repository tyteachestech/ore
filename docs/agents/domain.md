# Domain docs

How the planning and engineering skills read Ore's own docs. Ore keeps its own names for the two things these skills call a glossary and ADRs.

## Before exploring, read these

- **Decisions**: `docs/DECISIONS.md`, by D-number. This is Ore's ADR log: grep the ones your work touches. There is no `docs/adr/`.
- **Names**: the "Names" rule in `CLAUDE.md` and the "Naming" section of `docs/DECISIONS.md`, plus `GLOSSARY.md` at the repo root once one exists.
- **Spec and design**: `docs/SPEC.md` and `docs/design/`.

If `GLOSSARY.md` doesn't exist, proceed silently. `domain-modeling` creates it the first time a term is settled.

## Recording

- A decision Tyler makes goes into `docs/DECISIONS.md` as `D-new-<slug>`, in the house way written at the top of that file (why, and what would reopen it). `bun run ids` numbers it at merge. Never write an ADR file.
- A settled term goes into `GLOSSARY.md`. What the app shows Tyler follows the Names rule in `CLAUDE.md` (an exercise, never a card).

## Use the vocabulary

Name domain concepts in issues, tests and proposals by the terms in these docs. Don't drift to synonyms.

## Flag decision conflicts

If your output contradicts a decision, say so instead of overriding it silently, as `CLAUDE.md` "Rules are defaults" asks:

> _Contradicts D120 (no sale), but worth reopening because…_
