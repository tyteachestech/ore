import { AGENTS, failNext, hold, isHeld, journey, openSource, ore, release, type Rigged, startReview, until } from "../harness";

journey("Feed: ⌘-click and ⇧-click pick posts, ⋯ marks them all read at once, ⇧⌘U marks the selected one, Esc clears (F9)", async (page) => {
  const day = new Date(Date.now() - 864e5).toUTCString();
  const item = (n: number) => `<item><title>Pick post ${n}</title><link>http://localhost/pick-${n}.html</link><pubDate>${day}</pubDate></item>`;
  const server = Bun.serve({ port: 0, fetch: () => new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Pick Notes</title><link>http://localhost/</link>${[1, 2, 3].map(item).join("")}</channel></rss>`, { headers: { "content-type": "application/rss+xml" } }) });
  const feed = `http://localhost:${server.port}/feed.xml`;
  try {
    await ore("feed", "follow", feed);
    await page.getByRole("button", { name: /^Feed/ }).click();
    const post = (n: number) => page.locator(".row.post", { hasText: `Pick post ${n}` });
    await post(3).waitFor();
    // In Unread a read post leaves the list; in All it stays, dimmed.
    const isRead = (n: number) => post(n).evaluateAll((els) => !els.length || els[0]!.classList.contains("read"));
    await post(1).click({ modifiers: ["Meta"] });
    await post(3).click({ modifiers: ["Shift"] });
    await until("⌘-click then ⇧-click pick three posts", async () => (await page.locator(".row.post.sel").count()) === 3);
    if (await page.locator(".post-view, .doc-head").count()) throw new Error("a ⌘-click opened the post");
    await page.keyboard.press("Escape");
    await until("Esc clears the pick", async () => (await page.locator(".row.post.sel").count()) === 0);
    await post(1).click({ modifiers: ["Meta"] });
    await post(2).click({ modifiers: ["Meta"] });
    await until("⌘-click picks two posts", async () => (await page.locator(".row.post.sel").count()) === 2);
    await post(2).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Mark 2 read" }).click();
    await until("both are read", async () => (await isRead(1)) && (await isRead(2)));
    await page.getByText("Marked 2 posts read").first().waitFor();
    await page.keyboard.press("Meta+KeyZ");
    await until("⌘Z marks both unread again", async () => !(await isRead(1)) && !(await isRead(2)));
    await post(2).click({ modifiers: ["Meta"] });
    await post(1).click({ modifiers: ["Meta"] });
    await post(2).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Mark 2 read" }).click();
    await until("both are read again", async () => (await isRead(1)) && (await isRead(2)));
    await until("the pick is cleared", async () => (await page.locator(".row.post.sel").count()) === 0);
    await page.locator(".feed-list").focus();
    for (let n = 0; n < 20 && !(await page.locator(".row.post.on", { hasText: "Pick post 3" }).count()); n++) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Shift+Meta+KeyU");
    await until("⇧⌘U marks the selected post read", async () => isRead(3));
  } finally {
    await ore("feed", "unfollow", feed).catch(() => {});
    server.stop(true);
  }
});

journey("Feed: ⇧↓ grows the pick, ⇧⌘U marks the whole pick read, a click on empty space drops it, and a title's first letters select its post (D232, D234)", async (page) => {
  const day = new Date(Date.now() - 864e5).toUTCString();
  const titles = ["Keys alpha", "Keys beta", "Keys gamma", "Zebra keys"];
  const item = (t: string, n: number) => `<item><title>${t}</title><link>http://localhost/keys-${n}.html</link><pubDate>${day}</pubDate></item>`;
  const server = Bun.serve({ port: 0, fetch: () => new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Keys Notes</title><link>http://localhost/</link>${titles.map(item).join("")}</channel></rss>`, { headers: { "content-type": "application/rss+xml" } }) });
  const feed = `http://localhost:${server.port}/feed.xml`;
  try {
    await ore("feed", "follow", feed);
    await page.getByRole("button", { name: /^Feed/ }).click();
    const post = (t: string) => page.locator(".row.post", { hasText: t });
    await post("Zebra keys").waitFor();
    const isRead = async (t: string) => !(await post(t).count()) || (await post(t).getAttribute("class"))!.includes("read");
    const sel = () => page.locator(".row.post.sel").count();
    await page.locator(".feed-list").focus();
    await page.keyboard.type("zeb");
    await until("typing a title's first letters selects its post", async () => (await page.locator(".row.post.on", { hasText: "Zebra keys" }).count()) === 1);
    await page.waitForTimeout(1100); // the typed prefix ends
    await page.keyboard.type("keys a");
    await until("a prefix with a space selects its post", async () => (await page.locator(".row.post.on", { hasText: "Keys alpha" }).count()) === 1);
    await page.keyboard.press("Shift+ArrowDown");
    await page.keyboard.press("Shift+ArrowDown");
    await until("⇧↓ twice picks three posts", async () => (await sel()) === 3);
    const list = (await page.locator(".feed-list").boundingBox())!;
    await page.mouse.click(list.x + list.width - 12, list.y + list.height - 12);
    await until("a click on empty space drops the pick", async () => (await sel()) === 0);
    await post("Keys alpha").click({ modifiers: ["Meta"] });
    await post("Keys beta").click({ modifiers: ["Meta"] });
    await until("⌘-click picks two posts", async () => (await sel()) === 2);
    await page.locator(".feed-list").focus();
    await page.keyboard.press("Shift+Meta+KeyU");
    await until("⇧⌘U marks both picked posts read", async () => (await isRead("Keys alpha")) && (await isRead("Keys beta")));
    if (await isRead("Keys gamma")) throw new Error("⇧⌘U marked a post outside the pick");
    await post("Keys gamma").click({ modifiers: ["Meta"] });
    await page.locator(".feed-list").focus();
    await page.keyboard.press("Shift+ArrowDown");
    await until("⇧↓ after a ⌘-click grows that pick", async () => (await sel()) === 2);
  } finally {
    await ore("feed", "unfollow", feed).catch(() => {});
    server.stop(true);
  }
});

journey("Home and Feed: ⌘C on the focused row copies it as Markdown with its link, as a list's selected row does", async (page) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const clip = () => page.evaluate(() => navigator.clipboard.readText());
  await openSource(page, AGENTS);
  await page.getByRole("button", { name: /^Home/ }).click();
  const row = page.locator(".home-read .home-open").filter({ hasText: AGENTS }).first();
  // A row focused quietly (after a click, no ring) copies nothing: ⌘C acts on a row he can see is focused.
  await page.evaluate(() => navigator.clipboard.writeText("before"));
  await row.focus();
  if (!(await row.evaluate((el) => el.matches(":focus-visible")))) {
    await page.keyboard.press("Meta+c");
    await page.waitForTimeout(300);
    if ((await clip()) !== "before") throw new Error("⌘C copied a row that showed no focus");
  }
  // Reached by the keyboard, its ring shows and ⌘C copies it.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await until("the row has keyboard focus", () => row.evaluate((el) => el === document.activeElement && el.matches(":focus-visible")));
  await page.keyboard.press("Meta+c");
  await until("Home's row is on the clipboard", async () => (await clip()) === `[${AGENTS}](https://www.anthropic.com/research/building-effective-agents)`);
  await page.locator(".toast").filter({ hasText: "Copied as Markdown" }).waitFor();
  const day = new Date(Date.now() - 864e5).toUTCString();
  const server = Bun.serve({ port: 0, fetch: () => new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Copy Notes</title><link>http://localhost/</link><item><title>A post to copy</title><link>http://localhost/a-post.html</link><pubDate>${day}</pubDate></item></channel></rss>`, { headers: { "content-type": "application/rss+xml" } }) });
  const feed = `http://localhost:${server.port}/feed.xml`;
  try {
    await ore("feed", "follow", feed);
    await page.getByRole("button", { name: /^Feed/ }).click();
    await page.locator(".row.post", { hasText: "A post to copy" }).waitFor();
    await page.locator(".feed-list").focus();
    for (let n = 0; n < 20 && !(await page.locator(".row.post.on", { hasText: "A post to copy" }).count()); n++) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Meta+c");
    await until("the Feed's post is on the clipboard", async () => (await clip()) === "[A post to copy](http://localhost/a-post.html)");
  } finally {
    await ore("feed", "unfollow", feed).catch(() => {});
    server.stop(true);
  }
});

journey("Feed: a post its menu takes away (Mark read in Unread, Unfollow) leaves focus on the Feed's list", async (page) => {
  const day = new Date(Date.now() - 864e5).toUTCString();
  const items = ["First to go", "Second post", "Third post"].map((t, i) => `<item><title>${t}</title><link>http://localhost/p${i}.html</link><pubDate>${day}</pubDate></item>`).join("");
  const server = Bun.serve({ port: 0, fetch: () => new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Gone Notes</title><link>http://localhost/</link>${items}</channel></rss>`, { headers: { "content-type": "application/rss+xml" } }) });
  const feed = `http://localhost:${server.port}/feed.xml`;
  try {
    await ore("feed", "follow", feed);
    await page.evaluate(() => localStorage.setItem("ore.feed.show", "unread"));
    await page.getByRole("button", { name: /^Feed/ }).click();
    const post = (t: string) => page.locator(".row.post", { hasText: t });
    await post("First to go").waitFor();
    await post("First to go").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Mark read" }).click();
    await until("the post goes from Unread", async () => (await post("First to go").count()) === 0);
    await until("focus is on the Feed's list", () => page.evaluate(() => !!document.activeElement?.matches(".feed-list")));
    // The cursor waits on the next post: ↵ by the keyboard would open it.
    await post("Second post").hover();
    await page.getByRole("button", { name: "Actions for Second post" }).click();
    await page.getByRole("menuitem", { name: /^Unfollow/ }).click();
    await until("its posts go", async () => (await post("Second post").count()) === 0);
    await until("focus is on the Feed's list again", () => page.evaluate(() => !!document.activeElement?.matches(".feed-list")));
  } finally {
    await page.evaluate(() => localStorage.removeItem("ore.feed.show"));
    await ore("feed", "unfollow", feed).catch(() => {});
    server.stop(true);
  }
});

journey("feed: a post that opens slowly never takes him away from where he went meanwhile; Forward goes dim once a preview is dropped", async (page) => {
  const day = new Date(Date.now() - 864e5).toUTCString();
  const server: ReturnType<typeof Bun.serve> = Bun.serve({ port: 0, fetch: (r: Request): Response => new URL(r.url).pathname === "/feed.xml" ? new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Slow Notes</title><link>http://localhost/</link><item><title>A slow post</title><link>http://localhost:${server.port}/a.html</link><pubDate>${day}</pubDate></item><item><title>Another post</title><link>http://localhost:${server.port}/b.html</link><pubDate>${day}</pubDate></item></channel></rss>`, { headers: { "content-type": "application/rss+xml" } }) : new Response(`<html><head><title>${r.url.endsWith("b.html") ? "Another post" : "A slow post"}</title></head><body><article><h1>${r.url.endsWith("b.html") ? "Another post" : "A slow post"}</h1>${"<p>Spacing beats cramming, as study after study has found over many decades of work.</p>".repeat(8)}</article></body></html>`, { headers: { "content-type": "text/html" } }) });
  const feed = `http://localhost:${server.port}/feed.xml`;
  try {
    await ore("feed", "follow", feed);
    await page.getByRole("button", { name: /^Feed/ }).click();
    const post = page.locator(".row.post", { hasText: "A slow post" });
    await post.waitFor();
    await page.evaluate(() => void ((window as unknown as Rigged).__ORE_SLOW = { feed: 1500 }));
    await post.click();
    await page.getByRole("button", { name: /^Home/ }).click();
    await page.waitForTimeout(2200);
    if (await page.locator(".doc-head h1").count()) throw new Error("the post opened over Home after he went there");
    // Asked for again after leaving and coming back while it still loads, it opens.
    await page.getByRole("button", { name: /^Feed/ }).click();
    // (Read posts stay listed for this, as with the view's All.)
    await page.evaluate(() => localStorage.setItem("ore.feed.show", "all"));
    const other = page.locator(".row.post", { hasText: "Another post" });
    await other.click();
    await page.getByRole("button", { name: /^Home/ }).click();
    await page.getByRole("button", { name: /^Feed/ }).click();
    await other.click();
    await page.locator(".doc-head h1", { hasText: "Another post" }).waitFor({ timeout: 6000 }).catch(() => {
      throw new Error("a post asked for again while its first open still loads never opens");
    });
    // A preview he only looked at is dropped when he goes back, so Forward has nowhere to go and says so.
    await page.evaluate(() => void ((window as unknown as Rigged).__ORE_SLOW = undefined));
    await page.keyboard.press("Meta+BracketLeft");
    await page.locator(".feed, .row.post, .list").first().waitFor();
    const forward = page.locator(".nav-arrows button").nth(1);
    await page.waitForTimeout(600); // the preview is dropped
    if (await forward.isEnabled()) {
      await forward.click();
      await page.waitForTimeout(300);
      if (!(await page.locator(".doc-head h1").count()) && (await forward.isEnabled())) throw new Error("Forward stays lit and does nothing after a dropped preview");
    }
  } finally {
    await page.evaluate(() => (void ((window as unknown as Rigged).__ORE_SLOW = undefined), localStorage.removeItem("ore.feed.show")));
    await ore("feed", "unfollow", feed).catch(() => {});
    server.stop(true);
  }
});

// —— run ——

/** Original local articles: a fresh feed per journey, never a live publisher or a shared preview. */
function noteFeed() {
  const title = `Note persistence ${Date.now()}`;
  const server: ReturnType<typeof Bun.serve> = Bun.serve({ port: 0, fetch: (r: Request): Response => new URL(r.url).pathname === "/feed.xml"
    ? new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>${title}</title><link>http://localhost/</link><item><title>${title}</title><link>http://localhost:${server.port}/post.html</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`, { headers: { "content-type": "application/rss+xml" } })
    : new Response(`<html><head><title>${title}</title></head><body><article><h1>${title}</h1>${"<p>Explain the principle before looking at the answer. Compare your prediction with the evidence, then try another example after a delay. Write what changed in your understanding.</p>".repeat(6)}</article></body></html>`, { headers: { "content-type": "text/html" } }) });
  return { title, server, url: `http://localhost:${server.port}/feed.xml` };
}

journey("Feed: ⇧⌘U marks a single ⌘-clicked post read before any arrow key", async (page) => {
  const feed = noteFeed();
  try {
    await ore("feed", "follow", feed.url);
    await page.evaluate(() => localStorage.setItem("ore.feed.show", "unread"));
    await page.getByRole("button", { name: /^Feed/ }).click();
    const post = page.locator(".row.post", { hasText: feed.title });
    await post.click({ modifiers: ["Meta"] });
    await post.and(page.locator(".sel")).waitFor();
    await page.keyboard.press("Shift+Meta+KeyU");
    await until("⇧⌘U removes the single picked post from Unread", async () => (await post.count()) === 0);
    await page.keyboard.press("Meta+KeyZ");
    await post.waitFor();
  } finally {
    await ore("feed", "unfollow", feed.url).catch(() => {});
    feed.server.stop(true);
  }
});

journey("feed: leaving and reopening waits for the pending note (F143)", async (page) => {
  const feed = noteFeed();
  try {
    await ore("feed", "follow", feed.url, "--skill=teaching");
    await page.getByRole("button", { name: "Feed", exact: true }).click();
    await page.locator(".row.post").filter({ hasText: feed.title }).click();
    const editor = page.getByRole("textbox", { name: "Source note", exact: true });
    await editor.waitFor();
    const posts = (await ore("feed")) as { posts: { title: string; preview: string }[] };
    const id = posts.posts.find((p) => p.title === feed.title)!.preview;
    await hold(page, "notes");
    await editor.fill("Keep the words I just wrote before leaving.");
    await page.getByRole("button", { name: "Show sidebar" }).click(); // a post beside the Feed folds it away (D289)
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await until("the note write is held", () => isHeld(page, "notes"));
    // Let cleanup run while the write is held: it must not discard the source.
    await page.waitForTimeout(200);
    await release(page, "notes");
    await until("the original source has its note", async () => {
      const note = await ore("notes", id) as { text?: string };
      return !!note.text?.includes("Keep the words I just wrote");
    });
    // Kept posts leave Feed. Reload here isolates persistence from the separate list-refresh guard.
    await page.reload();
    await openSource(page, feed.title);
    await until("the reopened note has the original words", async () => (await editor.innerText()).includes("Keep the words I just wrote"));
    // The second mounted editor must also wait behind the previous editor's save.
    await hold(page, "notes");
    await editor.fill("A newer draft survives reopening while the write waits.");
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await until("the second note write is held", () => isHeld(page, "notes"));
    await openSource(page, feed.title);
    await release(page, "notes");
    await until("the new editor loads after the old save", async () => (await editor.innerText()).includes("A newer draft survives reopening"));
  } finally {
    await release(page, "notes");
    await ore("feed", "unfollow", feed.url);
    feed.server.stop();
  }
});

journey("feed: a note keeps the reader and skill list current (F144)", async (page) => {
  const feed = noteFeed();
  try {
    await ore("feed", "follow", feed.url, "--skill=teaching");
    await page.getByRole("button", { name: "Feed", exact: true }).click();
    await page.locator(".row.post").filter({ hasText: feed.title }).click();
    const editor = page.getByRole("textbox", { name: "Source note", exact: true });
    await editor.fill("Keep this post with my note and show it in Teaching.");
    await until("the reader shows that the post is saved", async () => !(await page.getByText("Not saved", { exact: true }).count()) && !!(await page.getByRole("button", { name: "Finish", exact: true }).count()));
    await page.getByRole("button", { name: "Show sidebar" }).click(); // a post beside the Feed folds it away (D289)
    await page.getByRole("navigation", { name: "Skills" }).getByRole("button", { name: "Teaching", exact: true }).click();
    await page.getByRole("tab", { name: "To read", exact: true }).click();
    await page.getByRole("row").filter({ hasText: feed.title }).waitFor();
  } finally {
    await ore("feed", "unfollow", feed.url);
    feed.server.stop();
  }
});

journey("feed: a failed departing note keeps its preview for retry (F143)", async (page) => {
  const feed = noteFeed();
  try {
    await ore("feed", "follow", feed.url);
    await page.getByRole("button", { name: "Feed", exact: true }).click();
    await page.locator(".row.post").filter({ hasText: feed.title }).click();
    const editor = page.getByRole("textbox", { name: "Source note", exact: true });
    await editor.waitFor();
    const posts = (await ore("feed")) as { posts: { title: string; preview: string }[] };
    const id = posts.posts.find((p) => p.title === feed.title)!.preview;
    await failNext(page, "notes", "The disk is temporarily unavailable.");
    await editor.fill("Recover these words after a failed save.");
    await page.getByRole("button", { name: "Show sidebar" }).click(); // a post beside the Feed folds it away (D289)
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page.locator(".toast").filter({ hasText: "Notes not saved" }).last().waitFor();
    await ore("show", id); // cleanup must not delete the only source the draft belongs to
    await failNext(page, "notes", null);
    await page.getByRole("button", { name: "Feed", exact: true }).click();
    await page.getByRole("button", { name: "Recent", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "All", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.locator(".row.post").filter({ hasText: feed.title }).click();
    await until("the failed draft returns", async () => (await editor.innerText()).includes("Recover these words"));
    await until("the recovered draft is saved on its original source", async () => (await ore("notes", id) as { text: string }).text.includes("Recover these words"));
  } finally {
    await failNext(page, "notes", null);
    await ore("feed", "unfollow", feed.url);
    feed.server.stop();
  }
});

journey("feed: a post reads beside the list, J and K step through the posts, and Esc gives the list back (D289)", async (page) => {
  const stamp = Date.now();
  const titles = [`Split first ${stamp}`, `Split second ${stamp}`];
  const server: ReturnType<typeof Bun.serve> = Bun.serve({ port: 0, fetch: (r: Request): Response => {
    const path = new URL(r.url).pathname;
    if (path === "/feed.xml") return new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Split ${stamp}</title><link>http://localhost/</link>${titles.map((t, i) => `<item><title>${t}</title><link>http://localhost:${server.port}/p${i}.html</link><pubDate>${new Date(Date.now() - i * 3600_000).toUTCString()}</pubDate></item>`).join("")}</channel></rss>`, { headers: { "content-type": "application/rss+xml" } });
    const t = titles[Number(path.match(/p(\d)/)?.[1] ?? 0)]!;
    return new Response(`<html><head><title>${t}</title></head><body><article><h1>${t}</h1>${"<p>Space the practice out, then test yourself before you look back at the page.</p>".repeat(6)}</article></body></html>`, { headers: { "content-type": "text/html" } });
  } });
  const url = `http://localhost:${server.port}/feed.xml`;
  try {
    await ore("feed", "follow", url);
    await page.getByRole("button", { name: "Feed", exact: true }).click();
    await page.locator(".row.post").filter({ hasText: titles[0] }).click();
    const open = page.locator(".feed-col .row.post.open");
    await until("the post opens beside the list, the sidebar folded", async () => (await open.innerText().catch(() => "")).includes(titles[0]!) && (await page.locator(".app.collapsed").count()) === 1);
    await page.keyboard.press("j");
    await until("J in the list opens the next post", async () => (await open.innerText().catch(() => "")).includes(titles[1]!));
    await page.locator(".feed-read p").filter({ hasText: "Space the practice" }).first().click();
    await page.keyboard.press("k");
    await until("K in the post opens the one before", async () => (await open.innerText().catch(() => "")).includes(titles[0]!));
    await until("a post read meanwhile stays in the list", async () => (await page.locator(".feed-col .row.post").filter({ hasText: titles[1] }).count()) === 1);
    await page.keyboard.press("Escape");
    await until("Esc gives the whole list back", async () => (await page.locator(".feed-split").count()) === 0 && (await page.locator(".feed-list").count()) === 1);
  } finally {
    await ore("feed", "unfollow", url);
    server.stop();
  }
});

// —— Codex sweep 5 (docs/reviews/2026-11-15-codex-sweep-5) ——

journey("feed: Esc back from a post low in a long list keeps that post in view (sweep 5, F303)", async (page) => {
  const stamp = Date.now();
  const titles = Array.from({ length: 30 }, (_, i) => `Long feed ${i + 1} ${stamp}`);
  const server: ReturnType<typeof Bun.serve> = Bun.serve({ port: 0, fetch: (r: Request): Response => {
    const path = new URL(r.url).pathname;
    if (path === "/feed.xml") return new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Long ${stamp}</title><link>http://localhost/</link>${titles.map((t, i) => `<item><title>${t}</title><link>http://localhost:${server.port}/p${i}.html</link><pubDate>${new Date(Date.now() - i * 3600_000).toUTCString()}</pubDate></item>`).join("")}</channel></rss>`, { headers: { "content-type": "application/rss+xml" } });
    const t = titles[Number(path.match(/p(\d+)/)?.[1] ?? 0)]!;
    return new Response(`<html><head><title>${t}</title></head><body><article><h1>${t}</h1>${"<p>Space the practice out, then test yourself before you look back at the page.</p>".repeat(6)}</article></body></html>`, { headers: { "content-type": "text/html" } });
  } });
  const url = `http://localhost:${server.port}/feed.xml`;
  try {
    await ore("feed", "follow", url);
    await page.getByRole("button", { name: "Feed", exact: true }).click();
    const row = page.locator(".row.post").filter({ hasText: titles[24] });
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await until("the post opens beside the list", async () => (await page.locator(".feed-col .row.post.open").innerText().catch(() => "")).includes(titles[24]!));
    await page.locator(".feed-read p").filter({ hasText: "Space the practice" }).first().waitFor();
    await page.keyboard.press("Escape");
    await until("the whole list is back", async () => (await page.locator(".feed-split").count()) === 0);
    await page.waitForTimeout(200);
    const box = await row.boundingBox();
    if (!box || box.y < 0 || box.y + box.height > 800) throw new Error(`the post just read is out of view after Esc (top ${box?.y})`);
  } finally {
    await ore("feed", "unfollow", url);
    server.stop();
  }
});

journey("Feed: Follow opens a box that takes a link only, and never saves what is typed as a source (F385)", async (page) => {
  // The empty Feed is where Follow sits: this journey unfollows what an earlier one left.
  for (const f of ((await ore("feed")) as { feeds: { url: string }[] }).feeds) await ore("feed", "unfollow", f.url);
  await page.reload();
  await page.getByRole("button", { name: "Feed", exact: true }).click();
  await page.locator(".empty-state").getByRole("button", { name: "Follow" }).click();
  const box = page.getByRole("dialog", { name: "Follow a feed" });
  const field = box.getByLabel("Link", { exact: true });
  // ⌘O picks no file into a box that takes a link.
  await page.keyboard.press("Meta+o");
  if (!/blog, newsletter or YouTube channel/.test((await field.getAttribute("placeholder")) ?? "")) throw new Error("the follow box asks for a source, not a feed's link");
  if (await box.getByRole("button", { name: "Browser tab" }).count()) throw new Error("the follow box offers Browser tab, which adds a source");
  await field.fill("not a link at all");
  await page.keyboard.press("Enter");
  await box.getByRole("alert").filter({ hasText: "Following takes one link" }).waitFor();
  const saved = ((await ore("ls")) as { title: string }[]).some((i) => /not a link at all/i.test(i.title));
  if (saved) throw new Error("the typed words were saved as a source");
  await page.keyboard.press("Escape");
  await box.waitFor({ state: "detached" });
  // The ordinary add box is itself again.
  await page.getByRole("button", { name: "+ Add" }).click();
  if (!/any text/.test((await page.getByRole("dialog", { name: "Add a source", exact: true }).getByLabel("Link, file path or text").getAttribute("placeholder")) ?? "")) throw new Error("+ Add opened the follow box");
  await page.keyboard.press("Escape");
});

// F899
journey("Feed: following the first feed by keyboard gives the post list focus (run 7)", async (page) => {
  const title = "First post after following";
  const server = Bun.serve({ port: 0, fetch: (r: Request): Response => new URL(r.url).pathname === "/feed.xml"
    ? new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>First Feed</title><link>http://localhost/</link><item><title>${title}</title><link>http://localhost:${server.port}/p.html</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`, { headers: { "content-type": "application/rss+xml" } })
    : new Response(`<html><head><title>${title}</title></head><body><article>${"<p>Spacing beats cramming for anything kept past a week.</p>".repeat(8)}</article></body></html>`, { headers: { "content-type": "text/html" } }) });
  const url = `http://localhost:${server.port}/feed.xml`;
  try {
    await page.keyboard.press("Meta+3");
    const follow = page.locator(".empty-state").getByRole("button", { name: "Follow" });
    await follow.focus();
    await page.keyboard.press("Enter");
    const box = page.getByRole("dialog", { name: "Follow a feed" });
    const field = box.getByRole("textbox", { name: "Link", exact: true });
    await field.fill(url);
    await page.keyboard.press("Enter");
    await box.waitFor({ state: "detached" });
    const list = page.getByRole("group", { name: "Feed", exact: true });
    await list.getByText(title).waitFor();
    const focus = await list.evaluate((el) => el === document.activeElement ? "Feed list" : document.activeElement?.tagName);
    if (focus !== "Feed list") throw new Error(`After following, focus is on ${focus}`);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.locator(".reader .doc").getByText("Spacing beats cramming", { exact: false }).first().waitFor();
    await page.keyboard.press("Escape");
  } finally {
    await ore("feed", "unfollow", url);
    server.stop();
  }
}, "webkit");

journey("Feed: a post open beside the Feed is still there after a review started over it (⌘R, then Esc)", async (page) => {
  // Starting Review over a post read beside the Feed dropped its preview (`feed close`), so leaving Review reopened a post
  // that was gone: `show` failed, the reader stayed empty and focus fell to <body> (CI, #580 shard 1, the corners journey).
  const server = Bun.serve({ port: 0, fetch: (r: Request): Response => new URL(r.url).pathname === "/feed.xml"
    ? new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Over review</title><link>http://localhost/</link><item><title>A post read before review</title><link>http://localhost:${server.port}/p.html</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`, { headers: { "content-type": "application/rss+xml" } })
    : new Response(`<html><head><title>Post</title></head><body><article><h1>A post read before review</h1>${"<p>Spacing beats cramming for anything kept past a week.</p>".repeat(8)}</article></body></html>`, { headers: { "content-type": "text/html" } }) });
  const url = `http://localhost:${server.port}/feed.xml`;
  try {
    await ore("feed", "follow", url, "--skill=teaching");
    await page.getByRole("button", { name: "Feed", exact: true }).click();
    await page.locator(".row.post").first().click();
    await page.locator(".reader .doc").filter({ hasText: "Spacing beats cramming" }).first().waitFor();
    const calls: string[] = [];
    page.on("request", (r) => void (r.method() === "POST" && calls.push(r.postData() ?? "")));
    await startReview(page, null, true);
    // Long enough for the post's close to have landed, had it been sent.
    await page.waitForTimeout(1500);
    if (calls.some((c) => c.includes('"feed"') && c.includes('"close"'))) throw new Error("starting Review closed the post open beside the Feed");
    await page.keyboard.press("Escape");
    await page.locator(".reader .doc").filter({ hasText: "Spacing beats cramming" }).first().waitFor();
    // Given back, it closes as any post does once he leaves it.
    await page.keyboard.press("Escape");
    await until("leaving the post closes it", async () => calls.some((c) => c.includes('"feed"') && c.includes('"close"')));
  } finally {
    await ore("feed", "unfollow", url);
    server.stop();
  }
});
