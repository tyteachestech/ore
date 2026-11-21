import { expect, test } from "bun:test";
import { landing } from "../src/ore";
import { foundIn } from "../src/search-landing";

const hit = (snippet: string) => ({ kind: "item", ref: "a", title: "T", snippet });

// F-new-search-landing: search matches his words apart, but a match in a source's text handed Find the whole query
// as one phrase, so the source opened at its top with "Not found" unless he had typed an exact phrase.
test("a text match lands on words the source holds: the query when it is there as typed, else the stretch of the snippet that holds what matched", () => {
  // Typed as it stands in the text: Find gets it whole, and the passage to start from.
  expect(foundIn("…the [testing] [effect] is one of the most…", "testing effect")).toEqual({ words: "testing effect", near: "the testing effect is one of the most" });
  // Words apart on one line: the stretch from the first to the last, when it is short and plain.
  expect(foundIn("…on their own.\n\n## [Why] it [works]\n\nEach successful [retrieval] changes the memory…", "why retrieval works")).toEqual({ words: "Why it works", near: "Why it works" });
  // Too far apart for one stretch: the first matched word, starting from its line.
  expect(foundIn("…[Effortful] retrieval, the kind that feels a little hard, produces larger [gains]…", "effortful gains")).toEqual({
    words: "Effortful",
    near: "Effortful retrieval, the kind that feels a little hard, produces larger gains",
  });
  // Markdown between them is not in the text he reads: one word, and a line with its marks left out of `near`.
  expect(foundIn("- a **[bold]** [claim] here", "bold claim")).toEqual({ words: "bold", near: undefined });
  // The source's own brackets are not matches: a line of links does not outrank the line with the word, and a
  // snippet cut inside a bracket is no error.
  expect(foundIn("see [one](a) and [two](b)…[Spacing] helps", "spacing")).toEqual({ words: "spacing", near: "Spacing helps" });
  expect(foundIn("a note [1] and [] and [", "recall")).toEqual({ words: "recall", near: undefined });
  // No snippet (a match by title alone): the query, as before.
  expect(foundIn("", "anything")).toEqual({ words: "anything", near: undefined });
});

test("landing carries the passage after the words, on a line of its own", () => {
  expect(landing(hit("## [Why] it [works]"), "why works")).toBe("find:Why it works\nWhy it works");
  expect(landing(hit(""), "plain")).toBe("find:plain");
  expect(landing({ ...hit("x"), kind: "notes" }, "q")).toBe("note:q");
});
