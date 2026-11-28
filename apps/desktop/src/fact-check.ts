/** Whether what he typed for a Fact exercise is its answer (D359), so ↵ suggests Good only then.
 *  Strict on purpose: a right answer worded differently says no and he rates it himself, but a wrong one never
 *  says yes. Case, spacing, punctuation, accents and a leading article don't count; what the answer puts in
 *  brackets is optional; one slip of the keys is forgiven in a word of 5 letters or more, two from 10, never in
 *  a number. */
export function factMatches(typed: string, answer: string): boolean {
  const said = norm(typed);
  if (!said) return false;
  const brackets = [...answer.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]!);
  const forms = [answer, answer.replace(/\([^)]*\)/g, " "), ...brackets].map(norm).filter(Boolean);
  return forms.some((f) => close(said, f));
}

const norm = (s: string) => {
  const plain = s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, " ").replace(/(?<!\d)\.|\.(?!\d)/g, " ").trim().replace(/\s+/g, " ");
  const bare = plain.replace(/^(the|a|an) /, "");
  return bare || plain;
};

const close = (a: string, b: string) => {
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b)) return false;
  const n = Math.min(a.length, b.length);
  const allowed = n >= 10 ? 2 : n >= 5 ? 1 : 0;
  return allowed > 0 && distance(a, b, allowed) <= allowed;
};

/** Edits between two strings (a swap of two letters is one), stopping once past `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j]!, prev2[j - 2]! + 1);
    }
    if (Math.min(...cur) > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length]!;
}
