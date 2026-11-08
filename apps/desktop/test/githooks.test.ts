// The app reinstall hooks (.githooks): only master's changes to apps/desktop/, or to what its compiled
// `ore` is built from (packages/, the root package files; D30), reinstall Ore.app.
// Every worktree shares core.hooksPath, so a commit on a thread's branch must not install that branch.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const hooks = resolve(import.meta.dir, "../../../.githooks");
const tmp = mkdtempSync(join(tmpdir(), "ore-hooks-"));
const marker = join(tmp, "installed");
const bin = join(tmp, "bin");
mkdirSync(bin);
// A fake bun: `bun install` notes that dependencies came first; `bun run app:install` records the branch built.
writeFileSync(join(bin, "bun"), `#!/bin/sh\nif [ "$1" = install ]; then touch "${marker}.deps"; else [ -e "${marker}.deps" ] && echo "$(git rev-parse --abbrev-ref HEAD)" >> "${marker}"; fi\n`);
chmodSync(join(bin, "bun"), 0o755);
const env = { ...process.env, HOME: tmp, PATH: `${bin}:${process.env.PATH}`, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };

function git(cwd: string, ...args: string[]) {
  const r = Bun.spawnSync(["git", ...args], { cwd, env });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
}
function commit(cwd: string, file: string) {
  mkdirSync(join(cwd, file, ".."), { recursive: true });
  writeFileSync(join(cwd, file), String(Math.random()));
  git(cwd, "add", "-A");
  git(cwd, "commit", "-qm", file);
}
async function installs(): Promise<string> {
  // The hook installs in the background; give it a moment, then read what it built.
  for (let i = 0; i < 30; i++) {
    if (existsSync(marker) && !existsSync(join(tmp, "Library/Caches/ore/app-install.lock"))) break;
    await Bun.sleep(50);
  }
  await Bun.sleep(100);
  const out = existsSync(marker) ? (await Bun.file(marker).text()).trim() : "";
  rmSync(marker, { force: true });
  rmSync(`${marker}.deps`, { force: true });
  return out;
}

const repo = join(tmp, "ore");
mkdirSync(repo);
git(repo, "init", "-q", "-b", "master");
writeFileSync(join(repo, "README"), "ore");
git(repo, "add", "-A");
git(repo, "commit", "-qm", "root");
git(repo, "config", "core.hooksPath", hooks);

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("app reinstall hooks", () => {
  test("a commit on master touching apps/desktop installs dependencies, then reinstalls", async () => {
    commit(repo, "apps/desktop/a.ts");
    expect(await installs()).toBe("master");
  });

  test("a commit to the CLI's code or the lockfile reinstalls too, since the app carries a compiled ore", async () => {
    commit(repo, "packages/core/a.ts");
    expect(await installs()).toBe("master");
    commit(repo, "bun.lock");
    expect(await installs()).toBe("master");
  });

  test("a commit elsewhere on master does not", async () => {
    commit(repo, "docs/a.md");
    expect(await installs()).toBe("");
  });

  test("a commit on a branch worktree never installs the branch", async () => {
    const wt = join(tmp, "ore-topic");
    git(repo, "worktree", "add", "-q", "-b", "topic", wt);
    commit(wt, "apps/desktop/b.ts");
    expect(await installs()).toBe("");
  });

  test("pulling desktop changes into master reinstalls", async () => {
    const clone = join(tmp, "clone");
    git(tmp, "clone", "-q", repo, clone);
    git(clone, "config", "core.hooksPath", hooks);
    commit(repo, "apps/desktop/c.ts");
    await installs();
    git(clone, "pull", "-q", "--ff-only");
    expect(await installs()).toBe("master");
  });
});
