import { describe, expect, test } from "bun:test";
import { againIn, againText, askAbout, entry, lookable } from "../src/lookup";

describe("look up (D83)", () => {
  test("only a word or short phrase offers Look Up", () => {
    expect(lookable("ephemeral")).toBe(true);
    expect(lookable(" working memory ")).toBe(true);
    expect(lookable("the spacing effect is robust")).toBe(false);
    expect(lookable("   ")).toBe(false);
  });

  test("splits the dictionary's one line into headword, pronunciation and entry", () => {
    const e = entry("ephemeral | əˈfem(ə)rəl | adjective lasting for a very short time: fashions are ephemeral. • (chiefly of plants) having a very short life cycle. DERIVATIVES ephemerality noun. ORIGIN late 16th century.");
    expect(e.head).toBe("ephemeral");
    expect(e.pron).toBe("əˈfem(ə)rəl");
    expect(e.body).toBe("adjective lasting for a very short time: fashions are ephemeral.\n• (chiefly of plants) having a very short life cycle.\n\nDERIVATIVES ephemerality noun.\n\nORIGIN late 16th century.");
  });

  test("an entry without the usual parts shows as it came", () => {
    expect(entry("A short gloss.")).toEqual({ head: "", pron: "", body: "A short gloss." });
  });
});

describe("explain: does the term come up again (side quests)", () => {
  const body = "# Claude\n\nClaude speaks a RESTful API. The RESTful API is stateless.\n\n## Streaming\n\nStreams over the restful api.\n\n## Tool use\n\nTwo RESTful APIs here, not a RESTful-ish thing.\n\n## Pricing\n\nNothing.";
  const from = body.indexOf("RESTful API") + "RESTful API".length;

  test("names the later sections that use it, ignoring case and a plural, not the one he is in", () => {
    expect(againIn(body, from, "RESTful API")).toEqual({ sections: ["Streaming", "Tool use"], later: true });
    expect(againText(againIn(body, from, "RESTful API"))).toBe("Comes up again in Streaming and Tool use.");
  });

  test("a use only in his own section says further on; none says nothing", () => {
    const a = againIn(body, from, "Claude");
    expect(a.later).toBe(false);
    expect(againText(againIn("# A\n\nREST here. REST again.", 9, "REST"))).toBe("Comes up again further on.");
    expect(againText({ sections: [], later: false })).toBeNull();
  });

  test("only whole words count, and long lists are cut", () => {
    expect(againIn("REST then RESTful and unREST", 4, "REST").later).toBe(false);
    expect(againText({ sections: ["A", "B", "C", "D"], later: true })).toBe("Comes up again in A, B and 2 more sections.");
    expect(askAbout(" RESTful\nAPI ")).toBe("What is RESTful API?");
  });
});
