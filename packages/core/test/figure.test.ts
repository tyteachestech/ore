import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findCard } from "../src/cards.ts";
import { addFigureCard, figureFile, figureSrcs, FIGURE_QUESTION } from "../src/figure.ts";
import { findItem } from "../src/items.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { tempLibrary } from "./helpers.ts";

async function source() {
  const lib = await tempLibrary();
  const { item } = await addSnippet(lib, { text: 'The heart\n\n![The heart, labelled](assets/heart%201.png "Fig. 1")\n\nAnd a map: ![](https://example.com/map.png)' });
  return { lib, item };
}

describe("cards from a figure (D166)", () => {
  test("names the figures a source shows, as it writes them", () => {
    expect(figureSrcs('a ![x](assets/a.png) b ![](<assets/b c.png>) ![t](https://e.com/m.png "T")')).toEqual(["assets/a.png", "assets/b c.png", "https://e.com/m.png"]);
  });

  test("a box over a figure becomes a Fact card that keeps the box, round-tripped through its file", async () => {
    const { lib, item } = await source();
    const c = await addFigureCard(lib, item.meta.id, { src: "assets/heart%201.png", box: [0.1, 0.2, 0.25, 0.123456], label: " Left atrium " });
    expect(c.meta.kind).toBe("card");
    expect(c.meta.content_type).toBe("fact");
    expect(c.meta.state).toBe("draft");
    expect(c.question).toBe(FIGURE_QUESTION);
    expect(c.answer).toBe("Left atrium");
    const again = findCard(lib, c.meta.id);
    expect(again.meta.figure).toEqual({ src: "assets/heart%201.png", box: [0.1, 0.2, 0.25, 0.1235] });
    expect(readFileSync(again.path, "utf8")).toContain("figure:");
    expect(figureFile(findItem(lib, item.meta.id), again.meta.figure!.src)).toBe(join(item.dir, "assets/heart 1.png"));
    // The reader's parser writes the address its own way; the card keeps the doc's.
    const spaced = await addFigureCard(lib, item.meta.id, { src: "assets/heart 1.png", box: [0, 0, 0.5, 0.5], label: "Aorta" });
    expect(spaced.meta.figure!.src).toBe("assets/heart%201.png");
    expect(figureFile(findItem(lib, item.meta.id), "https://example.com/map.png")).toBe("https://example.com/map.png");
  });

  test("refuses a figure the source doesn't show, a box outside it or too small, and an empty answer", async () => {
    const { lib, item } = await source();
    const id = item.meta.id;
    await expect(addFigureCard(lib, id, { src: "assets/other.png", box: [0, 0, 0.5, 0.5], label: "x" })).rejects.toThrow("isn’t a figure");
    await expect(addFigureCard(lib, id, { src: "assets/heart%201.png", box: [0.8, 0, 0.5, 0.5], label: "x" })).rejects.toThrow("inside the figure");
    await expect(addFigureCard(lib, id, { src: "assets/heart%201.png", box: [0, 0, 0.001, 0.5], label: "x" })).rejects.toThrow("inside the figure");
    await expect(addFigureCard(lib, id, { src: "assets/heart%201.png", box: [0, 0, NaN, 0.5], label: "x" })).rejects.toThrow("four numbers");
    await expect(addFigureCard(lib, id, { src: "assets/heart%201.png", box: [0, 0, 0.5, 0.5], label: "  " })).rejects.toThrow("under the box");
    await expect(addFigureCard(lib, id, { src: "assets/heart%201.png", box: [0, 0, 0.5, 0.5], label: "a\nb" })).rejects.toThrow("one line");
  });
});
