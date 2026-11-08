import { describe, expect, test } from "bun:test";
import { addHighlight, findAnnotation, readAnnotations } from "../src/annotations.ts";
import { pendingHighlights } from "../src/ai/enrich.ts";
import { addText } from "../src/ingest/index.ts";
import { findItem } from "../src/items.ts";
import { listTries, markTried, reflections } from "../src/tries.ts";
import { tempLibrary } from "./helpers.ts";

const ARTICLE = "# Openings\n\nOpen on the moment of change, then rewind to how we got there.\n\nKeep the rest.\n";

describe("tries: Apply highlights checked off with how it went (D127)", () => {
  test("listed under the source's skills, to try first; checking off records how it went", async () => {
    const lib = await tempLibrary();
    const src = await addText(lib, ARTICLE, { skills: ["storytelling"] });
    const other = await addText(lib, "# Elsewhere\n\nA different skill.\n", { skills: ["ai"] });
    const it = findItem(lib, src.meta.id);
    const a = addHighlight(it, { exact: "Open on the moment of change", intent: "apply", note: "My next video's cold open" });
    const b = addHighlight(it, { exact: "Keep the rest.", intent: "apply" });
    addHighlight(findItem(lib, other.meta.id), { exact: "A different skill.", intent: "apply" });
    addHighlight(it, { exact: "rewind to how we got there", intent: "keep" });

    expect(listTries(lib, { skill: "storytelling" }).map((t) => [t.id, t.status, t.item_title])).toEqual([[b.id, "open", "Openings"], [a.id, "open", "Openings"]]);
    const { tried, card } = await markTried(lib, a.id, { reflection: "  Hooked better; the rewind ran long.  " });
    expect(tried).toMatchObject({ status: "done", reflection: "Hooked better; the rewind ran long.", note: "My next video's cold open" });
    expect(card).toBe(true);
    expect(listTries(lib, { skill: "storytelling" }).map((t) => t.id)).toEqual([b.id, a.id]);
    expect(listTries(lib).length).toBe(3);
  });

  test("only a try checked off with a reflection waits for a card; Undo puts it back and drops the reflection", async () => {
    const lib = await tempLibrary();
    const src = await addText(lib, ARTICLE, { skills: ["storytelling"] });
    const a = addHighlight(findItem(lib, src.meta.id), { exact: "Open on the moment of change", intent: "apply" });
    const pending = () => pendingHighlights(findItem(lib, src.meta.id), []).map((x) => x.id);
    expect(pending()).toEqual([]);
    expect((await markTried(lib, a.id, {})).card).toBe(false);
    expect(pending()).toEqual([]);
    await markTried(lib, a.id, { undo: true });
    expect(findAnnotation(lib, a.id).annotation.status).toBe("open");
    await markTried(lib, a.id, { reflection: "It worked." });
    expect(pending()).toEqual([a.id]);
    await markTried(lib, a.id, { undo: true });
    expect(findAnnotation(lib, a.id).annotation).toMatchObject({ status: "open" });
    expect(findAnnotation(lib, a.id).annotation.reflection).toBeUndefined();
    expect(pending()).toEqual([]);
  });

  test("a highlight of another type is not a try", async () => {
    const lib = await tempLibrary();
    const src = await addText(lib, ARTICLE);
    const k = addHighlight(findItem(lib, src.meta.id), { exact: "Keep the rest.", intent: "keep" });
    await expect(markTried(lib, k.id, { reflection: "x" })).rejects.toThrow(/not a try/);
  });

  test("Next time I'll… closes the round and opens the try again with the new plan; one highlight per idea (D148)", async () => {
    const lib = await tempLibrary();
    const src = await addText(lib, ARTICLE, { skills: ["storytelling"] });
    const it = findItem(lib, src.meta.id);
    const a = addHighlight(it, { exact: "Open on the moment of change", intent: "apply", note: "My next video's cold open" });
    const pending = () => pendingHighlights(findItem(lib, src.meta.id), []).map((x) => x.id);

    const { tried, card } = await markTried(lib, a.id, { reflection: "Hooked better; the rewind ran long.", next: "  Cut the rewind to one line  " });
    expect(card).toBe(true);
    expect(tried).toMatchObject({ status: "open", note: "Cut the rewind to one line", uses: [{ plan: "My next video's cold open", reflection: "Hooked better; the rewind ran long." }] });
    expect(tried.reflection).toBeUndefined();
    // Still the same highlight: the reader paints the passage once, and the record of use is one idea.
    expect(readAnnotations(findItem(lib, src.meta.id)).filter((x) => x.intent === "apply").map((x) => x.id)).toEqual([a.id]);
    // The round he wrote up still gets its card, and the card asks after every round's lesson.
    expect(pending()).toEqual([a.id]);
    expect(reflections(tried)).toEqual(["Hooked better; the rewind ran long."]);

    // The second round: checked off, written up, re-planned again.
    await markTried(lib, a.id, { reflection: "One line was enough." });
    const third = (await markTried(lib, a.id, { reflection: "One line was enough.", next: "Try it on the podcast intro" })).tried;
    expect(third.uses?.map((u) => u.plan)).toEqual(["My next video's cold open", "Cut the rewind to one line"]);
    expect(reflections(third)).toEqual(["Hooked better; the rewind ran long.", "One line was enough."]);

    // One step back: the re-plan is undone, the last round is tried again as it was; another step back puts it to try.
    const back = (await markTried(lib, a.id, { undo: true })).tried;
    expect(back).toMatchObject({ status: "done", note: "Cut the rewind to one line", reflection: "One line was enough." });
    expect(back.uses?.length).toBe(1);
    const open = (await markTried(lib, a.id, { undo: true })).tried;
    expect(open).toMatchObject({ status: "open", note: "Cut the rewind to one line" });
    expect(open.reflection).toBeUndefined();
    expect(open.uses?.length).toBe(1);
  });
});
