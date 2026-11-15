#!/usr/bin/env bun
// Merges this worktree's PR the one way docs/WORKFLOW.md asks: `bun run ship --reviewed`, after /code-review is clean.
// It brings master in, numbers new decisions and findings (`bun run ids`) and checks none is left, pushes, waits for
// the PR's checks, refuses while master's last finished test run is red, starts again if master moved meanwhile,
// squash-merges, then pulls ~/Developer/ore so the app reinstalls. (Retro 2026-11-15: #429 merged with an unnumbered
// finding and turned master red until #430.)
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type Run = (cmd: string[], opts?: { cwd?: string; live?: boolean }) => { code: number; out: string };

const run: Run = (cmd, opts = {}) => {
  const r = spawnSync(cmd[0]!, cmd.slice(1), { cwd: opts.cwd, encoding: "utf8", stdio: opts.live ? "inherit" : "pipe" });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
};

type Opts = { sh: Run; log: (s: string) => void; reviewed: boolean; wait?: (ms: number) => Promise<unknown>; tries?: number; live?: string };

export async function ship({ sh, log, reviewed, wait = Bun.sleep, tries = 3, live = join(homedir(), "Developer/ore") }: Opts): Promise<number> {
  const must = (cmd: string[], why: string) => {
    const r = sh(cmd);
    if (r.code !== 0) throw new Error(`${why}\n${r.out}`);
    return r.out;
  };
  if (!reviewed) throw new Error("Run /code-review on the PR's diff and fix what it confirms, then: bun run ship --reviewed");
  const branch = must(["git", "branch", "--show-current"], "Not on a branch.");
  if (branch === "master" || !branch) throw new Error("Ship from the PR's branch, not master.");
  if (must(["git", "status", "--porcelain"], "git status failed.")) throw new Error("Commit or put away your changes first.");
  const pr = Number(must(["gh", "pr", "view", "--json", "number", "-q", ".number"], `No PR for ${branch}.`));

  for (let i = 0; i < tries; i++) {
    must(["git", "fetch", "-q", "origin", "master"], "git fetch failed.");
    const master = must(["git", "rev-parse", "origin/master"], "No origin/master.");
    if (sh(["git", "merge-base", "--is-ancestor", "origin/master", "HEAD"]).code !== 0) {
      log("bringing master in…");
      must(["git", "merge", "--no-edit", "origin/master"], "Master doesn't merge in cleanly: resolve it, commit, and ship again.");
    }
    must(["bun", "run", "ids"], "bun run ids failed.");
    if (sh(["git", "status", "--porcelain"]).out) {
      must(["git", "commit", "-qam", "Number new decisions and findings"], "Couldn't commit the numbers.");
      log("numbered new decisions and findings");
    }
    must(["bun", "packages/core/scripts/ids.ts", "--check"], "A placeholder is still left (an F-new or D-new name with no row to number).");
    must(["git", "push", "-q", "-u", "origin", branch], "git push failed.");
    const red = sh(["gh", "run", "list", "--workflow", "test.yml", "--branch", "master", "--status", "completed", "--limit", "1", "--json", "conclusion,url", "-q", '.[] | select(.conclusion != "success") | .url']).out;
    if (red) throw new Error(`Master's last finished test run is red (${red}): fix master first.`);
    log(`waiting for PR #${pr}'s checks…`);
    await wait(10_000); // the push's checks take a moment to register
    if (sh(["gh", "pr", "checks", String(pr), "--watch", "--fail-fast"], { live: true }).code !== 0) throw new Error(`PR #${pr}'s checks failed.`);
    must(["git", "fetch", "-q", "origin", "master"], "git fetch failed.");
    if (must(["git", "rev-parse", "origin/master"], "No origin/master.") !== master) {
      log("master moved while the checks ran: again");
      continue;
    }
    const head = must(["git", "rev-parse", "HEAD"], "No HEAD.");
    must(["gh", "pr", "merge", String(pr), "--squash", "--match-head-commit", head], "gh pr merge failed.");
    log(`merged PR #${pr}`);
    if (existsSync(live) && sh(["git", "-C", live, "branch", "--show-current"]).out === "master") {
      const r = sh(["git", "-C", live, "pull", "-q", "--ff-only"]);
      log(r.code === 0 ? "pulled ~/Developer/ore: the app reinstalls in the background (~/Library/Caches/ore/app-install.log)" : `couldn't pull ~/Developer/ore:\n${r.out}`);
    }
    return pr;
  }
  throw new Error(`Master moved ${tries} times while the checks ran: ship again.`);
}

if (import.meta.main) {
  await ship({ sh: run, log: console.log, reviewed: process.argv.includes("--reviewed") }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
