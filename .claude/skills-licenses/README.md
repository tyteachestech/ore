Skills in `.claude/skills/` copied from outside, unchanged, under the MIT licence (D120 allows MIT):

- From mattpocock/skills at 6f7f783 (`mattpocock-skills.LICENSE`): ask-matt, codebase-design, diagnosing-bugs, domain-modeling, grill-with-docs, grill-me, grilling, handoff, implement, implement-spec, improve-codebase-architecture, pr, prototype, research, tdd, to-spec, to-tickets, wayfinder, wizard.
- From addyosmani/agent-skills at e997ac5 (`addyosmani-agent-skills.LICENSE`): security-and-hardening.

Left out on purpose: Matt's `code-review` (it would shadow the `/code-review` that shipping relies on, so `implement` calls that one), `retro` and `writing-for-agents` (Ore has its own), `triage` (bugs go through `triage-report`) and `setup-matt-pocock-skills` (its answers are in `docs/agents/`). Picked by Tyler 2026-11-26 for the Ore Cloud build (D355).
