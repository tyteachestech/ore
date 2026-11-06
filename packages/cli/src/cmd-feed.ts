import { arrangeFeeds, closePost, feedView, findFeed, followFeed, FeedSchema, markRead, openLibrary, openPost, refreshFeeds, restoreFeed, setFeed, unfollowFeed } from "@ore/core";
import type { Command } from "./types.ts";
import { int, need, str, strs, table } from "./util.ts";

const SUBS = ["find", "follow", "unfollow", "restore", "arrange", "set", "read", "unread", "open", "close"] as const;

export const feedCommands: Record<string, Command> = {
  feed: {
    usage: `[--refresh] | find <url> | follow <url> [--skill s] | unfollow <feed> | restore '<feed json>' --at N | arrange '["<feed url>",…]' | set <feed> [--name n] [--skill s] | read|unread <post url>… | open <post url> | close <item>   the Feed: posts of the last 14 days from the feeds he follows (--refresh fetches them first). A post opened is a preview, kept as a source only once he highlights or writes in it; close drops it otherwise`,
    options: { refresh: { type: "boolean" }, skill: { type: "string", multiple: true }, name: { type: "string" }, at: { type: "string" } },
    async run([sub, ...args], f) {
      const lib = openLibrary();
      if (sub && !(SUBS as readonly string[]).includes(sub)) throw new Error(`unknown subcommand "${sub}" (${SUBS.join("|")})`);
      if (sub === "find") {
        const found = await findFeed(need(args[0], "<url>"));
        return { data: found, text: `${found.title}: ${found.posts} posts${found.newest ? `, newest ${found.newest.slice(0, 10)}` : ""}\n  ${found.url}` };
      }
      if (sub === "follow") {
        const r = await followFeed(lib, need(args[0], "<url>"), { skills: strs(f.skill) });
        await refreshFeeds(lib, [r.feed.url]);
        return { data: r, text: `${r.already ? "Already following" : "Following"} ${r.feed.title}: ${r.found.posts} posts${r.found.newest ? `, newest ${r.found.newest.slice(0, 10)}` : ""}` };
      }
      if (sub === "unfollow") {
        const r = await unfollowFeed(lib, need(args[0], "<feed>"));
        return { data: r, text: `Unfollowed ${r.feed.title}` };
      }
      if (sub === "restore") {
        const feed = FeedSchema.parse(JSON.parse(need(args[0], "<feed json>")));
        const feeds = await restoreFeed(lib, feed, int(f.at, "at") ?? 0);
        return { data: feeds, text: `Following ${feed.title} again` };
      }
      if (sub === "arrange") {
        const order = JSON.parse(need(args[0], "<order>")) as unknown;
        if (!Array.isArray(order) || !order.every((u) => typeof u === "string")) throw new Error("give the feeds as a JSON list of their links");
        return { data: await arrangeFeeds(lib, order), text: "Arranged" };
      }
      if (sub === "set") {
        const feed = await setFeed(lib, need(args[0], "<feed>"), { title: str(f.name), skills: f.skill === undefined ? undefined : strs(f.skill) });
        return { data: feed, text: `${feed.title}: skills ${feed.skills.join(", ") || "none"}` };
      }
      if (sub === "read" || sub === "unread") {
        markRead(lib, need(args.length ? args : undefined, "<post url>"), sub === "read");
        return { data: { marked: args.length }, text: `Marked ${args.length} ${sub}` };
      }
      if (sub === "open") {
        const item = await openPost(lib, need(args[0], "<post url>"));
        return { data: { id: item.meta.id, title: item.meta.title, preview: !!item.meta.preview }, text: `${item.meta.preview ? "Reading" : "Already a source"}: ${item.meta.title} (${item.meta.id})` };
      }
      if (sub === "close") {
        const r = await closePost(lib, need(args[0], "<item>"));
        return { data: { result: r }, text: r === "kept" ? "Kept as a source" : r === "dropped" ? "Nothing kept; not saved" : "Already a source" };
      }
      const refreshed = f.refresh ? await refreshFeeds(lib) : undefined;
      const view = feedView(lib);
      const text = !view.feeds.length
        ? "Not following anything yet. `ore feed follow <url>` follows a blog, newsletter or YouTube channel."
        : view.posts.length
          ? table(view.posts.map((p) => [p.read ? " " : "•", (p.published ?? "").slice(0, 10), p.feed_title, p.title]))
          : "No posts in the last 14 days.";
      return { data: { ...view, ...(refreshed ? { failed: refreshed.failed } : {}) }, text };
    },
  },
};
