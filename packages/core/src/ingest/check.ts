// What comes back from a page is checked before it becomes a source: a bot check, a login wall or a
// page with next to no text is refused with what to do next, never saved as if it were the content.
// Metadata a page gets wrong (a sentence as the author, a list of dates) is left blank instead.

/** Below this many words a page is not something to read: a wall, a shell built in the browser. */
export const MIN_WORDS = 50;

/** Chinese and Japanese letters. */
const CJK_SCRIPTS = "\\p{sc=Han}\\p{sc=Hiragana}\\p{sc=Katakana}";

/** Words in any script. Chinese and Japanese put no spaces between words, so each of their characters counts as one. */
export function wordCount(md: string): number {
  const text = md.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\]\([^)]*\)/g, "]");
  const CJK = new RegExp(`[${CJK_SCRIPTS}]`, "gu");
  const spaced = text.replace(CJK, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return spaced + (text.match(CJK)?.length ?? 0);
}

// Chinese and Japanese letters, punctuation and full-width forms.
const CJK_END = new RegExp(`[${CJK_SCRIPTS}\\u3000-\\u303f\\uff00-\\uffef]$`, "u");
const CJK_START = new RegExp(`^[${CJK_SCRIPTS}\\u3000-\\u303f\\uff00-\\uffef]`, "u");
/** What goes between two lines joined into one paragraph: a space, except where a Chinese or Japanese
 *  sentence wraps, since those scripts put no space between words. */
export const lineBreakSpace = (before: string, after: string): string => (CJK_END.test(before) && CJK_START.test(after) ? "" : " ");

/** Text with Markdown's own characters escaped, so it reads as what it says. */
export const escapeMarkdown = (s: string) => s.replace(/([\\`*_[\]<>])/g, "\\$1");

/** The next step for a page only his browser can open (D96). */
export const FROM_TAB = "add it from the browser (Browser tab in the add box, or `ore add --tab`)";

export const BOT = /client challenge|just a moment|attention required|verify (?:to continue|you are human)|are you a (?:robot|human)|checking (?:if the site connection is secure|your browser)|security check|access denied|enable javascript and cookies|a required part of this site couldn.t load/i;
const LOGIN = /\b(?:log ?in|sign ?in|sign up|create (?:an|your) account|subscribe to (?:continue|read))\b/i;

/** Why a page can't be kept, as the message to show, or null when it reads as content. */
export function refusal(title: string, markdown: string, host: string): string | null {
  const words = wordCount(markdown);
  if (words < 300 && (BOT.test(title) || BOT.test(markdown.slice(0, 2000))))
    return `${host} showed a bot check instead of the page, so Ore couldn’t read it. Open it in your browser and ${FROM_TAB}, or paste its text here instead.`;
  if (words < MIN_WORDS && LOGIN.test(markdown))
    return `${host} only shows this page to signed-in visitors. Open it in your browser and ${FROM_TAB}, or paste its text here instead.`;
  if (words < MIN_WORDS)
    return `Found almost no text on ${host} (${words} words): the page may be built in the browser or need a sign-in. Open it in your browser and ${FROM_TAB}, or paste its text here instead.`;
  return null;
}

/** A file's author unless it is only a tool's or a template's default name ("anonymous" is ReportLab's). */
export const fileAuthor = (a: string | undefined): string | undefined =>
  a?.trim() && !/^(python-(docx|pptx)|openpyxl|microsoft office user|windows user|user|owner|author|unknown|anonymous|administrator|admin)$/i.test(a.trim()) ? a.trim() : undefined;

/** An author as a page names one, or undefined when it isn't a name: a sentence fragment, a list of initials, a long blurb. */
export function cleanAuthor(a: string | undefined): string | undefined {
  const s = fileAuthor(a?.replace(/\s+/g, " "));
  if (!s || s.length > 120 || !/^[\p{Lu}\p{Lo}\d@]/u.test(s)) return undefined;
  const parts = s.split(/\s*,\s*/);
  if (parts.length > 1 && parts.every((p) => p.replace(/\W/g, "").length <= 3)) return undefined;
  return s;
}

/** A file's metadata title, or undefined when it is only a tool's default or a file name ("Document1",
 *  "Untitled", "Microsoft Word - draft.docx", "1706"): the text's own heading is a better title than those.
 *  Real titles that look alike stay: "Microsoft Word 2019 Step by Step", "Untitled Goose Game", and with
 *  `numbers` (an EPUB, whose title a publisher wrote) a book's bare number, "1984" or "2666". */
export function cleanTitle(t: string | undefined, { numbers = false } = {}): string | undefined {
  const s = t?.replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  if (numbers && /^\d+$/.test(s)) return s;
  const junk = /^(?:\d+|[\w.-]+\.(?:docx?|pptx?|pdf|dvi|ps|tex|indd|md|txt|pages|key|xlsx?|csv|numbers)|book\s*\d+|sheet\s*\d+|microsoft (?:word|powerpoint) - .*|powerpoint presentation|untitled(?:[ -]+(?:document|presentation|deck|\d+))*|(?:new )?(?:document|presentation|slide)\s*\d*)$/i;
  return junk.test(s) ? undefined : s;
}

/** A date as a page gives one, or undefined unless it is one real date ("1 month ago", "Elapsed00:00" and lists are dropped). */
export function cleanDate(d: string | undefined): string | undefined {
  const s = d?.trim();
  if (!s || s.length > 40 || (s.match(/\d{4}/g) ?? []).length !== 1 || Number.isNaN(Date.parse(s))) return undefined;
  return s;
}
