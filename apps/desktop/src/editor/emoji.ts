import { defaultEmojiDataResolver } from "frimousse";

/** One emoji as the `:` menu needs it: the character, its name and its search words. */
export type EmojiEntry = { emoji: string; label: string; tags: string[] };

// The same Emojibase data the icon picker uses, shipped with the app (vite.config.ts).
let data: Promise<EmojiEntry[]> | null = null;
/** Loads the emoji list once; a failed load is tried again next time. */
export function loadEmoji(): Promise<EmojiEntry[]> {
  data ??= Promise.resolve(defaultEmojiDataResolver("en", { emojibaseUrl: "/emojibase" })).then(
    (d) => d.emojis.map((e) => ({ emoji: e.emoji, label: e.label, tags: e.tags })),
    (e: unknown) => {
      data = null;
      throw e;
    },
  );
  return data;
}

/** The emoji for what follows a typed `:` (Slack and Notion style): names that start with it
 *  first (shortest first, so :fir finds Fire), then search words, then names that contain it. `thumbs_up` matches "thumbs up". */
export function findEmoji(all: EmojiEntry[], query: string, n = 8): EmojiEntry[] {
  const q = query.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (!q) return [];
  const rank = (e: EmojiEntry) => {
    const label = e.label.toLowerCase();
    if (label.startsWith(q)) return 0;
    if (e.tags.includes(q)) return 1;
    if (label.split(/\s+/).some((w) => w.startsWith(q))) return 2;
    if (e.tags.some((t) => t.startsWith(q))) return 3;
    return label.includes(q) ? 4 : 9;
  };
  return all
    .map((e, i) => ({ e, r: rank(e), i }))
    .filter((x) => x.r < 9)
    .sort((a, b) => a.r - b.r || a.e.label.length - b.e.label.length || a.i - b.i)
    .slice(0, n)
    .map((x) => x.e);
}

/** The `:query` right before the caret, or null. It needs a start of line, a space or an opening
 *  bracket before the colon and a letter after it, so 10:30, https:// and "Note: x" never open it. */
export const emojiTrigger = (before: string): RegExpMatchArray | null => before.match(/(?:^|[\s([{])(:([a-z][a-z0-9_+-]{0,29}))$/i);
