# How threads ship to Tyler's Mac

The one home for merging, reinstalling and parallel work. Project instructions and memory point here.

## Merge as you go
- Tyler has standing approval for a thread to merge its own PR once CI is green (typecheck, tests, build, e2e), without waiting for his review. Flag anything risky first, such as a change to the library's file format.
- Before merging, run `/code-review` on the PR's diff and fix what it confirms. Self-merge has no other reviewer.
- Stacked PRs merge in order, each rebased onto master first.

## After a merge: pull, and the app reinstalls
- On the Mac (Remote Control): `git -C ~/Developer/ore pull --ff-only`. With `core.hooksPath .githooks` set, the `post-merge` hook reinstalls /Applications/Ore.app in the background when the pulled commits touch `apps/desktop/` (log: `~/Library/Caches/ore/app-install.log`). Check the log's last line says `installed`.
- The hooks install only from `master`: commits in a branch worktree never replace the installed app.
- Pause pulls while Tyler or an AI tester is using the app.

## Parallel threads
- `~/Developer/ore` stays on `master`: the installed app carries a CLI compiled from it at install (D30), run against his real library. Build branches in a worktree (`git worktree add ../ore-<topic>`), never by checking one out there.
- Rebase onto `origin/master` before pushing and again before merging; another thread may have landed.
- Git housekeeping is the thread's job, never Tyler's: do resets, rebases, branch cleanup and reinstalls yourself on the Mac, and never ask him to run a git command. Never rewrite master's history; if it ever must be, the thread that does it also resets `~/Developer/ore`, rebases open PRs and deletes the old branches.
- Name files in NFC Unicode (macOS shows NFD names as untracked).

## Component catalogs (shadcn MCP)
- `.mcp.json` starts the shadcn MCP server (`bunx --bun shadcn@latest mcp`, no key) in Claude Code sessions on this repo. Approve it once when Claude Code asks; check with `/mcp`.
- It searches the registries in the root `components.json`: shadcn/ui (always on), Cult UI (`@cult-ui`, MIT) and Rare UI (`@rare-ui`). Ask by registry, e.g. "show me `@cult-ui/…`"; a bare name searches only shadcn.
- Rare UI is MIT plus a Commons Clause that bars redistributing its components, which clashes with D120: read it for ideas, never copy its code into Ore. shadcn and Cult UI code may be copied in, restyled to `DESIGN.md`.
- The root `components.json` holds only registries, so `shadcn add` won't write files from it; bring a component in by reading it through the MCP and adapting it by hand.
