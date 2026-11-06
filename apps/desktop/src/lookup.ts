import { invoke } from "@tauri-apps/api/core";

// Look Up (D83): a word or short phrase in the macOS dictionary, as Apple Books does.

/** Short enough to be a term to look up, not a passage: up to three words. */
export const lookable = (text: string) => {
  const t = text.trim();
  return !!t && t.length <= 40 && t.split(/\s+/).length <= 3;
};

/** The macOS dictionary's entry (offline, instant), or null when it has none. */
export async function define(word: string): Promise<string | null> {
  try {
    return (await invoke<string | null>("define", { word })) ?? null;
  } catch {
    return null;
  }
}

/** Dictionary Services gives one line: "word | pronunciation | adjective lasting … • … ORIGIN …".
 *  Split off the headword and pronunciation, and break the rest where the printed entry does. */
export function entry(text: string): { head: string; pron: string; body: string } {
  const parts = text.split(" | ");
  const [head, pron, body] = parts.length >= 3 ? [parts[0]!, parts[1]!, parts.slice(2).join(" | ")] : ["", "", text];
  return {
    head: head.trim(),
    pron: pron.trim(),
    body: body
      .replace(/\s*•\s*/g, "\n• ")
      .replace(/\s+(?=(?:DERIVATIVES|ORIGIN|PHRASES|PHRASAL VERBS|USAGE)\b)/g, "\n\n")
      .trim(),
  };
}

/** The word under a point on screen, as a range, for Look Up with nothing selected (macOS's ⌃⌘D). */
export function wordAt(x: number, y: number, within: HTMLElement): Range | null {
  const caret = document.caretRangeFromPoint?.(x, y);
  const node = caret?.startContainer;
  if (!caret || !node || node.nodeType !== Node.TEXT_NODE || !within.contains(node)) return null;
  const text = node.textContent ?? "";
  for (const s of new Intl.Segmenter(undefined, { granularity: "word" }).segment(text)) {
    if (s.isWordLike && caret.startOffset >= s.index && caret.startOffset <= s.index + s.segment.length) {
      const r = document.createRange();
      r.setStart(node, s.index);
      r.setEnd(node, s.index + s.segment.length);
      // The caret lands on the nearest character even off the end of a line: only a word under the pointer counts.
      const box = r.getBoundingClientRect();
      return x >= box.left - 2 && x <= box.right + 2 && y >= box.top - 2 && y <= box.bottom + 2 ? r : null;
    }
  }
  return null;
}

const HEADING = /^#{1,6}\s+(.+?)\s*#*\s*$/;

/** Explain (side quests): the sections after this spot where the term comes up again, so he can tell
 *  whether the rest of the source leans on it (then learning it now pays). `from` is where the term
 *  ends in the body. Case and a plural "s" are ignored; the section he is in isn't named. */
export function againIn(body: string, from: number, term: string): { sections: string[]; later: boolean } {
  const t = term.replace(/\s+/g, " ").trim().toLowerCase();
  if (!t) return { sections: [], later: false };
  const text = body.toLowerCase();
  const word = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);
  // Heading of the section each offset falls in.
  const heads: { at: number; name: string }[] = [];
  let at = 0;
  for (const line of body.split("\n")) {
    const m = line.match(HEADING);
    if (m) heads.push({ at, name: m[1]!.replace(/[*_`]/g, "").trim() });
    at += line.length + 1;
  }
  const sectionAt = (i: number) => heads.filter((h) => h.at <= i).at(-1)?.name ?? null;
  const here = sectionAt(from);
  const sections: string[] = [];
  let later = false;
  for (let i = text.indexOf(t, from); i >= 0; i = text.indexOf(t, i + t.length)) {
    let end = i + t.length;
    if (text[end] === "s") end++;
    else if (text.startsWith("es", end)) end += 2;
    if (word(text[i - 1]) || word(text[end])) continue;
    later = true;
    const s = sectionAt(i);
    if (s && s !== here && !sections.includes(s)) sections.push(s);
  }
  return { sections, later };
}

/** "Comes up again in Streaming and Tool use." from `againIn`, or null when it doesn't. */
export function againText(a: { sections: string[]; later: boolean }): string | null {
  const s = a.sections;
  if (!s.length) return a.later ? "Comes up again further on." : null;
  const names = s.length > 3 ? [...s.slice(0, 2), `${s.length - 2} more sections`] : s;
  return `Comes up again in ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]}.`;
}

/** The question "Learn this" starts from, for him to edit. */
export const askAbout = (term: string) => `What is ${term.replace(/\s+/g, " ").trim()}?`;
