import { change } from "./change";
import type { Notify } from "./util";

/** One post or a selection, with one history step. Kept outside the screen so mixed selections
 *  and their writes can be exercised through the same action as Feed's menus and shortcuts. */
export function markFeedRead<T extends { url: string; read: boolean }>(post: T | T[], on: boolean, io: {
  notify: Notify;
  run: (...args: string[]) => Promise<unknown>;
  show: (update: (posts: T[]) => T[]) => void;
}): Promise<boolean> {
  // Posts already in the requested state are not part of this change or its inverse.
  const urls = new Set((Array.isArray(post) ? post : [post]).filter((p) => p.read !== on).map((p) => p.url));
  if (!urls.size) return Promise.resolve(true);
  const what = urls.size > 1 ? ` ${urls.size} posts` : "";
  return change(io.notify, {
    key: [...urls].map((url) => `feed post ${url}`),
    message: on ? `Marked${what} read` : `Marked${what} unread`,
    show: (v) => io.show((posts) => posts.map((p) => urls.has(p.url) ? { ...p, read: v === on } : p)),
    write: (v) => io.run("feed", v === on ? "read" : "unread", ...urls),
  });
}
