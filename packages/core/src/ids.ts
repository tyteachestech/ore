// ULID: 48-bit ms timestamp + 80 bits randomness, Crockford base32, 26 chars.
// Monotonic within one process so IDs created in the same ms still sort.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

let lastTime = -1;
let lastRandom: number[] = [];

function encodeTime(ms: number): string {
  let out = "";
  for (let i = 0; i < 10; i++) {
    out = ALPHABET[ms % 32] + out;
    ms = Math.floor(ms / 32);
  }
  return out;
}

function randomDigits(): number[] {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b % 32);
}

function increment(digits: number[]): number[] {
  const next = [...digits];
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i]! < 31) {
      next[i]!++;
      return next;
    }
    next[i] = 0;
  }
  throw new Error("ULID random overflow");
}

export function ulid(now: number = Date.now()): string {
  lastRandom = now === lastTime ? increment(lastRandom) : randomDigits();
  lastTime = now;
  return encodeTime(now) + lastRandom.map((d) => ALPHABET[d]).join("");
}

export const isUlid = (s: string): boolean => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(s);

export function slugify(title: string, max = 60): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (slug.slice(0, max).replace(/-+$/, "") || "untitled");
}

export const nowIso = (d: Date = new Date()): string => d.toISOString();

/** The local calendar day, "YYYY-MM-DD" (what `toLocaleDateString("sv-SE")` gives, without ICU's cost,
 *  which adds up over every review in the log). */
export function localDay(d: Date | string): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
