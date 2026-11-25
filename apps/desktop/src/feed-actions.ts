import { allOrNone, change } from "./change";
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
  const values = [...urls].map((url) => ({ field: `feed post ${url}`, before: !on, after: on }));
  return change(io.notify, {
    values,
    key: [...urls].map((url) => `feed post ${url}`),
    message: on ? `Marked${what} read` : `Marked${what} unread`,
    show: (v, owned) => {
      const states = new Map(values.filter((value) => !owned || owned.includes(value.field)).map((value) => [value.field, v ? value.after : value.before]));
      io.show((posts) => posts.map((p) => states.has(`feed post ${p.url}`) ? { ...p, read: states.get(`feed post ${p.url}`)! } : p));
    },
    write: (v) => allOrNone([true, false].flatMap((read) => {
      const group = [...urls].filter((_, i) => values[i]!.before === read);
      if (!group.length) return [];
      return [(forward: boolean) => io.run("feed", (forward ? on : read) ? "read" : "unread", ...group)];
    }), v),
  });
}
