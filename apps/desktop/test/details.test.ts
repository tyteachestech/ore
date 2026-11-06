import { expect, test } from "bun:test";
import { byline, detailsOf, siteOf, withDetails } from "../src/details";

test("each list keeps its own details; an unset list starts with Type plus the old Mac-wide columns", () => {
  const store = withDetails(withDetails(null, "all/toread", ["type", "author"]), "math/done", []);
  expect(detailsOf(store, null, "all/toread")).toEqual(["type", "author"]);
  expect(detailsOf(store, null, "math/done")).toEqual([]);
  expect(detailsOf(store, null, "math/toread")).toEqual(["author"]);
  expect(detailsOf(store, '["added","author"]', "math/toread")).toEqual(["author", "added"]);
  // Junk in storage reads as unset, and unknown ids drop out.
  expect(detailsOf("{oops", "nope", "x")).toEqual(["author"]);
  expect(detailsOf('{"x":["site","bogus"]}', null, "x")).toEqual(["site"]);
});

test("author for every kind of source, else the web page's site, else nothing", () => {
  expect(byline({ author: " Anthropic ", url: "https://www.youtube.com/watch?v=1" }, false)).toEqual({ text: "Anthropic", site: false });
  expect(byline({ url: "https://www.developer.mozilla.org/en-US/docs" }, false)).toEqual({ text: "developer.mozilla.org", site: true });
  // Site shown beside it already: no repeat.
  expect(byline({ url: "https://example.com" }, true)).toBeNull();
  expect(byline({ author: "  " }, false)).toBeNull();
  expect(siteOf("not a url")).toBeUndefined();
  expect(siteOf(undefined)).toBeUndefined();
});
