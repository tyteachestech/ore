import { expect, test } from "bun:test";
import { originalLabel, playerLink } from "../src/original";
import type { Item } from "../src/ore";

const label = (url?: string, source_file?: string) => originalLabel({ url, source_file } as Item);

test("the original link names a site by its address", () => {
  expect(label("https://www.markmanson.net/values")).toBe("markmanson.net");
  // A site's own file keeps the site: the site says more than "s41586.pdf".
  expect(label("https://www.nature.com/articles/s41586.pdf")).toBe("nature.com");
});

test("a file kept on a storage host is named by the file, not the host's random letters (F509)", () => {
  expect(label("https://d3o9bzvr1aje7d.cloudfront.net/guides/Values%20Guide.pdf?v=2")).toBe("Values Guide.pdf");
  expect(label("https://my-bucket.s3.us-east-1.amazonaws.com/a/paper.pdf")).toBe("paper.pdf");
  expect(label("https://storage.googleapis.com/bucket/deck.pptx")).toBe("deck.pptx");
  // A name that can't be decoded shows as it is written, never the whole address.
  expect(label("https://d3o9bzvr1aje7d.cloudfront.net/100%.pdf")).toBe("100%.pdf");
  // Nothing in the path that reads as a file: the host is all there is.
  expect(label("https://d3o9bzvr1aje7d.cloudfront.net/")).toBe("d3o9bzvr1aje7d.cloudfront.net");
  expect(label("https://d3o9bzvr1aje7d.cloudfront.net/p/8842")).toBe("d3o9bzvr1aje7d.cloudfront.net");
});

test("a source with no address is named by its kept file", () => {
  expect(label(undefined, "/Users/t/Ore/items/a/chapter-3.pdf")).toBe("chapter-3.pdf");
  expect(label()).toBe(null);
});

// Codex UX sweep 10: a course lesson's player said Open on YouTube and opened the lesson's page.
test("the player's Open on YouTube goes to the video, not the page that plays it", () => {
  expect(playerLink({ url: "https://academy.claude.com/courses/x/intro", video: "https://www.youtube.com/watch?v=JpGtOfSgR-c" })).toBe("https://www.youtube.com/watch?v=JpGtOfSgR-c");
  expect(playerLink({ url: "https://www.youtube.com/watch?v=abc" })).toBe("https://www.youtube.com/watch?v=abc");
});
