import { describe, expect, test } from "bun:test";
import { anchor, locate, quoteSelector } from "../src/anchoring.ts";

const DOC =
  "# Spacing\n\nRetrieval practice beats rereading for long-term retention. " +
  "Spacing reviews over days strengthens memory more than massing them.\n\n" +
  "A second paragraph repeats: retrieval practice beats rereading.\n";

const PASSAGE = "Spacing reviews over days strengthens memory";

function selectorFor(text: string, passage: string) {
  const s = text.indexOf(passage);
  return quoteSelector(text, s, s + passage.length);
}

describe("anchoring", () => {
  test("position: unchanged text anchors by offsets", () => {
    const sel = selectorFor(DOC, PASSAGE);
    expect(sel.prefix.length).toBe(32);
    expect(anchor(DOC, sel)).toEqual({ start: sel.start, end: sel.end, method: "position" });
  });

  test("exact: text inserted before the passage shifts offsets", () => {
    const sel = selectorFor(DOC, PASSAGE);
    const edited = DOC.replace("# Spacing\n", "# Spacing and retrieval\n\nIntro added later.\n");
    const a = anchor(edited, sel)!;
    expect(a.method).toBe("exact");
    expect(edited.slice(a.start, a.end)).toBe(PASSAGE);
  });

  test("exact: duplicate quotes are disambiguated by prefix/suffix", () => {
    const quote = "retrieval practice beats rereading";
    const second = DOC.lastIndexOf(quote);
    const sel = quoteSelector(DOC, second, second + quote.length);
    const edited = "New first line.\n" + DOC;
    const a = anchor(edited, sel)!;
    expect(a.method).toBe("exact");
    expect(a.start).toBe(second + "New first line.\n".length);
  });

  test("fuzzy: the passage itself was edited slightly", () => {
    const sel = selectorFor(DOC, PASSAGE);
    const edited = DOC.replace("Spacing reviews over days strengthens", "Spacing reviews across days strengthens");
    const a = anchor(edited, sel)!;
    expect(a.method).toBe("fuzzy");
    expect(edited.slice(a.start, a.end)).toContain("across days strengthens memory");
  });

  test("fuzzy: words inserted inside the passage keep the full span", () => {
    const sel = selectorFor(DOC, PASSAGE);
    const edited = DOC.replace("over days strengthens memory", "over days strengthens long-term memory");
    const a = anchor(edited, sel)!;
    expect(a.method).toBe("fuzzy");
    expect(edited.slice(a.start, a.end)).toBe("Spacing reviews over days strengthens long-term memory");
  });

  test("orphan: the passage was removed", () => {
    const sel = selectorFor(DOC, PASSAGE);
    const edited = DOC.replace(/Spacing reviews[^.]*\./, "Totally different sentence about cooking pasta.");
    expect(anchor(edited, sel)).toBeNull();
  });

  test("locate: whitespace-insensitive and nearest to hint", () => {
    expect(locate(DOC, "Retrieval practice beats\nrereading")).not.toBeNull();
    expect(locate("Split **workflows** and **agents** here", "workflows and agents")).toEqual({ start: 8, end: 32 });
    const md = "good *agent* -computer interfaces (ACI).";
    const hit = locate(md, "good agent-computer interfaces")!;
    expect(md.slice(hit.start, hit.end)).toBe("good *agent* -computer interfaces");
    const first = DOC.indexOf("beats rereading");
    const second = DOC.lastIndexOf("beats rereading");
    expect(first).not.toBe(second);
    expect(locate(DOC, "beats rereading")!.start).toBe(first);
    expect(locate(DOC, "beats rereading", second)!.start).toBe(second);
    expect(locate(DOC, "not in the doc")).toBeNull();
  });
});
