// `bun run ship`: the merge steps in docs/WORKFLOW.md as one command (retro 2026-11-15: #429 reached master with an
// unnumbered finding). A fake shell plays git and gh.
import { expect, test } from "bun:test";
import { ship, type Run } from "../scripts/ship";

function fake(over: (cmd: string) => { code?: number; out?: string } | undefined = () => undefined) {
  const calls: string[] = [];
  let masters = ["m1"];
  const sh: Run = (cmd) => {
    const c = cmd.join(" ");
    calls.push(c);
    const o = over(c);
    if (o) return { code: o.code ?? 0, out: o.out ?? "" };
    if (c === "git branch --show-current") return { code: 0, out: "claude/x" };
    if (c.endsWith("branch --show-current")) return { code: 0, out: "master" };
    if (c === "gh pr view --json number -q .number") return { code: 0, out: "431" };
    if (c === "git rev-parse origin/master") return { code: 0, out: masters.length > 1 ? masters.shift()! : masters[0]! };
    if (c === "git rev-parse HEAD") return { code: 0, out: "h1" };
    if (c.includes("/check-runs")) return { code: 0, out: "6" };
    return { code: 0, out: "" };
  };
  return { sh, calls, setMasters: (m: string[]) => (masters = m) };
}
const go = (sh: Run, reviewed = true) => ship({ sh, log: () => {}, reviewed, wait: async () => {}, live: import.meta.dir });

test("merges after green checks, then numbering, the placeholder check and its push, then pulls the live checkout", async () => {
  let numbered = false;
  const f = fake((c) => (c === "bun run ids" ? ((numbered = true), {}) : c === "git status --porcelain" && numbered ? { out: " M docs/reviews/findings.md" } : undefined));
  expect(await go(f.sh)).toBe(431);
  const at = (s: string) => f.calls.findIndex((c) => c.startsWith(s));
  expect(at("gh pr checks 431")).toBeLessThan(at("bun run ids"));
  expect(at("bun run ids")).toBeLessThan(at("bun packages/core/scripts/ids.ts --check"));
  expect(at("bun packages/core/scripts/ids.ts --check")).toBeLessThan(f.calls.findLastIndex((c) => c.startsWith("git push")));
  expect(f.calls.findLastIndex((c) => c.startsWith("git push"))).toBeLessThan(at("gh pr merge 431 --squash --match-head-commit h1"));
  expect(f.calls.some((c) => c.includes("pull -q --ff-only"))).toBe(true);
});

test("rows are numbered only once master holds still, so master moving during the checks never leaves two rows one number (#562)", async () => {
  const f = fake();
  f.setMasters(["m1", "m2", "m2", "m2"]);
  expect(await go(f.sh)).toBe(431);
  const lastChecks = f.calls.findLastIndex((c) => c.startsWith("gh pr checks"));
  expect(f.calls.filter((c) => c === "bun run ids").length).toBe(1);
  expect(f.calls.findIndex((c) => c === "bun run ids")).toBeGreaterThan(lastChecks);
});

test("a placeholder left after numbering stops it before the numbers are pushed and merged", async () => {
  const f = fake((c) => (c.endsWith("ids.ts --check") ? { code: 1, out: "findings.md: an unnumbered finding" } : undefined));
  await expect(go(f.sh)).rejects.toThrow("placeholder");
  expect(f.calls.findLastIndex((c) => c.startsWith("git push"))).toBeLessThan(f.calls.findIndex((c) => c.endsWith("ids.ts --check")));
  expect(f.calls.some((c) => c.startsWith("gh pr merge"))).toBe(false);
});

test("refuses without a review, from master, with uncommitted work, or while master is red", async () => {
  await expect(go(fake().sh, false)).rejects.toThrow("/code-review");
  await expect(go(fake((c) => (c === "git branch --show-current" ? { out: "master" } : undefined)).sh)).rejects.toThrow("not master");
  await expect(go(fake((c) => (c === "git status --porcelain" ? { out: " M a.ts" } : undefined)).sh)).rejects.toThrow("Commit");
  const red = fake((c) => (c.startsWith("gh run list") ? { out: "https://github.com/x/runs/1" } : undefined));
  await expect(go(red.sh)).rejects.toThrow("red");
  expect(red.calls.some((c) => c.startsWith("gh pr merge"))).toBe(false);
});

test("waits for the pushed commit's checks to register before watching them", async () => {
  let n = 0;
  const f = fake((c) => (c.includes("/check-runs") ? { out: String(n++ < 2 ? 0 : 3) } : undefined));
  expect(await go(f.sh)).toBe(431);
  expect(f.calls.filter((c) => c.includes("/check-runs")).length).toBe(3);
});

test("a cancelled run on master is skipped when asking whether master is red", async () => {
  const f = fake();
  await go(f.sh);
  expect(f.calls.find((c) => c.startsWith("gh run list"))).toContain('"cancelled"');
});

test("failed checks stop it, and master moving during the checks starts it again", async () => {
  await expect(go(fake((c) => (c.startsWith("gh pr checks") ? { code: 1 } : undefined)).sh)).rejects.toThrow("checks failed");
  const f = fake();
  f.setMasters(["m1", "m2", "m2", "m2"]);
  expect(await go(f.sh)).toBe(431);
  expect(f.calls.filter((c) => c.startsWith("gh pr checks")).length).toBe(2);
});
