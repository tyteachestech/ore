import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

// Transcript words located in the rendered reader text (D49), on a happy-dom document.
const w = new Window();
for (const k of ["document", "NodeFilter"] as const) (globalThis as Record<string, unknown>)[k] = (w as unknown as Record<string, unknown>)[k];

const { indexText } = await import("../src/text");
const { alignWords, wordAtOffset, wordAtTime } = await import("../src/transcript");

// As Reader renders a transcript: the [mm:ss] stays in the DOM, in a gutter span, without brackets.
const html = `<p class="tp"><span class="ts">00:00</span>Welcome to the talk</p><p class="tp"><span class="ts">00:40</span>40 ideas &amp; more.</p>`;

describe("transcript alignment", () => {
  test("words map to rendered offsets, skipping timestamps, and back", () => {
    const root = document.createElement("article");
    root.innerHTML = html;
    const idx = indexText(root as unknown as HTMLElement);
    const words: [number, string][] = [[0, "Welcome"], [0.5, "to"], [0.8, "the"], [1, "talk"], [40, "40"], [41, "ideas"], [41.5, "&"], [42, "more."]];
    const m = alignWords(idx, words);
    expect(m.pos.length).toBe(8);
    // "40" is the spoken word, not the "00:40" stamp in front of it.
    expect(idx.chars.slice(m.pos[4]!, m.end[4]! + 1)).toBe("40");
    expect(idx.nodes[idx.node[m.pos[4]!]!]!.parentElement?.className).toBe("tp");
    expect(wordAtTime(m, -1)).toBe(-1);
    expect(wordAtTime(m, 0.9)).toBe(2);
    expect(wordAtTime(m, 100)).toBe(7);
    expect(wordAtOffset(m, m.pos[5]! + 2)).toBe(5);
    expect(wordAtOffset(m, m.end[3]! + 1)).toBe(4); // between words → the next one
  });

  test("a word missing from the text is skipped without losing the rest", () => {
    const root = document.createElement("article");
    root.innerHTML = `<p>Welcome talk</p>`;
    const m = alignWords(indexText(root as unknown as HTMLElement), [[0, "Welcome"], [1, "lost"], [2, "talk"]]);
    expect(Array.from(m.time)).toEqual([0, 2]);
  });

  test("a page's text above the transcript (D92) never takes its words", () => {
    const root = document.createElement("article");
    root.innerHTML = `<p>Welcome to the lesson text.</p><h2>Video transcript</h2>${html}`;
    const idx = indexText(root as unknown as HTMLElement);
    const m = alignWords(idx, [[0, "Welcome"], [0.5, "to"], [0.8, "the"], [1, "talk"]]);
    expect(m.pos.length).toBe(4);
    expect(idx.nodes[idx.node[m.pos[0]!]!]!.parentElement?.className).toBe("tp");
  });
});

describe("stampBefore: when a quote a card points to is spoken (D99)", () => {
  test("the last stamp at or before the quote, as the player shows it", async () => {
    const { stampBefore } = await import("../src/transcript");
    const body = "[00:42] So why not talk to it directly?\n\n[06:42] The second reason is that it's modular.\n\n[62:05] Late.";
    expect(stampBefore(body, body.indexOf("The second"))).toBe("6:42");
    expect(stampBefore(body, body.indexOf("[06:42]"))).toBe("6:42");
    expect(stampBefore(body, body.indexOf("why not"))).toBe("0:42");
    expect(stampBefore(body, body.indexOf("Late"))).toBe("1:02:05");
    expect(stampBefore("No stamps here.", 3)).toBeUndefined();
  });
});
