import { afterEach, describe, expect, test } from "bun:test";
import { addHighlight } from "../src/annotations.ts";
import { arrangeFeeds, clearPreviews, closePost, feedView, findFeed, followFeed, listFeeds, markRead, openPost, parseFeed, refreshFeeds, restoreFeed, unfollowFeed } from "../src/feeds.ts";
import { addSource } from "../src/ingest/index.ts";
import { findItem, listItems, updateItemMeta } from "../src/items.ts";
import { setNotes } from "../src/notes.ts";
import { tempLibrary } from "./helpers.ts";

const day = 86400_000;
const ago = (d: number) => new Date(Date.now() - d * day).toUTCString();
const iso = (d: number) => new Date(Date.now() - d * day).toISOString();

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>Simon Willison's Weblog</title>
  <link href="https://simonwillison.net/" rel="alternate"/>
  <link href="https://simonwillison.net/atom/everything/" rel="self"/>
  <entry><title>Prompt injection &amp; you</title><link href="https://simonwillison.net/2026/Nov/1/injection/" rel="alternate"/>
    <published>${iso(1)}</published><author><name>Simon Willison</name></author>
    <content type="html">&lt;p&gt;Hello &lt;img src="/static/a.png"&gt;&lt;/p&gt;</content></entry>
  <entry><title>Older</title><link href="https://simonwillison.net/2026/Oct/1/old/" rel="alternate"/><published>${iso(30)}</published></entry>
</feed>`;

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
  <title>How I AI</title><link>https://howiai.example.com</link>
  <item><title><![CDATA[Claire on agents]]></title><link>https://howiai.example.com/p/agents</link><pubDate>${ago(2)}</pubDate><dc:creator>Claire Vo</dc:creator>
    <enclosure url="https://cdn.example.com/cover.jpg" type="image/jpeg"/></item>
  <item><title>Newest</title><link>https://howiai.example.com/p/newest</link><pubDate>${ago(0.5)}</pubDate></item>
</channel></rss>`;

const YOUTUBE = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>How I AI</title><link rel="alternate" href="https://www.youtube.com/channel/UC123"/>
 <entry><title>Episode 40</title><link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/><author><name>How I AI</name></author><published>${iso(3)}</published>
  <media:group><media:title>Episode 40</media:title><media:thumbnail url="https://i1.ytimg.com/vi/abc123/hqdefault.jpg" width="480" height="360"/></media:group></entry>
</feed>`;

const ARTICLE = (t: string) => `<html><head><title>${t}</title></head><body><article><h1>${t}</h1>${`<p>${t} is a post with enough words in it to read as an article and not a stub page.</p>`.repeat(8)}</article></body></html>`;

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** A small web: blogs, their feeds and posts; `down` hosts don't answer. */
function serve(down = new Set<string>()) {
  const pages: Record<string, [string, string]> = {
    "https://simonwillison.net/": [`<html><head><link rel="alternate" type="application/atom+xml" title="Atom" href="/atom/everything/"></head><body>Blog</body></html>`, "text/html"],
    "https://simonwillison.net/atom/everything/": [ATOM, "application/atom+xml"],
    "https://howiai.example.com/": [`<html><body>No feed link here</body></html>`, "text/html"],
    "https://howiai.example.com/feed": [RSS, "application/rss+xml"],
    "https://nofeed.example.com/": ["<html><body>Just a page</body></html>", "text/html"],
  };
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (down.has(new URL(url).host)) throw new TypeError("fetch failed");
    const hit = pages[url];
    if (hit) return new Response(hit[0], { headers: { "content-type": hit[1] } });
    if (/\/(p|20\d\d)\//.test(url)) return new Response(ARTICLE(url.split("/").filter(Boolean).pop()!), { headers: { "content-type": "text/html" } });
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

describe("reading feeds", () => {
  test("Atom: title, site, posts newest first with link, author, date and an image from the content", async () => {
    const f = await parseFeed(ATOM, "https://simonwillison.net/atom/everything/");
    expect(f.title).toBe("Simon Willison's Weblog");
    expect(f.site).toBe("https://simonwillison.net/");
    expect(f.posts.map((p) => p.title)).toEqual(["Prompt injection & you", "Older"]);
    expect(f.posts[0]).toMatchObject({ url: "https://simonwillison.net/2026/Nov/1/injection/", author: "Simon Willison", image: "https://simonwillison.net/static/a.png" });
  });

  test("RSS 2.0: CDATA titles, dc:creator, enclosure images, sorted by date", async () => {
    const f = await parseFeed(RSS, "https://howiai.example.com/feed");
    expect(f.posts.map((p) => p.title)).toEqual(["Newest", "Claire on agents"]);
    expect(f.posts[1]).toMatchObject({ author: "Claire Vo", image: "https://cdn.example.com/cover.jpg" });
  });

  test("a YouTube channel's feed gives each video's link and thumbnail", async () => {
    const f = await parseFeed(YOUTUBE, "https://www.youtube.com/feeds/videos.xml?channel_id=UC123");
    expect(f.posts[0]).toMatchObject({ url: "https://www.youtube.com/watch?v=abc123", title: "Episode 40", image: "https://i1.ytimg.com/vi/abc123/hqdefault.jpg" });
  });

  test("finds the feed a page names, then the usual places; none says what to do for email-only newsletters", async () => {
    serve();
    expect((await findFeed("https://simonwillison.net/")).url).toBe("https://simonwillison.net/atom/everything/");
    expect((await findFeed("https://simonwillison.net/atom/everything/")).title).toBe("Simon Willison's Weblog");
    expect((await findFeed("https://howiai.example.com/")).url).toBe("https://howiai.example.com/feed");
    expect(findFeed("https://nofeed.example.com/")).rejects.toThrow(/kill-the-newsletter/);
  });
});

test("a YouTube channel's feed is tried again when YouTube's feed server stumbles, and says how many posts it has", async () => {
  let n = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url === "https://www.youtube.com/@howiai") return new Response(`<html><head><link rel="alternate" type="application/rss+xml" title="RSS" href="https://www.youtube.com/feeds/videos.xml?channel_id=UC123"></head></html>`, { headers: { "content-type": "text/html" } });
    if (url.startsWith("https://www.youtube.com/feeds/")) return ++n < 2 ? new Response("nope", { status: 404 }) : new Response(YOUTUBE, { headers: { "content-type": "application/atom+xml" } });
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  const f = await findFeed("https://www.youtube.com/@howiai");
  expect(f).toMatchObject({ title: "How I AI", posts: 1 });
  expect(f.newest!.slice(0, 13)).toBe(iso(3).slice(0, 13));
  expect(n).toBe(2);
});

describe("the Feed", () => {
  test("follow, order, unfollow and Undo; following twice keeps one", async () => {
    serve();
    const lib = await tempLibrary();
    await followFeed(lib, "https://simonwillison.net/", { skills: ["ai"] });
    await followFeed(lib, "https://howiai.example.com/");
    expect((await followFeed(lib, "https://simonwillison.net/atom/everything/")).already).toBe(true);
    expect(listFeeds(lib).map((f) => f.title)).toEqual(["Simon Willison's Weblog", "How I AI"]);
    await arrangeFeeds(lib, ["https://howiai.example.com/feed", "https://simonwillison.net/atom/everything/"]);
    expect(listFeeds(lib)[0]!.title).toBe("How I AI");
    const gone = await unfollowFeed(lib, "How I AI");
    expect(listFeeds(lib).length).toBe(1);
    await restoreFeed(lib, gone.feed, gone.at);
    expect(listFeeds(lib).map((f) => f.title)).toEqual(["How I AI", "Simon Willison's Weblog"]);
  });

  test("posts of the last 14 days, newest first; read marks hold across views and can be undone", async () => {
    serve();
    const lib = await tempLibrary();
    await followFeed(lib, "https://simonwillison.net/");
    await followFeed(lib, "https://howiai.example.com/");
    await refreshFeeds(lib);
    const v = feedView(lib);
    expect(v.posts.map((p) => p.title)).toEqual(["Newest", "Prompt injection & you", "Claire on agents"]);
    expect(v.posts.every((p) => !p.read)).toBe(true);
    markRead(lib, ["https://howiai.example.com/p/newest"]);
    expect(feedView(lib).posts[0]!.read).toBe(true);
    markRead(lib, ["https://howiai.example.com/p/newest"], false);
    expect(feedView(lib).posts[0]!.read).toBe(false);
  });

  test("a feed that stops answering keeps its posts and says why", async () => {
    serve();
    const lib = await tempLibrary();
    await followFeed(lib, "https://simonwillison.net/");
    await refreshFeeds(lib);
    serve(new Set(["simonwillison.net"]));
    const r = await refreshFeeds(lib);
    expect(r.failed[0]!.error).toMatch(/Couldn’t reach simonwillison.net/);
    const v = feedView(lib);
    expect(v.feeds[0]!.error).toMatch(/Couldn’t reach/);
    expect(v.posts.length).toBe(1);
  });
});

describe("previews: a post is saved only once he keeps something from it", () => {
  test("opening reads it without listing it; closing with nothing kept deletes it", async () => {
    serve();
    const lib = await tempLibrary();
    await followFeed(lib, "https://simonwillison.net/", { skills: ["ai"] });
    await refreshFeeds(lib);
    const url = "https://simonwillison.net/2026/Nov/1/injection/";
    const item = await openPost(lib, url);
    expect(item.meta.preview).toBeTruthy();
    expect(listItems(lib)).toEqual([]);
    expect(findItem(lib, item.meta.id).meta.title).toBe("injection");
    expect(feedView(lib).posts[0]).toMatchObject({ read: true, preview: item.meta.id });
    // Opening it again reads the same preview.
    expect((await openPost(lib, url)).meta.id).toBe(item.meta.id);
    expect(await closePost(lib, item.meta.id)).toBe("dropped");
    expect(() => findItem(lib, item.meta.id)).toThrow();
    expect(feedView(lib).posts[0]).toMatchObject({ read: true });
  });

  test("a highlight keeps it as a source, filed under the feed's skills, and it leaves the Feed", async () => {
    serve();
    const lib = await tempLibrary();
    await followFeed(lib, "https://simonwillison.net/", { skills: ["ai"] });
    await refreshFeeds(lib);
    const item = await openPost(lib, "https://simonwillison.net/2026/Nov/1/injection/");
    addHighlight(item, { exact: "enough words", intent: "keep" });
    expect(await closePost(lib, item.meta.id)).toBe("kept");
    const kept = listItems(lib);
    expect(kept.map((i) => [i.meta.title, i.meta.skills])).toEqual([["injection", ["ai"]]]);
    expect(feedView(lib).posts).toEqual([]);
  });

  test("a line in its source note keeps it too; adding the link on purpose keeps it", async () => {
    serve();
    const lib = await tempLibrary();
    await followFeed(lib, "https://howiai.example.com/");
    await refreshFeeds(lib);
    const a = await openPost(lib, "https://howiai.example.com/p/agents");
    await setNotes(lib, a.meta.id, "Agents need a loop");
    expect(await closePost(lib, a.meta.id)).toBe("kept");
    const b = await openPost(lib, "https://howiai.example.com/p/newest");
    const added = await addSource(lib, "https://howiai.example.com/p/newest");
    expect(added).toMatchObject({ kept: true, fromFeed: true });
    expect(findItem(lib, b.meta.id).meta.preview).toBeUndefined();
  });

  test("a preview left behind is cleared after a day, unless it holds his work", async () => {
    serve();
    const lib = await tempLibrary();
    await followFeed(lib, "https://howiai.example.com/");
    await refreshFeeds(lib);
    const a = await openPost(lib, "https://howiai.example.com/p/agents");
    const b = await openPost(lib, "https://howiai.example.com/p/newest");
    addHighlight(b, { exact: "enough words", intent: "card" });
    for (const id of [a.meta.id, b.meta.id]) await updateItemMeta(lib, id, (m) => ({ ...m, preview: iso(2) }));
    await clearPreviews(lib);
    expect(() => findItem(lib, a.meta.id)).toThrow();
    expect(listItems(lib).map((i) => i.meta.id)).toEqual([b.meta.id]);
  });
});
