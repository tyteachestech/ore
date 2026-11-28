// Recovering from the library's history (D5, coverage queue 9): an agent restores files with git while the app is
// open, and the screens must show what the files now hold and never write the screen's older view back over it.
import { $ } from "bun";
import { AGENTS, awayAndBack, highlightMenu, journey, LIB, loaded, openSource, ore, oreCalls, reveal, select, startReview, TESTING, until } from "../harness";

const git = (...args: string[]) => $`git -C ${LIB} -c user.name=Test -c user.email=t@t ${args}`.quiet().text();
const commit = async () => (await git("add", "-A"), await git("commit", "-qm", "test", "--allow-empty"), (await git("rev-parse", "HEAD")).trim());

journey("a source note restored from the history while it is open: the Reader shows the restore, and his next words keep it", async (page) => {
  const id = ((await ore("ls")) as { id: string; title: string }[]).find((s) => s.title === AGENTS)!.id;
  const note = () => ore("notes", id).then((n) => (n as { text: string; path: string }));
  const { path } = await note();
  await openSource(page, AGENTS);
  const pm = page.locator(".mynotes .ProseMirror").first();
  if (!(await page.locator(".mynotes").count())) await page.keyboard.press("n");
  await pm.waitFor();
  await pm.click();
  await page.keyboard.press("Meta+End");
  await page.keyboard.type("Kept line.");
  await until("the kept line is saved", async () => (await note()).text.includes("Kept line."));
  const good = await commit();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Bad line.");
  await until("the bad line is saved", async () => (await note()).text.includes("Bad line."));
  await loaded(page);
  await git("checkout", good, "--", path);
  await awayAndBack(page);
  await until("the Reader shows the restored note", async () => !(await pm.innerText()).includes("Bad line."), 8000);
  await pm.click();
  await page.keyboard.press("Meta+End");
  await page.keyboard.type(" More.");
  await until("his next words are saved", async () => (await note()).text.includes("More."));
  const text = (await note()).text;
  if (text.includes("Bad line.")) throw new Error(`the screen wrote the line the restore took out back: ${JSON.stringify(text.slice(-80))}`);
});


journey("a highlight removed, then its source's highlights restored from the history: it shows again, and ⌘Z after leaves one", async (page) => {
  const phrase = "The advantage only appears after a delay";
  const id = ((await ore("ls")) as { id: string; title: string }[]).find((s) => s.title === TESTING)!.id;
  const live = async () => ((await ore("show", id, "--annotations")) as { annotations: { exact: string; status?: string }[] }).annotations.filter((a) => a.exact.startsWith(phrase) && a.status !== "deleted").length;
  const kept = () => page.evaluate((p) => [...(CSS.highlights.get("hl-keep") ?? [])].filter((r) => r.toString().startsWith(p)).length, phrase);
  await openSource(page, TESTING);
  await select(page, phrase);
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await page.keyboard.press("Enter");
  await until("the highlight is saved", async () => (await live()) === 1);
  await loaded(page);
  const good = await commit();
  await highlightMenu(page, phrase, "Remove highlight");
  await until("it is removed", async () => (await live()) === 0);
  await loaded(page);
  const dir = (await git("ls-files", "items")).split("\n").find((f) => f.includes(id) && f.includes("annotations"))!;
  await git("checkout", good, "--", dir);
  if ((await live()) !== 1) throw new Error("the restore did not bring the highlight back on disk");
  await awayAndBack(page);
  await until("the Reader shows the restored highlight", async () => (await kept()) === 1, 8000);
  await page.keyboard.press("Meta+z");
  await page.waitForTimeout(500);
  await loaded(page);
  if ((await kept()) !== 1 || (await live()) !== 1) throw new Error(`after ⌘Z: ${await kept()} on screen, ${await live()} on disk`);
});

journey("a whole day rolled back from the history while Home is open: what was due is due again, and ⌘Z on a rating the roll-back took says so", async (page) => {
  const before = ((await ore("today")) as { due: number }).due;
  if (before < 1) throw new Error("needs an exercise due");
  const good = await commit();
  const app = oreCalls(page);
  await startReview(page, null);
  await reveal(page);
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await until("the rating is logged", async () => app.rated.length === 1);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" }).catch(() => {});
  await loaded(page);
  await git("checkout", good, "--", ".");
  await awayAndBack(page);
  await until("Home offers the review again", () => page.getByRole("button", { name: "Start review" }).isVisible());
  const after = ((await ore("today")) as { due: number }).due;
  if (after !== before) throw new Error(`${after} due after the roll-back, ${before} before the session`);
  // The rating ⌘Z would take back is gone from the log: it says so in words, not a timestamp and an id.
  await page.keyboard.press("Meta+z");
  await page.locator(".toast").filter({ hasText: "Couldn’t undo" }).filter({ hasText: "that rating is no longer in the library" }).waitFor();
});
