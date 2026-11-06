// Notion's @ dates in a note: what he types after @ becomes a date, saved as plain `2026-11-12` text,
// which sorts, greps and reads the same to him, GitHub and an AI.

/** A row of the @ menu: the date in words, and the text it saves. */
export type DateRow = { label: string; iso: string };

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plus = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
/** A word he has typed the start of: two letters at least, so "m" alone is not May or Monday. */
const prefix = (word: string, names: string[]) => (word.length >= 2 ? names.findIndex((n) => n.startsWith(word)) : -1);

function on(y: number, m: number, d: number): Date | null {
  const t = new Date(y, m, d);
  return t.getMonth() === m && t.getDate() === d ? t : null;
}

/** The dates the menu offers for `q` (what follows the @), as of `now`. */
export function dateRows(q: string, now = new Date()): DateRow[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const s = q.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  const row = (d: Date, label = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })): DateRow => ({ label, iso: isoOf(d) });
  const named: [string, number][] = [["today", 0], ["tomorrow", 1], ["yesterday", -1]];
  const words = named.filter(([n]) => n.startsWith(s));
  if (words.length) return words.map(([n, k]) => row(plus(today, k), n[0]!.toUpperCase() + n.slice(1)));

  let m: RegExpMatchArray | null;
  const one = (d: Date | null) => (d ? [row(d)] : []);
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return one(on(+m[1]!, +m[2]! - 1, +m[3]!));
  if ((m = s.match(/^in (\d{1,3}) (day|days|week|weeks)$/))) return one(plus(today, +m[1]! * (m[2]!.startsWith("week") ? 7 : 1)));
  if ((m = s.match(/^(\d{1,3}) (day|days|week|weeks) ago$/))) return one(plus(today, -m[1]! * (m[2]!.startsWith("week") ? 7 : 1)));
  if ((m = s.match(/^(next |last )?([a-z]+)$/))) {
    const day = prefix(m[2]!, DAYS);
    if (day >= 0) {
      // The coming one, never today. "next": that day of next week (on a Thursday, next Friday is a
      // week tomorrow). "last": the one before today.
      if (m[1] === "last ") return one(plus(today, -(((today.getDay() - day + 7) % 7) || 7)));
      const ahead = ((day - today.getDay() + 7) % 7) || 7;
      return one(plus(today, m[1] === "next " && today.getDay() + ahead <= 6 ? ahead + 7 : ahead));
    }
  }
  // "nov 12", "12 november", with a year or without (this year).
  if ((m = s.match(/^([a-z]+) (\d{1,2})(?: (\d{4}))?$/)) || (m = s.match(/^(\d{1,2}) ([a-z]+)(?: (\d{4}))?$/))) {
    const [a, b] = /^\d/.test(m[1]!) ? [m[2]!, m[1]!] : [m[1]!, m[2]!];
    const month = prefix(a, MONTHS);
    if (month >= 0) return one(on(m[3] ? +m[3] : today.getFullYear(), month, +b));
  }
  return [];
}
