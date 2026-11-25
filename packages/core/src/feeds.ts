import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { readAnnotations } from "./annotations.ts";
import { loadYaml, parseYaml } from "./frontmatter.ts";
import { appendJsonl, deviceLog, readLog, writeAtomic } from "./fsutil.ts";
import { nowIso } from "./ids.ts";
import { addSource, linkKey } from "./ingest/index.ts";
import { allItems, findItem, keepPreview, listItems, type Item } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";
import { readNotes } from "./notes.ts";

// Feeds he follows (blogs, newsletters with a feed, YouTube channels). Posts are never saved to the
// library on their own: opening one reads it as a preview, and only a highlight or a line in its
// source note keeps it (`keepPreview`). `feeds.yaml` holds the feeds in his order; which posts he has
// read is a per-device log; the fetched posts are a cache in `.index/`, rebuilt by `refreshFeeds`.

export const FeedSchema = z.object({
  url: z.string(),
  title: z.string(),
  site: z.string().optional(),
  skills: z.array(z.string()).default([]),
  followed_at: z.string(),
});
export type Feed = z.infer<typeof FeedSchema>;
const FeedsFile = z.object({ feeds: z.array(FeedSchema).default([]) });

export type Post = { feed: string; url: string; title: string; author?: string; published?: string; image?: string };
type Cache = { generation?: number; feeds: Record<string, { generation?: number; checked_at: string; error?: string; posts: Post[] }> };

/** Posts older than this leave the Feed, read or not: it never becomes a pile. */
export const FEED_DAYS = 14;
/** At most this many posts kept per feed. */
const PER_FEED = 30;
// D107: a dated post belongs to the preceding fourteen days, never a future day.
// Undated posts stay eligible while the publisher lists them.
// `ahead`: a refresh keeps a post due within the day (a clock a minute fast, a post scheduled for 09:00
// listed at 08:58), so the Feed shows it when its time comes instead of after the next refresh.
const inFeedWindow = (post: Pick<Post, "published">, now: number, ahead = 0) => !post.published
  || (Date.parse(post.published) >= now - FEED_DAYS * 86400_000 && Date.parse(post.published) <= now + ahead);
/** A preview left behind (the app quit while it was open) is cleared after a day. */
const PREVIEW_MS = 24 * 3600_000;

const feedsPath = (lib: Library) => join(lib.root, "feeds.yaml");
const cachePath = (lib: Library) => join(lib.root, ".index", "feeds.json");
const readPath = (lib: Library) => join(lib.root, "feeds", "read.jsonl");

export function listFeeds(lib: Library): Feed[] {
  const p = feedsPath(lib);
  if (!existsSync(p)) return [];
  return FeedsFile.parse(parseYaml(readFileSync(p, "utf8")) ?? {}).feeds;
}

const writeFeeds = (lib: Library, feeds: Feed[]) => writeAtomic(feedsPath(lib), loadYaml().stringify({ feeds }));

function readCache(lib: Library): Cache {
  try {
    return JSON.parse(readFileSync(cachePath(lib), "utf8")) as Cache;
  } catch {
    return { feeds: {} };
  }
}

// ---- Reading feeds

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const isFeedText = (text: string) => /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*|<\?xml-stylesheet[^>]*>\s*)*<(?:[\w.-]+:)?(?:rss|feed|RDF)\b/.test(text.slice(0, 3000));
const host = (url: string) => new URL(url).host.replace(/^www\./, "");

/** YouTube's feed server answers 404 or 500 about half the time (2026-11): its feeds get a second try,
 *  then are read through yt-dlp from the channel's Videos tab (`channelVideos`). */
const YT_FEED = /^https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=([\w-]+)/;

async function fetchText(url: string, tries = YT_FEED.test(url) ? 2 : 1): Promise<{ text: string; url: string; type: string }> {
  for (let i = 1; ; i++) {
    try {
      return await fetchOnce(url);
    } catch (e) {
      if (i >= tries) throw e;
      await Bun.sleep(400 * i);
    }
  }
}

async function fetchOnce(url: string): Promise<{ text: string; url: string; type: string }> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/rss+xml, application/atom+xml, text/xml, text/html;q=0.9, */*;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(20_000) }).catch(() => {
    throw new Error(`Couldn’t reach ${host(url)}. Check your connection and try again.`);
  });
  if (!res.ok) throw new Error(`${host(url)} answered HTTP ${res.status}.`);
  const type = res.headers.get("content-type") ?? "";
  const bytes = new Uint8Array(await res.arrayBuffer());
  const bom = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le"
    : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be"
    : bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? "utf-8" : undefined;
  const charset = /charset\s*=\s*["']?([^\s;"']+)/i.exec(type)?.[1];
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 512));
  const declared = /^\s*<\?xml\s[^>]*encoding\s*=\s*["']([^"']+)["']/i.exec(head)?.[1];
  // A label the decoder doesn't know ("unicode", a typo) reads as UTF-8, as before, never a failed feed.
  const decoder = [bom, charset, declared].flatMap((label) => {
    try {
      return label ? [new TextDecoder(label)] : [];
    } catch {
      return [];
    }
  })[0] ?? new TextDecoder();
  const text = decoder.decode(bytes);
  return { text, url: res.url || url, type };
}

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
const oneLine = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** A feed's title and its posts, newest first. RSS 2.0, RSS 1.0 and Atom (YouTube's included). */
export async function parseFeed(xml: string, base: string): Promise<{ title: string; site?: string; posts: Omit<Post, "feed">[] }> {
  // The forgiving parser reads a download cut off partway as a feed with fewer posts, or none: one whose root
  // never closes is refused, so a refresh keeps the last posts and says why (F366). What comes
  // after a closed root (a site's script, a PHP notice, NULs) is not the feed's and is left out.
  const top = /<((?:[\w.-]+:)?(?:rss|feed|RDF))\b/.exec(xml)?.[1];
  const close = top ? [...xml.matchAll(new RegExp(`</${top.replaceAll(".", "\\.")}\\s*>`, "g"))].at(-1) : undefined;
  if (!close) throw new Error(`${host(base)} sent a feed that stops partway.`);
  xml = xml.slice(0, close.index + close[0].length);
  const { DOMParser } = await import("linkedom");
  const doc = new DOMParser().parseFromString(xml, "text/xml") as unknown as Document;
  type El = Element;
  // linkedom retains qualified names but does not expose XML namespace lookup.
  const namespace = (el: El) => {
    const prefix = el.tagName.includes(":") ? el.tagName.split(":")[0] : undefined;
    const attr = prefix ? `xmlns:${prefix}` : "xmlns";
    for (let node: El | null = el; node; node = node.parentElement) {
      if (node.hasAttribute(attr)) return node.getAttribute(attr);
    }
    return undefined;
  };
  const kids = (el: El, name: string) => [...el.children].filter((c) => {
    const qualified = c.tagName.toLowerCase();
    if (qualified === name) return true;
    return !name.includes(":") && qualified.split(":").at(-1) === name && namespace(c) === "http://www.w3.org/2005/Atom";
  });
  const text = (el: El, ...names: string[]) => {
    for (const n of names) {
      const t = kids(el, n)[0]?.textContent;
      if (t?.trim()) return decode(t);
    }
    return undefined;
  };
  const abs = (u: string | undefined | null, el: El) => {
    if (!u) return undefined;
    try {
      const ancestors: El[] = [];
      for (let node: El | null = el; node; node = node.parentElement) ancestors.unshift(node);
      let inherited = base;
      for (const node of ancestors) {
        const declared = node.getAttribute("xml:base");
        if (declared) inherited = new URL(declared, inherited).href;
      }
      return new URL(u.trim(), inherited).href;
    } catch {
      return undefined;
    }
  };
  const date = (s?: string) => {
    const t = s ? Date.parse(s) : NaN;
    return Number.isNaN(t) ? undefined : new Date(t).toISOString();
  };
  const root = doc.documentElement as El;
  const atom = root.tagName.toLowerCase().split(":").at(-1) === "feed";
  const channel = atom ? root : (kids(root, "channel")[0] ?? root);
  const entries = atom ? kids(root, "entry") : [...doc.getElementsByTagName("item")];
  const link = (el: El) => {
    if (!atom) {
      const target = kids(el, "link").find((l) => l.textContent?.trim()) ?? kids(el, "guid").find((g) => (g.getAttribute("isPermaLink") ?? g.getAttribute("ispermalink")) !== "false");
      return abs(target?.textContent, target ?? el);
    }
    const links = kids(el, "link");
    const target = links.find((l) => (l.getAttribute("rel") ?? "alternate") === "alternate") ?? links[0];
    return abs(target?.getAttribute("href"), target ?? el);
  };
  const image = (el: El) => {
    const media = [...el.getElementsByTagName("media:thumbnail"), ...el.getElementsByTagName("media:content")].find((m) => m.getAttribute("url") && (m.tagName.toLowerCase() === "media:thumbnail" || /image/.test(m.getAttribute("medium") ?? m.getAttribute("type") ?? "")));
    if (media) return abs(media.getAttribute("url"), media);
    const enc = kids(el, "enclosure").find((e) => /^image\//.test(e.getAttribute("type") ?? ""));
    if (enc) return abs(enc.getAttribute("url"), enc);
    const content = ["content:encoded", "content", "description", "summary"].flatMap((name) => kids(el, name)).find((c) => c.textContent?.trim());
    const html = content?.textContent ?? "";
    return abs(/<img[^>]+src=["']([^"']+)["']/i.exec(html)?.[1], content ?? el);
  };
  const author = (el: El) => {
    const a = kids(el, "author")[0];
    const name = a && (kids(a, "name")[0]?.textContent ?? a.textContent);
    return oneLine(decode(name ?? text(el, "dc:creator") ?? "")) || undefined;
  };
  const title = (el: El) => {
    const element = kids(el, "title")[0];
    const value = text(el, "title") ?? "";
    if (!atom) return oneLine(value);
    // Atom's default text construct is literal text. Only type=html contains
    // escaped markup; XHTML already has XML elements and textContent removes them.
    const plain = element?.getAttribute("type") === "html"
      ? new DOMParser().parseFromString(`<html><body>${value}</body></html>`, "text/html").body.textContent ?? ""
      : value;
    return plain.replace(/\s+/g, " ").trim();
  };
  const seen = new Set<string>();
  const posts = entries
    .flatMap((e): Omit<Post, "feed">[] => {
      const url = link(e);
      if (!url || !/^https?:/.test(url)) return [];
      return [{ url, title: title(e) || host(url), author: author(e), published: date(text(e, "published", "pubdate", "dc:date", "updated")), image: image(e) }];
    })
    .sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""))
    // A post listed twice is one post, so copies never use up the posts a feed keeps (F367).
    .filter((p) => !seen.has(p.url) && !!seen.add(p.url));
  const siteElement = atom ? kids(channel, "link").find((l) => (l.getAttribute("rel") ?? "alternate") === "alternate") : kids(channel, "link").find((l) => l.textContent?.trim()); // not WordPress's <atom:link rel="self"/> above it
  const siteLink = abs(atom ? siteElement?.getAttribute("href") : siteElement?.textContent, siteElement ?? channel);
  return { title: title(channel) || host(base), site: siteLink, posts };
}

type Read = { url: string; title: string; site?: string; posts: Omit<Post, "feed">[] };

/** A YouTube channel's newest videos through yt-dlp, with the dates YouTube shows ("2 days ago"). */
async function channelVideos(feedUrl: string, why: string): Promise<Read> {
  const { ytDlp } = await import("./ingest/youtube.ts");
  const bin = ytDlp();
  const channel = YT_FEED.exec(feedUrl)![1]!;
  if (!bin) throw new Error(`${why} Installing yt-dlp lets Ore read the channel another way: run \`brew install yt-dlp\` in Terminal, then try again.`);
  const page = `https://www.youtube.com/channel/${channel}/videos`;
  const proc = Bun.spawn([bin, "-J", "--flat-playlist", "--playlist-end", "15", "--no-warnings", "--extractor-args", "youtubetab:approximate_date", page], { stdout: "pipe", stderr: "pipe" });
  const [stdout, , code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(`${why} Reading the channel through yt-dlp failed too.`);
  const info = JSON.parse(stdout) as { channel?: string; uploader?: string; entries?: { id?: string; title?: string; timestamp?: number; thumbnails?: { url: string; width?: number }[] }[] };
  const posts = (info.entries ?? [])
    .filter((e) => e.id && e.title && !/^\[(private|deleted) video\]$/i.test(e.title))
    .map((e) => ({
      url: `https://www.youtube.com/watch?v=${e.id}`,
      title: e.title!,
      author: info.channel ?? info.uploader,
      published: e.timestamp ? new Date(e.timestamp * 1000).toISOString() : undefined,
      image: `https://i.ytimg.com/vi/${e.id}/mqdefault.jpg`,
    }));
  return { url: feedUrl, title: info.channel ?? info.uploader ?? "YouTube channel", site: `https://www.youtube.com/channel/${channel}`, posts };
}

/** A feed's title and posts, from its link; a YouTube channel whose feed server fails is read through yt-dlp. */
async function readFeed(url: string): Promise<Read> {
  try {
    const got = await fetchText(url);
    if (!isFeedText(got.text)) throw new Error(`${host(url)} no longer serves a feed there.`);
    return { url: got.url, ...(await parseFeed(got.text, got.url)) };
  } catch (e) {
    if (YT_FEED.test(url)) return channelVideos(url, (e as Error).message);
    throw e;
  }
}

/** What he is about to follow, so he can tell it's a real feed: how many posts, and when the newest is from. */
export type Found = { url: string; title: string; site?: string; posts: number; newest?: string };
const found = (r: Read, site?: string): Found => ({ url: r.url, title: r.title, site: r.site ?? site, posts: r.posts.length, newest: r.posts.find((p) => p.published)?.published });

/** The feed behind a link: the link itself when it is one, else the feed its page names, else the
 *  usual places (`/feed`, `/rss.xml`, …). A newsletter that only comes by email says what to do. */
export async function findFeed(url: string): Promise<Found> {
  if (!/^https?:\/\//i.test(url) || !URL.canParse(url)) throw new Error("Follow takes a web link (http or https) to a blog, newsletter or YouTube channel.");
  if (YT_FEED.test(url)) return found(await readFeed(url));
  const got = await fetchText(url);
  if (isFeedText(got.text)) return found({ url: got.url, ...(await parseFeed(got.text, got.url)) });
  // A wiki (Wikipedia, any MediaWiki) names feeds of its edits, in every language: nothing to follow.
  if (/<meta\b(?=[^>]*\bname=["']generator["'])(?=[^>]*\bcontent=["']MediaWiki)/i.test(got.text))
    throw new Error(`Found no feed on ${host(got.url)}: a wiki's feeds list its edits, not articles to read.`);
  const tried = new Set<string>();
  const named = [...got.text.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((tag) => /rel=["']?alternate/i.test(tag) && /type=["']?application\/(rss|atom)\+xml/i.test(tag))
    .map((tag) => /href=["']([^"']+)["']/i.exec(tag)?.[1])
    .filter((h): h is string => !!h)
    // Comment feeds come after the posts' own.
    .sort((a, b) => Number(/comment/i.test(a)) - Number(/comment/i.test(b)));
  const origin = new URL(got.url).origin;
  const guesses = ["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml", "/index.xml", "/feed/"].map((p) => origin + p);
  const own = named.map((h) => new URL(h.replace(/&amp;/g, "&"), got.url).href);
  /** Why the feed the page names didn't answer, if it didn't: said instead of "no feed". */
  let namedError: string | undefined;
  for (const candidate of [...own, ...guesses]) {
    if (tried.has(candidate)) continue;
    tried.add(candidate);
    try {
      if (own.includes(candidate)) return found(await readFeed(candidate), origin);
      const f = await fetchText(candidate);
      if (!isFeedText(f.text) && !/(rss|atom)\+xml/.test(f.type)) continue;
      return found({ url: f.url, ...(await parseFeed(f.text, f.url)) }, origin);
    } catch (e) {
      if (own.includes(candidate)) namedError ??= (e as Error).message;
    }
  }
  if (namedError) throw new Error(`${host(got.url)} has a feed, but it didn’t answer: ${namedError} Try again in a while.`);
  throw new Error(`Found no feed on ${host(got.url)}. If it only comes by email, sign up with an address from kill-the-newsletter.com and follow the feed it gives you.`);
}

// ---- Following

export async function followFeed(lib: Library, url: string, opts: { skills?: string[] } = {}): Promise<{ feed: Feed; already: boolean; found: Found }> {
  const f = await findFeed(url);
  return withLock(paths.lock(lib), () => {
    const feeds = listFeeds(lib);
    const had = feeds.find((x) => x.url === f.url);
    if (had) return { feed: had, already: true, found: f };
    const feed: Feed = { url: f.url, title: f.title, site: f.site, skills: opts.skills ?? [], followed_at: nowIso() };
    writeFeeds(lib, [...feeds, feed]);
    return { feed, already: false, found: f };
  });
}

function feedOf(feeds: Feed[], ref: string): Feed {
  const f = feeds.find((x) => x.url === ref) ?? feeds.find((x) => x.title.toLowerCase() === ref.toLowerCase());
  if (!f) throw new Error(`not following "${ref}" (\`ore feed\` lists them)`);
  return f;
}

/** Stops following; returns the feed so the app's Undo can follow it again where it was. */
export async function unfollowFeed(lib: Library, ref: string): Promise<{ feed: Feed; at: number }> {
  return withLock(paths.lock(lib), () => {
    const feeds = listFeeds(lib);
    const feed = feedOf(feeds, ref);
    const at = feeds.indexOf(feed);
    writeFeeds(lib, feeds.filter((f) => f !== feed));
    return { feed, at };
  });
}

/** Puts a feed back (Undo of unfollow) at its old place. */
export async function restoreFeed(lib: Library, feed: Feed, at: number): Promise<Feed[]> {
  return withLock(paths.lock(lib), () => {
    const feeds = listFeeds(lib).filter((f) => f.url !== feed.url);
    feeds.splice(Math.max(0, Math.min(at, feeds.length)), 0, FeedSchema.parse(feed));
    writeFeeds(lib, feeds);
    return feeds;
  });
}

/** His order for the By feed view: every followed feed once. */
export async function arrangeFeeds(lib: Library, order: string[]): Promise<Feed[]> {
  return withLock(paths.lock(lib), () => {
    const feeds = listFeeds(lib);
    if (order.length !== feeds.length || new Set(order).size !== order.length) throw new Error("give every followed feed once");
    const next = order.map((u) => feedOf(feeds, u));
    if (new Set(next).size !== feeds.length) throw new Error("give every followed feed once");
    writeFeeds(lib, next);
    return next;
  });
}

export async function setFeed(lib: Library, ref: string, patch: { title?: string; skills?: string[] }): Promise<Feed> {
  return withLock(paths.lock(lib), () => {
    const feeds = listFeeds(lib);
    const feed = feedOf(feeds, ref);
    const title = patch.title?.replace(/\s+/g, " ").trim();
    if (patch.title !== undefined && !title) throw new Error("a feed needs a name");
    const next = { ...feed, ...(title ? { title } : {}), ...(patch.skills ? { skills: patch.skills } : {}) };
    writeFeeds(lib, feeds.map((f) => (f === feed ? next : f)));
    return next;
  });
}

// ---- Posts

/** Fetches every feed (or the named ones) and caches their posts; a feed that fails keeps its last
 *  posts and says why. Also clears previews left behind. */
export async function refreshFeeds(lib: Library, only?: string[]): Promise<{ checked: number; failed: { feed: string; error: string }[] }> {
  // Reserve an order on disk, shared by separate CLI processes. Never hold the
  // library lock over the network; later refreshes and Follow can still finish.
  const { feeds, generation } = await withLock(paths.lock(lib), () => {
    const feeds = listFeeds(lib).filter((f) => !only?.length || only.includes(f.url));
    const cache = readCache(lib);
    const generation = (cache.generation ?? 0) + 1;
    cache.generation = generation;
    writeAtomic(cachePath(lib), JSON.stringify(cache));
    return { feeds, generation };
  });
  const results = await Promise.all(
    feeds.map(async (f) => {
      try {
        const parsed = await readFeed(f.url);
        return { f, posts: parsed.posts.filter((p) => inFeedWindow(p, Date.now(), 86400_000)).slice(0, PER_FEED).map((p) => ({ ...p, feed: f.url })) };
      } catch (e) {
        return { f, error: (e as Error).message };
      }
    }),
  );
  await withLock(paths.lock(lib), () => {
    const all = listFeeds(lib);
    const cache = readCache(lib);
    const now = nowIso();
    for (const r of results) {
      if (!all.some((f) => f.url === r.f.url && f.followed_at === r.f.followed_at)) continue;
      const prev = cache.feeds[r.f.url];
      if ((prev?.generation ?? 0) > generation) continue;
      cache.feeds[r.f.url] = "error" in r
        ? { generation, checked_at: now, error: r.error, posts: prev?.posts ?? [] }
        : { generation, checked_at: now, posts: r.posts };
    }
    for (const url of Object.keys(cache.feeds)) if (!all.some((f) => f.url === url)) delete cache.feeds[url];
    writeAtomic(cachePath(lib), JSON.stringify(cache));
  });
  await clearPreviews(lib);
  return { checked: feeds.length, failed: results.flatMap((r) => ("error" in r ? [{ feed: r.f.url, error: r.error! }] : [])) };
}

type ReadMark = { url: string; at: string; unread?: boolean };

/** Which posts he has read: the latest mark per post wins, across devices. */
function readSet(lib: Library): Set<string> {
  const last = new Map<string, ReadMark>();
  for (const m of readLog<ReadMark>(readPath(lib))) {
    const key = linkKey(m.url);
    const prev = last.get(key);
    if (!prev || m.at >= prev.at) last.set(key, m);
  }
  return new Set([...last.entries()].filter(([, m]) => !m.unread).map(([key]) => key));
}

export function markRead(lib: Library, urls: string[], read = true): void {
  const at = nowIso();
  for (const url of urls) appendJsonl(deviceLog(readPath(lib)), read ? { url, at } : { url, at, unread: true });
}

export type FeedPost = Post & { read: boolean; feed_title: string; preview?: string };
export type FeedView = { feeds: (Feed & { checked_at?: string; error?: string })[]; posts: FeedPost[] };

/** The Feed: posts from the last two weeks, newest first, without the ones he kept as sources. */
export function feedView(lib: Library, now = new Date()): FeedView {
  const feeds = listFeeds(lib);
  const cache = readCache(lib);
  const read = readSet(lib);
  // The same link written another way (http, www, tags) is the same post, as when adding it.
  const kept = new Set(allItems(lib).flatMap((i) => (i.meta.url ? [linkKey(i.meta.url)] : [])));
  const previews = new Map(listItems(lib, { preview: true }).flatMap((i) => (i.meta.url ? [[linkKey(i.meta.url), i.meta.id] as const] : [])));
  const seen = new Set<string>();
  const posts = feeds
    .flatMap((f) => (cache.feeds[f.url]?.posts ?? []).map((p) => ({ ...p, feed_title: f.title })))
    // A post with no date counts as new until the feed stops listing it.
    .filter((p) => !kept.has(linkKey(p.url)) && inFeedWindow(p, now.getTime()) && !seen.has(linkKey(p.url)) && seen.add(linkKey(p.url)))
    .map((p) => ({ ...p, read: read.has(linkKey(p.url)), ...(previews.has(linkKey(p.url)) ? { preview: previews.get(linkKey(p.url)) } : {}) }))
    .sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""));
  return { feeds: feeds.map((f) => ({ ...f, checked_at: cache.feeds[f.url]?.checked_at, error: cache.feeds[f.url]?.error })), posts };
}

/** Opens a post to read: marks it read and returns the source to show, a preview unless he already
 *  kept it. Filed under its feed's skills if he keeps it. */
export async function openPost(lib: Library, url: string): Promise<Item> {
  const post = Object.values(readCache(lib).feeds).flatMap((c) => c.posts).find((p) => p.url === url);
  const feed = post && listFeeds(lib).find((f) => f.url === post.feed);
  const item = await addSource(lib, url, { preview: true, skills: feed?.skills });
  markRead(lib, [url]);
  return item;
}

/** A preview with anything of his in it: a highlight or a line in its source note. */
const hasHisWork = (item: Item) => readAnnotations(item).some((a) => a.status !== "deleted") || readNotes(item).trim() !== "";

/** Leaving a previewed post: kept if he highlighted or wrote in it, else deleted. Decided under the
 *  lock from the source as it is then, so a note or highlight saved while this waited keeps it. */
export async function closePost(lib: Library, id: string): Promise<"kept" | "dropped" | "source"> {
  const r = await withLock(paths.lock(lib), () => {
    const item = findItem(lib, id);
    if (!item.meta.preview) return "source";
    if (hasHisWork(item)) return "kept";
    rmSync(item.dir, { recursive: true, force: true });
    return "dropped";
  });
  if (r === "kept") await keepPreview(lib, id);
  return r;
}

/** Previews the app left behind (it quit with one open): kept if they hold his work, else deleted. */
export async function clearPreviews(lib: Library, now = Date.now()): Promise<void> {
  for (const item of listItems(lib, { preview: true })) {
    if (now - Date.parse(item.meta.preview!) < PREVIEW_MS) continue;
    await closePost(lib, item.meta.id);
  }
}
