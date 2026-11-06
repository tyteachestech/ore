# Reference map

These repositories are inspiration and implementation research, not a combined codebase.

## Whole-product references

| Reference | Learn from | Do not inherit blindly |
|---|---|---|
| Incrementum | Broad ingestion, incremental reading, explicit material priority, multiple SRS engines | Feature density and configuration surface |
| OpenTutor | Source-to-concept pipeline, prerequisite graph, semantic review ordering | Self-hosting complexity and student-workspace assumptions |
| Smart Study Agent | Browser capture, automatic topic extraction, persistent learner belief state | Prototype-scale architecture and API-only Claude path |
| Claude Code KnowCraft | Automatic tags, typed links, local files, conversational knowledge operations | Prompt claims without a mature tested application |
| LearnKit | Obsidian-native review, tested FSRS integration, note-level review | Requiring the user to maintain a PKM vault |
| Engram | Tutor/assessor separation, free recall, receipts, misconception tracking | Terminal-first interaction and topic-only intake |
| Learn FASTER | Goal-driven syllabus and lightweight coaching loop | Treating a named curriculum as the whole knowledge library |
| Claude Tutor | Compact topic-plan-quiz-review loop and local dashboard | SM-2 as the final scheduler |
| Study Skill | Portable agent skill, restart-safe state, research integration | Assembly burden placed on the user |
| PageLM | Multi-provider document transformation and source-grounded artifacts | Assuming generated flashcards equal a spaced-review system |
| Shiori | Syllabus and assignment intake | Course administration as the product center |

## Infrastructure references

| Reference | Learn from |
|---|---|
| Anki MCP Server | Safe, structured AI operations over a mature review engine |
| graphthulhu | MCP access to tags, links, graph traversal, and review state |
| Obsidian Spaced Repetition | Reviewing both atomic prompts and whole notes |
| FSRS4Anki | Scheduler behavior, evaluation, and migration lessons |
| Human Skill Tree | Explicit skill taxonomy and structured tutoring prompts |

## Evaluation lens

Every borrowed idea should be judged against five separate signals:

1. **Value:** How important is this skill to the user?
2. **Memory:** How likely is this knowledge to be forgotten?
3. **Dependency:** Does another useful concept depend on it?
4. **Evidence:** What source or performance supports the learning item?
5. **Transfer:** Can the learner use it outside the review format?

No single signal should silently stand in for all five.

