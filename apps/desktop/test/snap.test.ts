import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const w = new Window();
for (const k of ["document", "NodeFilter", "HTMLElement", "Node", "Range"] as const) (globalThis as Record<string, unknown>)[k] = (w as unknown as Record<string, unknown>)[k];
const { snapText, snapRange } = await import("../src/snap");

const T = "Start with the simplest solution, then grow it.";
const end = (t: string, o: number) => t.slice(0, snapText(t, o, "end"));
const start = (t: string, o: number) => t.slice(snapText(t, o, "start"));

describe("highlight edges snap to whole words", () => {
  test("an end mid-word goes on to the word's end, without a comma after it", () => {
    expect(end(T, T.indexOf("solution") + 3)).toBe("Start with the simplest solution");
  });
  test("an end on a sentence's last word takes its full stop, and a closing quote or bracket after it", () => {
    expect(end(T, T.length - 2)).toBe(T);
    expect(end('He said "go now." Then left', 13)).toBe('He said "go now."');
    expect(end("It worked (mostly). Then", 14)).toBe("It worked (mostly).");
    expect(end("Is it? Yes", 4)).toBe("Is it?");
    expect(end("Wait… really", 2)).toBe("Wait…");
    // A bracket with no sentence end in it stays out.
    expect(end("see (Figure 2) here", 13)).toBe("see (Figure 2");
  });
  test("an end already between words stays where he put it, without the space", () => {
    expect(end(T, T.indexOf(" then"))).toBe("Start with the simplest solution,");
    expect(end("a  b", 2)).toBe("a");
  });
  test("an end just past a sentence's last word still takes its full stop", () => {
    expect(end(T, T.length - 1)).toBe(T);
  });
  test("a start mid-word goes back to the word's start, never to an opening quote before it", () => {
    expect(start(T, T.indexOf("simplest") + 4)).toBe("simplest solution, then grow it.");
    expect(start('He said "go now."', 10)).toBe('go now."');
    expect(start('He said "go now."', 8)).toBe('"go now."');
  });
  test("a start in a run of spaces goes on to the next word", () => {
    expect(start("a  b", 2)).toBe("b");
  });
  test("a word with an apostrophe is one word", () => {
    expect(end("We don't know", 5)).toBe("We don't");
    expect(start("We don't know", 6)).toBe("don't know");
  });
  test("text with no spaces snaps to the words the system finds, never the whole line", () => {
    const ja = "私は学生です。毎日勉強します。";
    const cut = end(ja, 1);
    expect(cut.length).toBeLessThan(ja.length / 2);
    expect(ja.startsWith(cut)).toBe(true);
  });
});

describe("a selection on the page snaps across inline marks", () => {
  const html = (h: string) => {
    const el = document.createElement("div");
    el.innerHTML = h;
    document.body.append(el as unknown as Node);
    return el;
  };
  const textAt = (el: HTMLElement, phrase: string): [Text, number] => {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
      const i = n.data.indexOf(phrase);
      if (i >= 0) return [n, i];
    }
    throw new Error(phrase);
  };

  test("a word split by bold or a link comes in whole, with its full stop", () => {
    const el = html("<p>Testing <strong>bene</strong>fits memory <a href='#'>reten</a>tion. Next</p>");
    const [a, ao] = textAt(el, "bene"); // from "ne", inside the bold
    const [z] = textAt(el, "reten");
    const r = document.createRange();
    r.setStart(a, ao + 2);
    r.setEnd(z, 2);
    expect(snapRange(r).toString()).toBe("benefits memory retention.");
  });
  test("code and math are left exactly as selected", () => {
    const el = html("<p>Call <code>parseInt</code> twice</p>");
    const [c] = textAt(el, "parseInt");
    const r = document.createRange();
    r.setStart(c, 2);
    r.setEnd(c, 5);
    expect(snapRange(r).toString()).toBe("rse");
  });
});
