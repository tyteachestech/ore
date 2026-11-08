import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const w = new Window();
for (const k of ["document", "NodeFilter", "HTMLElement", "Node"] as const) (globalThis as Record<string, unknown>)[k] = (w as unknown as Record<string, unknown>)[k];
const { sentences, speechTrouble } = await import("../src/listen");

describe("listen (D85)", () => {
  test("sentences run in reading order, across inline marks, skipping code and stamps", () => {
    const root = document.createElement("article") as unknown as HTMLElement;
    root.innerHTML = `
      <h2>The testing effect</h2>
      <p>Retrieval is <em>effortful</em>. It works! Does it last?</p>
      <pre><code>const x = 1;</code></pre>
      <ul><li><p>First point.</p></li><li>Second point</li></ul>
      <p class="tp"><span class="ts">1:05</span>Spoken words here.</p>
      <p>—</p>`;
    expect(sentences(root).map((r) => r.toString())).toEqual([
      "The testing effect",
      "Retrieval is effortful.",
      "It works!",
      "Does it last?",
      "First point.",
      "Second point",
      "Spoken words here.",
    ]);
  });
});

test("a speech error toast says what happened in words, never the raw code", () => {
  for (const code of ["synthesis-failed", "voice-unavailable", "audio-busy", "network", "not-allowed", "anything-new"]) {
    const words = speechTrouble(code);
    expect(words).not.toContain(code);
    expect(words).toMatch(/^the |^macOS /);
  }
});
