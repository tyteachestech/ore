# Issue tracker: GitHub Issues on tyteachestech/ore

Specs and tickets from the planning skills (`to-spec`, `to-tickets`, `wayfinder`, `implement`) live as GitHub issues on `tyteachestech/ore`. Bugs still go to `docs/reviews/findings.md` (`triage-report`), not to issues.

How to reach them:
- On Tyler's Mac or any shell with a full `gh`: use the `gh issue` commands below.
- In a cloud thread, `gh` only searches: use the GitHub MCP tools instead (`issue_write` to create, edit, label and close; `issue_read` to read; `list_issues` to list; `sub_issue_write` for sub-issues; `add_issue_comment` to comment).

## Conventions

- **Create**: `gh issue create --title "..." --body "..."` (heredoc for long bodies).
- **Read**: `gh issue view <n> --json number,title,body,labels,comments`.
- **List**: `gh issue list --state open --label <label> --json number,title,labels`.
- **Sub-issue**: `gh issue create --parent <parent> ...`; without sub-issues, put `Part of #<parent>` at the top of the body.
- **Blocking**: GitHub's issue dependencies (`gh issue create --blocked-by <n>,<n>` or `gh issue edit <child> --add-blocked-by <n>`); else a `Blocked by: #<n>` line at the top of the body. A ticket is ready when every blocker is closed.
- **Comment**: `gh issue comment <n> --body "..."`.
- **Labels**: `gh issue edit <n> --add-label "..."` / `--remove-label "..."`.
- **Close**: comment the outcome, then `gh issue close <n>`. A PR that finishes a ticket says `Closes #<n>`.

File issues only into `tyteachestech/ore`, never into the repos these skills come from.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read** above.

## Wayfinding

- **Map**: one issue labelled `wayfinder:map` holding Notes, Decisions so far and Fog.
- **Child ticket**: a sub-issue of the map (or `Part of #<map>`), labelled `wayfinder:<type>` (`research`, `prototype`, `grilling`, `task`).
- **Frontier**: the map's open children with no open blocker and no assignee, first in map order.
- **Claim**: assign it to yourself, the session's first write.
- **Resolve**: comment the answer, close it, add a one-line pointer to the map's Decisions so far. A resolved decision Tyler picked also goes into `docs/DECISIONS.md`.
