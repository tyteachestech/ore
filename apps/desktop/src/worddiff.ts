/** A piece of a word diff: text both versions share, or words only the old (`del`) or new (`add`) one has. */
export type Piece = { text: string; kind: "same" | "del" | "add" };

/** Words, runs of spaces, and single punctuation marks, so "card," and "card" differ only by the comma. */
const tokens = (s: string) => s.match(/\s+|[\p{L}\p{N}_'’-]+|[^\s\p{L}\p{N}_]/gu) ?? [];

/** What changed between two versions of a card's text, word by word (D161; drift-ui's diff viewer, MIT):
 *  the longest run of words they share, kept in order, and what each side adds around it. Spaces between
 *  two changes join them, so "~~old phrase~~ **new phrase**" reads as one swap, not word-by-word stripes.
 *  Card text is short, so the plain LCS table is fast enough. */
export function wordDiff(was: string, now: string): Piece[] {
  const a = tokens(was), b = tokens(now);
  const n = a.length, m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const raw: Piece[] = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) raw.push({ text: a[i++]!, kind: "same" }), j++;
    else if (j < m && (i === n || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) raw.push({ text: b[j++]!, kind: "add" });
    else raw.push({ text: a[i++]!, kind: "del" });
  }
  // A shared space between two changes belongs to both sides of the swap.
  const spaced = raw.flatMap((p, k): Piece[] => {
    const changed = (q?: Piece) => q && q.kind !== "same";
    return p.kind === "same" && /^\s+$/.test(p.text) && changed(raw[k - 1]) && changed(raw[k + 1]) ? [{ text: p.text, kind: "del" }, { text: p.text, kind: "add" }] : [p];
  });
  // Deletions before additions within a change, then runs of one kind joined.
  const out: Piece[] = [];
  for (let k = 0; k < spaced.length; ) {
    if (spaced[k]!.kind === "same") {
      push(out, spaced[k++]!);
      continue;
    }
    const del: string[] = [], add: string[] = [];
    for (; k < spaced.length && spaced[k]!.kind !== "same"; k++) (spaced[k]!.kind === "del" ? del : add).push(spaced[k]!.text);
    // Tokens both sides of a change start or end with are shared (a tie in the table can leave a space inside).
    let pre = 0, suf = 0;
    while (pre < del.length && pre < add.length && del[pre] === add[pre]) pre++;
    while (suf < del.length - pre && suf < add.length - pre && del[del.length - 1 - suf] === add[add.length - 1 - suf]) suf++;
    const part = (t: string[], from: number, to: number) => t.slice(from, to).join("");
    if (pre) push(out, { text: part(del, 0, pre), kind: "same" });
    if (del.length - pre - suf) push(out, { text: part(del, pre, del.length - suf), kind: "del" });
    if (add.length - pre - suf) push(out, { text: part(add, pre, add.length - suf), kind: "add" });
    if (suf) push(out, { text: part(del, del.length - suf, del.length), kind: "same" });
  }
  return out;
}

function push(out: Piece[], p: Piece) {
  const last = out[out.length - 1];
  if (last && last.kind === p.kind) last.text += p.text;
  else out.push({ ...p });
}
